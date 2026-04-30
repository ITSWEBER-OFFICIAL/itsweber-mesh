import * as oidc from "openid-client";
import { logger } from "../logger";

/* ── Discovery cache ─────────────────────────────────────────────────────────
   `openid-client` v6 returns a `Configuration` object from `discovery()`.
   Discovery is a network round-trip; we cache by issuerUrl+clientId for 1h
   to avoid hammering the IDP on every login. JWKS rotation is handled
   internally by openid-client through its own short-term cache. */

type CacheEntry = {
  config: oidc.Configuration;
  fetchedAt: number;
  key: string;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(issuerUrl: string, clientId: string): string {
  return `${issuerUrl}::${clientId}`;
}

export type OidcConfigInput = {
  issuerUrl: string;
  clientId: string;
  clientSecret?: string | undefined;
};

export async function getOidcConfiguration(input: OidcConfigInput): Promise<oidc.Configuration> {
  const key = cacheKey(input.issuerUrl, input.clientId);
  const existing = cache.get(key);
  if (existing && Date.now() - existing.fetchedAt < CACHE_TTL_MS) {
    return existing.config;
  }

  const issuer = new URL(input.issuerUrl);
  const clientAuth = input.clientSecret ? oidc.ClientSecretPost(input.clientSecret) : undefined;
  const config = await oidc.discovery(issuer, input.clientId, undefined, clientAuth);

  cache.set(key, { config, fetchedAt: Date.now(), key });
  logger.info({ issuerUrl: input.issuerUrl, clientId: input.clientId }, "OIDC configuration discovered");
  return config;
}

/** Invalidate cache — called when admin updates auth.oauth2 settings. */
export function clearOidcCache(): void {
  cache.clear();
}

/* ── PKCE + state + nonce ────────────────────────────────────────────────── */

export function generateAuthChallenge(): {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: Promise<string>;
} {
  const codeVerifier = oidc.randomPKCECodeVerifier();
  return {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    codeVerifier,
    codeChallenge: oidc.calculatePKCECodeChallenge(codeVerifier),
  };
}

/* ── Authorization URL builder ───────────────────────────────────────────── */

export type BuildAuthUrlInput = {
  config: oidc.Configuration;
  redirectUri: string;
  scopes: readonly string[];
  state: string;
  nonce: string;
  codeChallenge: string;
};

export function buildAuthorizationUrl(input: BuildAuthUrlInput): URL {
  return oidc.buildAuthorizationUrl(input.config, {
    redirect_uri: input.redirectUri,
    scope: input.scopes.join(" "),
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
}

/* ── Code-exchange + userinfo ────────────────────────────────────────────── */

export type ExchangeCodeInput = {
  config: oidc.Configuration;
  currentUrl: URL;
  expectedState: string;
  expectedNonce: string;
  pkceCodeVerifier: string;
};

export type OidcUserClaims = {
  sub: string;
  name?: string | undefined;
  email?: string | undefined;
  /** All claims from the ID-token, used for role-mapping. */
  raw: Record<string, unknown>;
};

export async function exchangeCodeForUser(input: ExchangeCodeInput): Promise<OidcUserClaims> {
  const tokens = await oidc.authorizationCodeGrant(input.config, input.currentUrl, {
    expectedState: input.expectedState,
    expectedNonce: input.expectedNonce,
    pkceCodeVerifier: input.pkceCodeVerifier,
    idTokenExpected: true,
  });

  const claims = tokens.claims();
  if (!claims || typeof claims["sub"] !== "string") {
    throw new Error("ID-token has no valid `sub` claim");
  }

  // Fetch userinfo for any claims not in the ID-token (most providers split them)
  let merged: Record<string, unknown> = { ...(claims as Record<string, unknown>) };
  try {
    const userinfo = await oidc.fetchUserInfo(input.config, tokens.access_token, claims["sub"]);
    merged = { ...merged, ...(userinfo as unknown as Record<string, unknown>) };
  } catch (err) {
    logger.warn({ err }, "OIDC fetchUserInfo failed; falling back to ID-token claims");
  }

  const name =
    (typeof merged["name"] === "string" && merged["name"]) ||
    (typeof merged["preferred_username"] === "string" && merged["preferred_username"]) ||
    (typeof merged["email"] === "string" && merged["email"]) ||
    undefined;
  const email = typeof merged["email"] === "string" ? merged["email"] : undefined;

  return {
    sub: String(merged["sub"]),
    ...(name !== undefined ? { name: String(name) } : {}),
    ...(email !== undefined ? { email } : {}),
    raw: merged,
  };
}

/* ── Role-mapping ─────────────────────────────────────────────────────────── */

export type RoleMappingInput = {
  claims: Record<string, unknown>;
  /** Name of the claim that contains the user's groups/roles list. */
  groupClaim?: string | undefined;
  /** Group values that grant admin role. */
  adminGroups: readonly string[];
  /** Group values that grant editor role (optional). */
  editorGroups?: readonly string[] | undefined;
  /** Default role if no group matches. */
  fallbackRole: "admin" | "editor" | "viewer";
};

export function mapUserRole(input: RoleMappingInput): "admin" | "editor" | "viewer" {
  if (!input.groupClaim) return input.fallbackRole;
  const groups = input.claims[input.groupClaim];
  const list = Array.isArray(groups)
    ? groups.map(String)
    : typeof groups === "string"
    ? [groups]
    : [];
  if (list.some((g) => input.adminGroups.includes(g))) return "admin";
  if (input.editorGroups && list.some((g) => input.editorGroups!.includes(g))) return "editor";
  return input.fallbackRole;
}

/* ── End-session URL ──────────────────────────────────────────────────────── */

export function buildEndSessionUrl(
  config: oidc.Configuration,
  postLogoutRedirectUri: string,
): URL | null {
  try {
    return oidc.buildEndSessionUrl(config, { post_logout_redirect_uri: postLogoutRedirectUri });
  } catch {
    // Provider doesn't support RP-initiated logout — caller falls back to local logout
    return null;
  }
}
