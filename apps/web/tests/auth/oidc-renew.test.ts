import { describe, it, expect } from "vitest";
import { SignJWT, decodeJwt } from "jose";
import {
  signSession,
  verifySession,
  renewSession,
  SESSION_IDLE_SECONDS,
  SESSION_MAX_SECONDS,
  SESSION_RENEW_AFTER_SECONDS,
} from "@/server/auth/oidc-session";

const SECRET = "renew-test-secret-with-enough-bytes-aaaa";
const USER = { sub: "u1", name: "User", role: "viewer" as const };
const DAY = 86400;
const NOW = Math.floor(Date.now() / 1000);

describe("OIDC sliding session", () => {
  it("issues a session with the idle lifetime", async () => {
    const claims = decodeJwt(await signSession(USER, SECRET, { now: NOW }));
    expect(claims.exp).toBe(NOW + SESSION_IDLE_SECONDS);
    expect(claims["orig"]).toBe(NOW);
  });

  it("does not re-issue a session younger than the renew threshold", async () => {
    const token = await signSession(USER, SECRET, { now: NOW });
    const result = await renewSession(token, SECRET, NOW + SESSION_RENEW_AFTER_SECONDS - 1);
    expect(result.status).toBe("fresh");
  });

  it("extends an older session and keeps identity, role and login time", async () => {
    const login = NOW - 3 * DAY;
    const token = await signSession(USER, SECRET, { now: login });
    const result = await renewSession(token, SECRET, NOW);
    expect(result.status).toBe("renewed");
    if (result.status !== "renewed") return;
    expect(result.expiresAt).toBe(NOW + SESSION_IDLE_SECONDS);
    const claims = decodeJwt(result.token);
    expect(claims["orig"]).toBe(login);
    expect(claims["role"]).toBe("viewer");
    expect(await verifySession(result.token, SECRET)).toEqual(USER);
  });

  it("never extends beyond the absolute lifetime", async () => {
    const login = NOW - 28 * DAY;
    const token = await signSession(USER, SECRET, { orig: login, now: NOW - DAY });
    const result = await renewSession(token, SECRET, NOW);
    expect(result.status).not.toBe("invalid");
    if (result.status === "invalid") return;
    expect(result.expiresAt).toBe(login + SESSION_MAX_SECONDS);
  });

  it("does not renew an expired session", async () => {
    const login = NOW - 10 * DAY;
    const token = await signSession(USER, SECRET, { now: login });
    const result = await renewSession(token, SECRET, login + SESSION_IDLE_SECONDS + 60);
    expect(result.status).toBe("invalid");
  });

  it("does not renew a session signed with another secret", async () => {
    const token = await signSession(
      { ...USER, role: "admin" },
      "another-secret-with-enough-bytes-bbbbbbb",
      { now: NOW - DAY },
    );
    expect((await renewSession(token, SECRET, NOW)).status).toBe("invalid");
  });

  it("treats the issue time of a pre-2.0 token as its login time", async () => {
    const iat = NOW - 20 * 3600;
    const legacy = await new SignJWT({ sub: "u1", name: "User", role: "admin" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(iat)
      .setExpirationTime(iat + DAY)
      .setIssuer("itsweber-mesh")
      .setAudience("itsweber-mesh-admin")
      .sign(new TextEncoder().encode(SECRET));
    const result = await renewSession(legacy, SECRET, NOW);
    expect(result.status).toBe("renewed");
    if (result.status === "renewed") expect(decodeJwt(result.token)["orig"]).toBe(iat);
  });
});
