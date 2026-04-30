import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { verifySession } from "@/server/auth/oidc-session";

const SECRET = "expiry-test-secret-with-enough-bytes-aa";

function getKey() {
  return new TextEncoder().encode(SECRET);
}

describe("OIDC expired-session rejection", () => {
  it("rejects a session JWT whose exp is in the past", async () => {
    // Sign a JWT manually with an expiry 60 seconds ago
    const jwt = await new SignJWT({ sub: "u1", name: "User", role: "admin" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .setIssuer("itsweber-mesh")
      .setAudience("itsweber-mesh-admin")
      .sign(getKey());

    const result = await verifySession(jwt, SECRET);
    expect(result).toBeNull();
  });

  it("rejects a session JWT with the wrong audience claim", async () => {
    const jwt = await new SignJWT({ sub: "u1", name: "User", role: "admin" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer("itsweber-mesh")
      .setAudience("some-other-app") // wrong aud
      .sign(getKey());

    const result = await verifySession(jwt, SECRET);
    expect(result).toBeNull();
  });

  it("rejects a session JWT with an invalid role claim", async () => {
    const jwt = await new SignJWT({ sub: "u1", name: "User", role: "superuser" }) // not in enum
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer("itsweber-mesh")
      .setAudience("itsweber-mesh-admin")
      .sign(getKey());

    const result = await verifySession(jwt, SECRET);
    expect(result).toBeNull();
  });
});
