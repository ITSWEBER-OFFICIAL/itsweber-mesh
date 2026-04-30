import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { AuthMode, AuthConfig } from "../config/schema";
import { logger } from "../logger";

/** Result of authenticating a request. */
export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: string };

export type AuthUser = {
  /** Stable identifier — "anonymous" in open mode, the username in token/userPassword, sub in oauth2 */
  id: string;
  /** Display name */
  name: string;
  /** Role of the authenticated principal */
  role: "admin" | "editor" | "viewer";
};

/** Strategy contract — every auth mode implements this. */
export interface AuthStrategy {
  /** Verify the request. Returns ok:true if the principal may invoke admin procedures. */
  verify(req: Request | undefined, cookies: Map<string, string>): Promise<AuthResult>;
}

/* ── Open mode (no auth) ───────────────────────────────────────────────────
   Returns a synthetic anonymous admin. Used for v0.4 backwards compatibility
   and during initial setup. The UI shows a warning banner whenever this mode
   is active so users notice their dashboard is unprotected. */
export class OpenStrategy implements AuthStrategy {
  async verify(): Promise<AuthResult> {
    // In open mode there is no login — the user has full admin rights by design.
    // Role must be "admin" so that adminProcedure role-checks pass.
    return {
      ok: true,
      user: { id: "anonymous", name: "Open Mode", role: "admin" },
    };
  }
}

/* ── Token mode ─────────────────────────────────────────────────────────────
   ENV var ADMIN_TOKEN holds the secret. Cookie `mesh_session` from /admin/login
   transports it. Comparison is timing-safe. */
export const SESSION_COOKIE = "mesh_session";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Run a constant-time compare against `a` itself just to keep timings flat.
    try {
      timingSafeEqual(Buffer.from(a), Buffer.from(a));
    } catch { /* ignore */ }
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export class TokenStrategy implements AuthStrategy {
  async verify(_req: Request | undefined, cookies: Map<string, string>): Promise<AuthResult> {
    const required = process.env["ADMIN_TOKEN"];
    if (!required) {
      logger.warn("Auth mode is 'token' but ADMIN_TOKEN env var is unset — denying all admin requests");
      return { ok: false, reason: "Server misconfiguration: ADMIN_TOKEN not set" };
    }
    const provided = cookies.get(SESSION_COOKIE);
    if (!provided) {
      return { ok: false, reason: "Kein Admin-Token-Cookie — bitte unter /admin/login anmelden" };
    }
    if (!timingSafeEqualStr(provided, required)) {
      return { ok: false, reason: "Ungültiges Admin-Token" };
    }
    return {
      ok: true,
      user: { id: "admin", name: "Admin", role: "admin" },
    };
  }

  /** Helper used by the login route to validate before setting the cookie. */
  static validate(token: string): boolean {
    const required = process.env["ADMIN_TOKEN"];
    if (!required) return false;
    return timingSafeEqualStr(token, required);
  }
}

/* ── UserPassword mode ─────────────────────────────────────────────────────
   Cookie `mesh_session` holds the username:bcrypt-hash verification token.
   Login sets the cookie; verify reads it on every admin request. */
export class UserPasswordStrategy implements AuthStrategy {
  constructor(private readonly authConfig: AuthConfig) {}

  async verify(_req: Request | undefined, cookies: Map<string, string>): Promise<AuthResult> {
    const session = cookies.get(SESSION_COOKIE);
    if (!session) {
      return { ok: false, reason: "Nicht angemeldet — bitte unter /admin/login einloggen" };
    }

    // session format: "<username>|<passwordHash>" — we verify the stored hash matches
    const sepIdx = session.indexOf("|");
    if (sepIdx === -1) {
      return { ok: false, reason: "Ungültige Session" };
    }
    const username = session.slice(0, sepIdx);
    const storedHash = session.slice(sepIdx + 1);

    const user = this.authConfig.users.find((u) => u.username === username);
    if (!user) {
      return { ok: false, reason: "Benutzer nicht gefunden" };
    }

    // Verify the session carries the correct hash for this user
    if (!timingSafeEqualStr(storedHash, user.passwordHash)) {
      return { ok: false, reason: "Ungültige Session (Passwort geändert?)" };
    }

    return {
      ok: true,
      user: { id: user.id, name: user.username, role: user.role },
    };
  }

