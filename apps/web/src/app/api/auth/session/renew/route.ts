import { NextResponse, type NextRequest } from "next/server";
import { readConfig } from "@/server/config/store";
import {
  OIDC_SESSION_COOKIE,
  renewSession,
  validateSessionSecret,
} from "@/server/auth/oidc-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

/** Sliding session renewal for OIDC logins. Called by the app shell when the
 *  app is opened or comes back to the foreground. Other auth modes have their
 *  own long-lived cookies, for them this is a no-op. */
export async function POST(req: NextRequest) {
  let mode: string;
  try {
    mode = readConfig().auth.mode;
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
  if (mode !== "oauth2") {
    return NextResponse.json({ ok: true, renewed: false }, { headers: NO_STORE });
  }

  const secret = process.env["MESH_SESSION_SECRET"];
  if (!secret || !validateSessionSecret(secret).ok) {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
  const token = req.cookies.get(OIDC_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });

  const result = await renewSession(token, secret);
  if (result.status === "invalid") {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }
  const res = NextResponse.json(
    { ok: true, renewed: result.status === "renewed", expiresAt: result.expiresAt },
    { headers: NO_STORE },
  );
  if (result.status === "renewed") {
    res.cookies.set({
      name: OIDC_SESSION_COOKIE,
      value: result.token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: Math.max(0, result.expiresAt - Math.floor(Date.now() / 1000)),
    });
  }
  return res;
}
