import { describe, it, expect } from "vitest";
import { verifySession, signSession } from "@/server/auth/oidc-session";

const SECRET = "a".repeat(32) + "test-secret-12345";

describe("OIDC forged-cookie rejection", () => {
  it("rejects the legacy v1.4.0 plain-text cookie format", async () => {
    // Pre-fix, an attacker could set: oidc|attacker|Hacker|admin
    // Post-fix, the strategy expects a JWT — anything else fails signature check.
    const forged = "oidc|attacker-sub|Hacker|admin";
    const result = await verifySession(forged, SECRET);
    expect(result).toBeNull();
  });

  it("rejects an arbitrary string", async () => {
    const result = await verifySession("not-a-jwt-at-all", SECRET);
    expect(result).toBeNull();
  });

  it("rejects an empty string", async () => {
    const result = await verifySession("", SECRET);
    expect(result).toBeNull();
  });

  it("rejects a JWT signed with a different secret", async () => {
    const wrongSecret = "b".repeat(32) + "different-secret-123";
    const jwt = await signSession({ sub: "u1", name: "User", role: "admin" }, wrongSecret);
    const result = await verifySession(jwt, SECRET);
    expect(result).toBeNull();
  });

  it("accepts a properly signed JWT with the same secret", async () => {
    const jwt = await signSession({ sub: "u1", name: "User", role: "admin" }, SECRET);
    const result = await verifySession(jwt, SECRET);
    expect(result).not.toBeNull();
    expect(result?.sub).toBe("u1");
    expect(result?.role).toBe("admin");
  });
});
