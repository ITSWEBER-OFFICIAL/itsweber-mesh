import { NextResponse, type NextRequest } from "next/server";
import { readConfig } from "@/server/config/store";
import { logger } from "@/server/logger";
import {
  getOidcConfiguration,
  exchangeCodeForUser,
  mapUserRole,
} from "@/server/auth/oidc-client";
import {
  verifyState,
  signSession,
  OIDC_STATE_COOKIE,
  OIDC_SESSION_COOKIE,
  validateSessionSecret,
} from "@/server/auth/oidc-session";
import { safeRedirectTarget } from "@/server/auth/oidc-redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reconstruct the public-facing callback URL from reverse-proxy forwarded headers.
 *  openid-client v6 derives the redirect_uri from currentUrl during token exchange,
 *  so it must match the public URL registered with the IDP exactly. */
function buildPublicCallbackUrl(req: NextRequest): URL {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    req.headers.get("host") ??
    url.host;
  return new URL(url.pathname + url.search, `${proto}://${host}`);
}

/** GET /api/auth/oidc/callback
 *  Verifies state cookie, exchanges authorization code, validates ID-token,
 *  fetches userinfo, maps role, and issues a signed `mesh_session` JWT.
 *  Then redirects to the original path the user was visiting before login. */
export async function GET(req: NextRequest) {
  const config = readConfig();

  if (config.auth.mode !== "oauth2") {
    return NextResponse.json(
      { ok: false, reason: "OIDC ist nicht aktiviert" },
      { status: 400 },
    );
  }

  const secretCheck = validateSessionSecret(process.env["MESH_SESSION_SECRET"]);
  if (!secretCheck.ok) {
    return NextResponse.json({ ok: false, reason: secretCheck.reason }, { status: 500 });
  }
  const sessionSecret = process.env["MESH_SESSION_SECRET"]!;

  const stateCookieValue = req.cookies.get(OIDC_STATE_COOKIE)?.value;
  if (!stateCookieValue) {
    return NextResponse.json(
      { ok: false, reason: "OIDC-State-Cookie fehlt — Login abgelaufen?" },
      { status: 400 },
    );
  }

  const stateData = await verifyState(stateCookieValue, sessionSecret);
  if (!stateData) {
    return NextResponse.json(
      { ok: false, reason: "OIDC-State ungültig oder abgelaufen" },
      { status: 400 },
    );
  }

  // Echo from IDP must match what we stored. openid-client also checks this internally
  // via `expectedState`, but we double-check here for clarity.
  const echoedState = req.nextUrl.searchParams.get("state");
  if (echoedState !== stateData.state) {
    return NextResponse.json(
      { ok: false, reason: "OIDC-State-Mismatch" },
      { status: 400 },
    );
  }

  if (!stateData.codeVerifier) {
    return NextResponse.json(
      { ok: false, reason: "PKCE-Code-Verifier fehlt im State" },
      { status: 400 },
    );
  }

  const issuerUrl = (config.auth.oauth2.issuerUrl ?? "").trim();
  const clientId = (config.auth.oauth2.clientId ?? "").trim();

  let oidcConfig;
  try {
    oidcConfig = await getOidcConfiguration({
      issuerUrl,
      clientId,
      clientSecret: config.auth.oauth2.clientSecret,
    });
  } catch (err) {
    logger.error({ err, issuerUrl }, "OIDC discovery failed during callback");
    return NextResponse.json(
      { ok: false, reason: "OIDC-Provider nicht erreichbar" },
      { status: 502 },
    );
  }

  let user;
  try {
    user = await exchangeCodeForUser({
      config: oidcConfig,
      currentUrl: buildPublicCallbackUrl(req),
      expectedState: stateData.state,
      expectedNonce: stateData.nonce,
      pkceCodeVerifier: stateData.codeVerifier,
    });
  } catch (err) {
    logger.warn({ err }, "OIDC code exchange failed");
    return NextResponse.json(
      { ok: false, reason: "OIDC-Login fehlgeschlagen — Code-Exchange ungültig" },
      { status: 401 },
    );
  }

  // Role mapping from the configured group claim
  const role = mapUserRole({
    claims: user.raw,
    groupClaim: config.auth.oauth2.adminGroupClaim,
    adminGroups: config.auth.oauth2.adminGroupValues,
    editorGroups: config.auth.oauth2.editorGroupValues,
    fallbackRole: config.auth.oauth2.fallbackRole,
  });

  const sessionJwt = await signSession(
    { sub: user.sub, name: user.name ?? user.sub, role },
    sessionSecret,
  );

  // Use forwarded headers for baseOrigin so the post-login redirect
  // targets the public domain (e.g. https://mesh.itsweber.net), not
  // the internal container address (http://0.0.0.0:3000).
  const publicUrl = buildPublicCallbackUrl(req);
  const baseOrigin = `${publicUrl.protocol}//${publicUrl.host}`;
  const redirectTo = safeRedirectTarget(stateData.redirectTo, baseOrigin);
  const url = new URL(redirectTo, baseOrigin);

  const response = NextResponse.redirect(url.toString());
  // Issue session cookie
  response.cookies.set({
    name: OIDC_SESSION_COOKIE,
    value: sessionJwt,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
  // Clear state cookie — single-use
  response.cookies.set({
    name: OIDC_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 0,
  });

  logger.info({ sub: user.sub, role }, "OIDC login successful");
  return response;
}
