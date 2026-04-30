import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  OpenStrategy,
  TokenStrategy,
  UserPasswordStrategy,
  OidcMisconfigurationError,
  getStrategy,
  parseCookies,
  SESSION_COOKIE,
} from "@/server/auth/index";
import type { AuthStrategy } from "@/server/auth/index";
import type { AuthConfig } from "@/server/config/schema";

const NO_COOKIES = new Map<string, string>();

function cookies(pairs: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(pairs));
}

const BASE_AUTH: AuthConfig = {
  mode: "open",
  users: [],
  oauth2: {
    scopes: ["openid", "profile", "email"],
    adminGroupValues: [],
    editorGroupValues: [],
    fallbackRole: "viewer",
    autoCreateUsers: false,
    userMapping: { emailClaim: "email", nameClaim: "name" },
  },
};

/* ── OpenStrategy ─────────────────────────────────────────────────────────── */
describe("OpenStrategy", () => {
  const strategy: AuthStrategy = new OpenStrategy();

  it("always returns ok:true with admin role", async () => {
    const result = await strategy.verify(undefined, NO_COOKIES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.role).toBe("admin");
      expect(result.user.id).toBe("anonymous");
    }
  });

  it("ignores any cookies present", async () => {
    const result = await strategy.verify(undefined, cookies({ [SESSION_COOKIE]: "anything" }));
    expect(result.ok).toBe(true);
  });
});

