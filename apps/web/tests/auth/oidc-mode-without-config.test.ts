import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getStrategy, OidcMisconfigurationError } from "@/server/auth";
import type { AuthConfig } from "@/server/config/schema";

const baseAuth: AuthConfig = {
  mode: "oauth2",
  users: [],
  oauth2: {
    issuerUrl: undefined,
    clientId: undefined,
    clientSecret: undefined,
    scopes: ["openid", "profile", "email"],
    adminGroupClaim: undefined,
    adminGroupValues: [],
    editorGroupValues: [],
    fallbackRole: "viewer",
    providerLabel: undefined,
    callbackPath: undefined,
    autoCreateUsers: false,
    userMapping: { emailClaim: "email", nameClaim: "name", roleClaim: undefined },
  },
};

describe("OIDC bootstrap hard-block", () => {
  let savedSecret: string | undefined;

  beforeEach(() => {
    savedSecret = process.env["MESH_SESSION_SECRET"];
  });
  afterEach(() => {
    if (savedSecret === undefined) delete process.env["MESH_SESSION_SECRET"];
    else process.env["MESH_SESSION_SECRET"] = savedSecret;
  });

  it("throws when oauth2 mode is selected but issuerUrl is empty", () => {
    process.env["MESH_SESSION_SECRET"] = "x".repeat(40);
    expect(() => getStrategy(baseAuth)).toThrow(OidcMisconfigurationError);
  });

  it("throws when oauth2 mode is selected but clientId is empty", () => {
    process.env["MESH_SESSION_SECRET"] = "x".repeat(40);
    const cfg: AuthConfig = {
      ...baseAuth,
      oauth2: { ...baseAuth.oauth2, issuerUrl: "https://auth.example.com" },
    };
    expect(() => getStrategy(cfg)).toThrow(OidcMisconfigurationError);
  });

  it("throws when oauth2 mode is selected but MESH_SESSION_SECRET is missing", () => {
    delete process.env["MESH_SESSION_SECRET"];
    const cfg: AuthConfig = {
      ...baseAuth,
      oauth2: {
        ...baseAuth.oauth2,
        issuerUrl: "https://auth.example.com",
        clientId: "mesh",
      },
    };
    expect(() => getStrategy(cfg)).toThrow(OidcMisconfigurationError);
  });

  it("succeeds when oauth2 mode is fully configured", () => {
    process.env["MESH_SESSION_SECRET"] = "x".repeat(40);
    const cfg: AuthConfig = {
      ...baseAuth,
      oauth2: {
        ...baseAuth.oauth2,
        issuerUrl: "https://auth.example.com",
        clientId: "mesh",
      },
    };
    expect(() => getStrategy(cfg)).not.toThrow();
  });

  it("does not block on open/token/userPassword modes when oauth2 is unconfigured", () => {
    delete process.env["MESH_SESSION_SECRET"];
    expect(() => getStrategy({ ...baseAuth, mode: "open" })).not.toThrow();
    process.env["ADMIN_TOKEN"] = "test-token";
    expect(() => getStrategy({ ...baseAuth, mode: "token" })).not.toThrow();
  });
});
