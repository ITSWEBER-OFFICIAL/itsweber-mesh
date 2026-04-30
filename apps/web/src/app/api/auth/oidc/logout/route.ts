import { NextResponse, type NextRequest } from "next/server";
import { readConfig } from "@/server/config/store";
import { logger } from "@/server/logger";
import { getOidcConfiguration, buildEndSessionUrl } from "@/server/auth/oidc-client";
import { OIDC_SESSION_COOKIE, OIDC_STATE_COOKIE } from "@/server/auth/oidc-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET/POST /api/auth/oidc/logout
 *  Clears the local mesh_session cookie. If the IDP supports RP-initiated
 *  logout (end_session_endpoint), redirects there; otherwise just navigates
 *  back to /admin/login locally. */
async function handle(req: NextRequest) {
  const config = readConfig();
  const url = new URL(req.url);
  const postLogoutRedirectUri = new URL("/admin/login", `${url.protocol}//${url.host}`).toString();

  let endSessionUrl: URL | null = null;
  if (
    config.auth.mode === "oauth2" &&
    config.auth.oauth2.issuerUrl &&
    config.auth.oauth2.clientId
  ) {
    try {
      const oidcConfig = await getOidcConfiguration({
        issuerUrl: config.auth.oauth2.issuerUrl.trim(),
        clientId: config.auth.oauth2.clientId.trim(),
        clientSecret: config.auth.oauth2.clientSecret,
      });
      endSessionUrl = buildEndSessionUrl(oidcConfig, postLogoutRedirectUri);
    } catch (err) {
      logger.warn({ err }, "Failed to build OIDC end-session URL — falling back to local logout");
    }
  }

  const target = endSessionUrl ?? new URL(postLogoutRedirectUri);
  const response = NextResponse.redirect(target.toString());
  response.cookies.set({
    name: OIDC_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: OIDC_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export const GET = handle;
export const POST = handle;