/* ── TokenStrategy ────────────────────────────────────────────────────────── */
describe("TokenStrategy", () => {
  const strategy = new TokenStrategy();
  const originalEnv = process.env["ADMIN_TOKEN"];

  beforeEach(() => {
    process.env["ADMIN_TOKEN"] = "super-secret-token-for-testing";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["ADMIN_TOKEN"];
    } else {
      process.env["ADMIN_TOKEN"] = originalEnv;
    }
  });

  it("rejects when no cookie is present", async () => {
    const result = await strategy.verify(undefined, NO_COOKIES);
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong token", async () => {
    const result = await strategy.verify(undefined, cookies({ [SESSION_COOKIE]: "wrong-token" }));
    expect(result.ok).toBe(false);
  });

  it("accepts the correct token", async () => {
    const result = await strategy.verify(
      undefined,
      cookies({ [SESSION_COOKIE]: "super-secret-token-for-testing" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.role).toBe("admin");
  });

  it("rejects when ADMIN_TOKEN env is unset", async () => {
    delete process.env["ADMIN_TOKEN"];
    const result = await strategy.verify(
      undefined,
      cookies({ [SESSION_COOKIE]: "super-secret-token-for-testing" }),
    );
    expect(result.ok).toBe(false);
  });

  it("TokenStrategy.validate returns true for matching token", () => {
    expect(TokenStrategy.validate("super-secret-token-for-testing")).toBe(true);
  });

  it("TokenStrategy.validate returns false for wrong token", () => {
    expect(TokenStrategy.validate("wrong")).toBe(false);
  });
});

/* ── UserPasswordStrategy ─────────────────────────────────────────────────── */
describe("UserPasswordStrategy", () => {
  it("rejects when no session cookie is present", async () => {
    const hash = await UserPasswordStrategy.hashPassword("password123");
    const cfg: AuthConfig = {
      ...BASE_AUTH,
      mode: "userPassword",
      users: [{ id: "u1", username: "admin", passwordHash: hash, role: "admin", createdAt: new Date().toISOString() }],
    };
    const strategy = new UserPasswordStrategy(cfg);
    const result = await strategy.verify(undefined, NO_COOKIES);
    expect(result.ok).toBe(false);
  });

  it("rejects a session with malformed format (no pipe)", async () => {
    const hash = await UserPasswordStrategy.hashPassword("pass");
    const cfg: AuthConfig = {
      ...BASE_AUTH,
      mode: "userPassword",
      users: [{ id: "u1", username: "admin", passwordHash: hash, role: "admin", createdAt: new Date().toISOString() }],
    };
    const strategy = new UserPasswordStrategy(cfg);
    const result = await strategy.verify(undefined, cookies({ [SESSION_COOKIE]: "nopipehere" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a session for an unknown username", async () => {
    const hash = await UserPasswordStrategy.hashPassword("pass");
    const cfg: AuthConfig = {
      ...BASE_AUTH,
      mode: "userPassword",
      users: [{ id: "u1", username: "admin", passwordHash: hash, role: "admin", createdAt: new Date().toISOString() }],
    };
    const strategy = new UserPasswordStrategy(cfg);
    const session = UserPasswordStrategy.makeSessionValue("notexist", hash);
    const result = await strategy.verify(undefined, cookies({ [SESSION_COOKIE]: session }));
    expect(result.ok).toBe(false);
  });

  it("rejects a session with tampered hash", async () => {
    const hash = await UserPasswordStrategy.hashPassword("realpassword");
    const cfg: AuthConfig = {
      ...BASE_AUTH,
      mode: "userPassword",
      users: [{ id: "u1", username: "admin", passwordHash: hash, role: "admin", createdAt: new Date().toISOString() }],
    };
    const strategy = new UserPasswordStrategy(cfg);
    const session = UserPasswordStrategy.makeSessionValue("admin", hash + "tampered");
    const result = await strategy.verify(undefined, cookies({ [SESSION_COOKIE]: session }));
    expect(result.ok).toBe(false);
  });

  it("accepts a valid session cookie", async () => {
    const hash = await UserPasswordStrategy.hashPassword("correcthorse");
    const cfg: AuthConfig = {
      ...BASE_AUTH,
      mode: "userPassword",
      users: [{ id: "u1", username: "admin", passwordHash: hash, role: "admin", createdAt: new Date().toISOString() }],
    };
    const strategy = new UserPasswordStrategy(cfg);
    const session = UserPasswordStrategy.makeSessionValue("admin", hash);
    const result = await strategy.verify(undefined, cookies({ [SESSION_COOKIE]: session }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.name).toBe("admin");
      expect(result.user.role).toBe("admin");
    }
  });

  it("verifyPassword correctly distinguishes matching from non-matching", async () => {
    const hash = await UserPasswordStrategy.hashPassword("secret");
    expect(await UserPasswordStrategy.verifyPassword("secret", hash)).toBe(true);
    expect(await UserPasswordStrategy.verifyPassword("wrong", hash)).toBe(false);
  });
});

/* ── getStrategy factory ─────────────────────────────────────────────────── */
describe("getStrategy factory", () => {
  it("returns OpenStrategy for mode=open", () => {
    const strategy = getStrategy({ ...BASE_AUTH, mode: "open" });
    expect(strategy).toBeInstanceOf(OpenStrategy);
  });

  it("returns TokenStrategy for mode=token", () => {
    const strategy = getStrategy({ ...BASE_AUTH, mode: "token" });
    expect(strategy).toBeInstanceOf(TokenStrategy);
  });

  it("returns UserPasswordStrategy for mode=userPassword", () => {
    const strategy = getStrategy({ ...BASE_AUTH, mode: "userPassword" });
    expect(strategy).toBeInstanceOf(UserPasswordStrategy);
  });

  it("throws OidcMisconfigurationError for oauth2 mode with incomplete config", () => {
    expect(() => getStrategy({ ...BASE_AUTH, mode: "oauth2" })).toThrow(OidcMisconfigurationError);
  });
});

/* ── parseCookies ─────────────────────────────────────────────────────────── */
describe("parseCookies", () => {
  it("parses a single cookie", () => {
    const map = parseCookies("mesh_session=abc123");
    expect(map.get("mesh_session")).toBe("abc123");
  });

  it("parses multiple cookies", () => {
    const map = parseCookies("a=1; b=2; c=3");
    expect(map.get("a")).toBe("1");
    expect(map.get("b")).toBe("2");
    expect(map.get("c")).toBe("3");
  });

  it("decodes URL-encoded cookie values", () => {
    const map = parseCookies("token=hello%20world");
    expect(map.get("token")).toBe("hello world");
  });

  it("returns empty map for null input", () => {
    expect(parseCookies(null).size).toBe(0);
  });

  it("returns empty map for empty string", () => {
    expect(parseCookies("").size).toBe(0);
  });
});
