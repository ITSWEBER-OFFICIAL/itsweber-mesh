import { NextResponse, type NextRequest } from "next/server";
import { readConfig } from "@/server/config/store";
import { logger } from "@/server/logger";
import {
  getOidcConfiguration,
  generateAuthChallenge,
  buildAuthorizationUrl,
} from "@/server/auth/oidc-client";
import { signState, OIDC_STATE_COOKIE, validateSessionSecret } from "@/server/auth/oidc-session";
import { safeRedirectTarget } from "@/server/auth/oidc-redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Resolve the redirect URI for the OIDC callback.
 *  Respects X-Forwarded-Proto / X-Forwarded-Host from reverse proxies (e.g. NPM)
 *  so the callback URL uses the public-facing scheme+host, not the internal one.
 *  If callbackPath is already an absolute URL it is used as-is. */
function resolveRedirectUri(req: NextRequest, callbackPath: string | undefined): string {
  const path = callbackPath && callbackPath.length > 0 ? callbackPath : "/api/auth/oidc/callback";

  // Already absolute — use as-is (allows manual override in config)
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    req.headers.get("host") ??
    url.host;

  return new URL(path, `${proto}://${host}`).toString();
}

/** GET /api/auth/oidc/start
 *  Builds an OIDC authorization URL with PKCE + state + nonce, stores the
 *  challenges as an HMAC-signed HttpOnly cookie, and 302-redirects the user
 *  to the IDP. Query param `?next=/path` survives through the round-trip. */
export async function GET(req: NextRequest) {
  const config = readConfig();

  if (config.auth.mode !== "oauth2") {
    return NextResponse.json(
      { ok: false, reason: "OIDC ist nicht aktiviert (auth.mode != 'oauth2')" },
      { status: 400 },
    );
  }

  const issuerUrl = (config.auth.oauth2.issuerUrl ?? "").trim();
  const clientId = (config.auth.oauth2.clientId ?? "").trim();
  if (!issuerUrl || !clientId) {
    return NextResponse.json(
      { ok: false, reason: "OIDC-Konfiguration unvollständig (issuerUrl/clientId fehlen)" },
      { status: 500 },
    );
  }

  const secretCheck = validateSessionSecret(process.env["MESH_SESSION_SECRET"]);
  if (!secretCheck.ok) {
    return NextResponse.json({ ok: false, reason: secretCheck.reason }, { status: 500 });
  }

  let oidcConfig;
  try {
    oidcConfig = await getOidcConfiguration({
      issuerUrl,
      clientId,
      clientSecret: config.auth.oauth2.clientSecret,
    });
  } catch (err) {
    logger.error({ err, issuerUrl }, "OIDC discovery failed");
    return NextResponse.json(
      { ok: false, reason: "OIDC-Provider nicht erreichbar (Discovery-Fehler)" },
      { status: 502 },
    );
  }

  // Sanitize ?next= immediately so the value stored in the signed state is
  // already safe — defense-in-depth, the callback re-validates anyway.
  // Use forwarded headers so baseOrigin reflects the public domain.
  const publicStartUrl = resolveRedirectUri(req, undefined);
  const publicOrigin = new URL(publicStartUrl);
  const baseOrigin = `${publicOrigin.protocol}//${publicOrigin.host}`;
  const next = safeRedirectTarget(req.nextUrl.searchParams.get("next"), baseOrigin);
  const challenge = generateAuthChallenge();
  const codeChallenge = await challenge.codeChallenge;
  const redirectUri = resolveRedirectUri(req, config.auth.oauth2.callbackPath);

  const authUrl = buildAuthorizationUrl({
    config: oidcConfig,
    redirectUri,
    scopes: config.auth.oauth2.scopes,
    state: challenge.state,
    nonce: challenge.nonce,
    codeChallenge,
  });

  const stateCookie = await signState(
    {
      state: challenge.state,
      nonce: challenge.nonce,
      redirectTo: next,
      codeVerifier: challenge.codeVerifier,
    },
    process.env["MESH_SESSION_SECRET"]!,
  );

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set({
    name: OIDC_STATE_COOKIE,
    value: stateCookie,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 300,
  });
  return response;
}
