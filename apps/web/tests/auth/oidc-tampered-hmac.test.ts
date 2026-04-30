import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "@/server/auth/oidc-session";

const SECRET = "test-secret-with-enough-entropy-for-hs256-aaaa";

function tamperSignatureMiddle(jwt: string): string {
  // JWT format: header.payload.signature — flip a byte in the middle of
  // the signature (last-char tamper isn't reliable because base64url's
  // last char often only encodes 2-4 bits, which can collide).
  const lastDot = jwt.lastIndexOf(".");
  const sig = jwt.slice(lastDot + 1);
  const mid = Math.floor(sig.length / 2);
  const ch = sig[mid] ?? "A";
  const swap = ch === "A" ? "B" : "A";
  const newSig = sig.slice(0, mid) + swap + sig.slice(mid + 1);
  return jwt.slice(0, lastDot + 1) + newSig;
}

describe("OIDC tampered-HMAC rejection", () => {
  it("rejects a JWT with a flipped signature byte", async () => {
    const jwt = await signSession({ sub: "u1", name: "User", role: "admin" }, SECRET);
    const tampered = tamperSignatureMiddle(jwt);
    expect(tampered).not.toBe(jwt);
    const result = await verifySession(tampered, SECRET);
    expect(result).toBeNull();
  });

  it("rejects a JWT with a tampered payload (role escalation attempt)", async () => {
    // Sign as viewer
    const jwt = await signSession({ sub: "u1", name: "User", role: "viewer" }, SECRET);
    const [header, payload, signature] = jwt.split(".");
    expect(header && payload && signature).toBeTruthy();
    // Decode payload, change role, re-encode (without re-signing)
    const decoded = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    decoded["role"] = "admin";
    const newPayload = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
    const tampered = `${header}.${newPayload}.${signature}`;
    const result = await verifySession(tampered, SECRET);
    expect(result).toBeNull();
  });

  it("rejects a JWT signed with HS256 but using a different algorithm in header", async () => {
    // Construct a "none"-alg token attempting algorithm confusion
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }), "utf8").toString(
      "base64url",
    );
    const payload = Buffer.from(
      JSON.stringify({
        sub: "u1",
        name: "User",
        role: "admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: "itsweber-mesh",
        aud: "itsweber-mesh-admin",
      }),
      "utf8",
    ).toString("base64url");
    const noneJwt = `${header}.${payload}.`;
    const result = await verifySession(noneJwt, SECRET);
    expect(result).toBeNull();
  });
});
