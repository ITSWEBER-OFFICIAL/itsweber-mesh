import { SignJWT, jwtVerify } from "jose";

/* ── Session JWT (after successful OIDC login) ───────────────────────────────
   Format: HS256-signed JWT with payload { sub, name, role, iat, exp }.
   Lifetime: 24 hours (renewed on each successful admin request via /me check). */

export type OidcSessionPayload = {
  sub: string;
  name: string;
  role: "admin" | "editor" | "viewer";
};

const SESSION_LIFETIME = "24h";
const STATE_LIFETIME_SECONDS = 300; // 5 minutes

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: OidcSessionPayload, secret: string): Promise<string> {
  return new SignJWT({ sub: payload.sub, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(SESSION_LIFETIME)
    .setIssuer("itsweber-mesh")
    .setAudience("itsweber-mesh-admin")
    .sign(getSecretKey(secret));
}

export async function verifySession(
  token: string,
  secret: string,
): Promise<OidcSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret), {
      issuer: "itsweber-mesh",
      audience: "itsweber-mesh-admin",
      algorithms: ["HS256"],
    });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const name = typeof payload["name"] === "string" ? payload["name"] : null;
    const role = payload["role"];
    if (!sub || !name) return null;
    if (role !== "admin" && role !== "editor" && role !== "viewer") return null;
    return { sub, name, role };
  } catch {
    return null;
  }
}

/* ── State + Nonce JWT (during OIDC redirect dance) ─────────────────────────
   Carries: { state, nonce, redirectTo, codeVerifier? } (codeVerifier for PKCE).
   Lifetime: 5 minutes. Stored as separate HttpOnly cookie until callback. */

export type OidcStatePayload = {
  state: string;
  nonce: string;
  redirectTo: string;
  codeVerifier?: string;
};

export async function signState(payload: OidcStatePayload, secret: string): Promise<string> {
  return new SignJWT({
    state: payload.state,
    nonce: payload.nonce,
    redirectTo: payload.redirectTo,
    ...(payload.codeVerifier ? { codeVerifier: payload.codeVerifier } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_LIFETIME_SECONDS}s`)
    .setIssuer("itsweber-mesh")
    .setAudience("itsweber-mesh-state")
    .sign(getSecretKey(secret));
}

export async function verifyState(
  token: string,
  secret: string,
): Promise<OidcStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret), {
      issuer: "itsweber-mesh",
      audience: "itsweber-mesh-state",
      algorithms: ["HS256"],
    });
    const state = typeof payload["state"] === "string" ? payload["state"] : null;
    const nonce = typeof payload["nonce"] === "string" ? payload["nonce"] : null;
    const redirectTo = typeof payload["redirectTo"] === "string" ? payload["redirectTo"] : null;
    const codeVerifier =
      typeof payload["codeVerifier"] === "string" ? payload["codeVerifier"] : undefined;
    if (!state || !nonce || !redirectTo) return null;
    return { state, nonce, redirectTo, ...(codeVerifier ? { codeVerifier } : {}) };
  } catch {
    return null;
  }
}

/* ── Session-Secret Validation ──────────────────────────────────────────────
   Called at bootstrap. MESH_SESSION_SECRET must be ≥32 bytes (256 bits)
   to provide adequate HS256 security. We accept the raw string and require
   minimum length 32 chars (UTF-8); for binary secrets users can use any
   chars they like. */

export const MIN_SESSION_SECRET_LENGTH = 32;

export function validateSessionSecret(secret: string | undefined): { ok: true } | { ok: false; reason: string } {
  if (!secret) {
    return { ok: false, reason: "MESH_SESSION_SECRET environment variable is not set" };
  }
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    return {
      ok: false,
      reason: `MESH_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters (got ${secret.length})`,
    };
  }
  return { ok: true };
}

export const OIDC_SESSION_COOKIE = "mesh_session";
export const OIDC_STATE_COOKIE = "mesh_oidc_state";
