import { describe, it, expect } from "vitest";
import { signState, verifyState } from "@/server/auth/oidc-session";

const SECRET = "state-test-secret-with-32+chars-aaa";

describe("OIDC state-cookie verification", () => {
  it("verifies a freshly signed state cookie", async () => {
    const signed = await signState(
      { state: "abc123", nonce: "nonce456", redirectTo: "/admin" },
      SECRET,
    );
    const result = await verifyState(signed, SECRET);
    expect(result).not.toBeNull();
    expect(result?.state).toBe("abc123");
    expect(result?.nonce).toBe("nonce456");
    expect(result?.redirectTo).toBe("/admin");
  });

  it("rejects a state cookie signed with a different secret", async () => {
    const otherSecret = "different-secret-with-32+chars-bbb";
    const signed = await signState(
      { state: "abc123", nonce: "nonce456", redirectTo: "/admin" },
      otherSecret,
    );
    const result = await verifyState(signed, SECRET);
    expect(result).toBeNull();
  });

  it("rejects a session JWT used as a state cookie (audience-mismatch)", async () => {
    // Cross-token-type confusion attack: an attacker tries to use a session
    // JWT (aud=admin) as the state cookie (aud=state). Both have valid HMAC
    // but the audience claim must match.
    const { signSession } = await import("@/server/auth/oidc-session");
    const sessionJwt = await signSession(
      { sub: "u1", name: "User", role: "admin" },
      SECRET,
    );
    const result = await verifyState(sessionJwt, SECRET);
    expect(result).toBeNull();
  });

  it("rejects a state cookie missing required fields", async () => {
    // Manually craft a JWT with the right audience but missing fields
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(SECRET);
    const jwt = await new SignJWT({ state: "only-state" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer("itsweber-mesh")
      .setAudience("itsweber-mesh-state")
      .sign(key);
    const result = await verifyState(jwt, SECRET);
    expect(result).toBeNull(); // missing nonce + redirectTo
  });

  it("preserves the codeVerifier when present (PKCE round-trip)", async () => {
    const signed = await signState(
      {
        state: "abc",
        nonce: "n",
        redirectTo: "/admin",
        codeVerifier: "pkce-verifier-string-1234567890abcdef",
      },
      SECRET,
    );
    const result = await verifyState(signed, SECRET);
    expect(result?.codeVerifier).toBe("pkce-verifier-string-1234567890abcdef");
  });
});
