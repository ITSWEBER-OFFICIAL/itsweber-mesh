import { SignJWT, jwtVerify } from "jose";

/* ── Session JWT (after successful OIDC login) ───────────────────────────────
   Format: HS256-signed JWT with payload { sub, name, role, iat, exp }.
   Lifetime: 7 days idle, 30 days absolute. Renewed by /api/auth/session/renew. */

export type OidcSessionPayload = {
  sub: string;
  name: string;
  role: "admin" | "editor" | "viewer";
};

/** Idle lifetime: a session that is not used for this long expires. */
export const SESSION_IDLE_SECONDS = 60 * 60 * 24 * 7;
/** Absolute lifetime since the IDP login. After that a fresh login is required,
 *  so role or group changes at the IDP take effect after 30 days at the latest. */
export const SESSION_MAX_SECONDS = 60 * 60 * 24 * 30;
/** A session younger than this is not re-issued (keeps renewals rare). */
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60;
const STATE_LIFETIME_SECONDS = 300; // 5 minutes

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export type SignSessionOptions = {
  /** Epoch seconds of the original IDP login. Defaults to now. */
  orig?: number;
  /** Epoch seconds used as "now" (tests). */
  now?: number;
};

/** Expiry for a session issued at `now` whose IDP login happened at `orig`. */
export function sessionExpiry(now: number, orig: number): number {
  return Math.min(now + SESSION_IDLE_SECONDS, orig + SESSION_MAX_SECONDS);
}

export async function signSession(
  payload: OidcSessionPayload,
  secret: string,
  opts: SignSessionOptions = {},
): Promise<string> {
  const now = opts.now ?? nowSeconds();
  const orig = opts.orig ?? now;
  return new SignJWT({ sub: payload.sub, name: payload.name, role: payload.role, orig })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(sessionExpiry(now, orig))
    .setIssuer("itsweber-mesh")
    .setAudience("itsweber-mesh-admin")
    .sign(getSecretKey(secret));
}

export type RenewResult =
  | { status: "invalid" }
  | { status: "fresh"; expiresAt: number }
  | { status: "renewed"; token: string; expiresAt: number };

/** Sliding renewal. Verifies the token, then re-issues it with a new idle
 *  window, capped at SESSION_MAX_SECONDS after the original login. Identity and
 *  role are copied from the verified token, never from the request. */
export async function renewSession(
  token: string,
  secret: string,
  now: number = nowSeconds(),
): Promise<RenewResult> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getSecretKey(secret), {
      issuer: "itsweber-mesh",
      audience: "itsweber-mesh-admin",
      algorithms: ["HS256"],
      currentDate: new Date(now * 1000),
    }));
  } catch {
    return { status: "invalid" };
  }
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const name = typeof payload["name"] === "string" ? payload["name"] : null;
  const role = payload["role"];
  const iat = typeof payload.iat === "number" ? payload.iat : null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  if (!sub || !name || iat === null || exp === null) return { status: "invalid" };
  if (role !== "admin" && role !== "editor" && role !== "viewer") return { status: "invalid" };

  // Tokens issued before 2.0 carry no `orig`; their issue time is the login time.
  const orig = typeof payload["orig"] === "number" ? payload["orig"] : iat;
  if (orig > now || now - orig >= SESSION_MAX_SECONDS) return { status: "fresh", expiresAt: exp };
  if (now - iat < SESSION_RENEW_AFTER_SECONDS) return { status: "fresh", expiresAt: exp };

  const expiresAt = sessionExpiry(now, orig);
  if (expiresAt <= exp) return { status: "fresh", expiresAt: exp };
  const renewed = await signSession({ sub, name, role }, secret, { orig, now });
  return { status: "renewed", token: renewed, expiresAt };
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