  /** Hash a plaintext password. BCRYPT_ROUNDS = 12 (safe default for v1.0). */
  static async hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, 12);
  }

  /** Verify plaintext against a stored bcrypt hash. */
  static async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  /** Build the session cookie value for a given user after successful login. */
  static makeSessionValue(username: string, passwordHash: string): string {
    return `${username}|${passwordHash}`;
  }
}

/* ── OAuth2 / OIDC mode ────────────────────────────────────────────────────
   v1.4.1: full OIDC flow with HMAC-signed JWT session cookies (HS256 via jose).
   Sessions are issued by /api/auth/oidc/callback after a verified IDP login.
   Verification relies entirely on the cryptographic signature — no claim from
   the cookie body is trusted before signature verification, so a forged
   `oidc|sub|name|admin` cookie cannot bypass auth (regression from v1.4.0). */
export class OidcStrategy implements AuthStrategy {
  constructor(
    private readonly authConfig: AuthConfig,
    private readonly sessionSecret: string,
  ) {}

  async verify(_req: Request | undefined, cookies: Map<string, string>): Promise<AuthResult> {
    void this.authConfig;
    const session = cookies.get(SESSION_COOKIE);
    if (!session) {
      return { ok: false, reason: "Nicht angemeldet — bitte über den OIDC-Login anmelden" };
    }

    const { verifySession } = await import("./oidc-session");
    const payload = await verifySession(session, this.sessionSecret);
    if (!payload) {
      return { ok: false, reason: "Ungültige oder abgelaufene OIDC-Session" };
    }

    return {
      ok: true,
      user: { id: payload.sub, name: payload.name, role: payload.role },
    };
  }
}

/** Thrown by the strategy factory when oauth2 mode is selected but the
 *  configuration is incomplete (missing issuerUrl/clientId) or the runtime
 *  is missing MESH_SESSION_SECRET. The bootstrap (instrumentation) catches
 *  this and refuses to start, surfacing a clear error in the container log. */
export class OidcMisconfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OidcMisconfigurationError";
  }
}

const factories: Record<AuthMode, (cfg: AuthConfig) => AuthStrategy> = {
  open:         ()    => new OpenStrategy(),
  token:        ()    => new TokenStrategy(),
  userPassword: (cfg) => new UserPasswordStrategy(cfg),
  oauth2:       (cfg) => {
    const issuerUrl = (cfg.oauth2.issuerUrl ?? "").trim();
    const clientId  = (cfg.oauth2.clientId  ?? "").trim();
    if (!issuerUrl || !clientId) {
      throw new OidcMisconfigurationError(
        "auth.mode='oauth2' but auth.oauth2.issuerUrl/clientId is empty — refusing to authenticate. Configure OIDC under Admin → Auth or switch mode to 'open'/'userPassword'.",
      );
    }
    const secret = process.env["MESH_SESSION_SECRET"];
    if (!secret) {
      throw new OidcMisconfigurationError(
        "auth.mode='oauth2' but MESH_SESSION_SECRET environment variable is not set — refusing to authenticate. Set MESH_SESSION_SECRET (≥32 chars) in the container env.",
      );
    }
    return new OidcStrategy(cfg, secret);
  },
};

/** Resolve the strategy instance for the configured auth mode. */
export function getStrategy(authConfig: AuthConfig): AuthStrategy {
  return factories[authConfig.mode](authConfig);
}

/** Parse cookies from a Request header into a Map. */
export function parseCookies(cookieHeader: string | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const pair of cookieHeader.split(";")) {
    const trimmed = pair.trim();
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) map.set(key, decodeURIComponent(value));
  }
  return map;
}
