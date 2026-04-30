import { NextResponse } from "next/server";
import { TokenStrategy, UserPasswordStrategy, SESSION_COOKIE } from "@/server/auth";
import { readConfig } from "@/server/config/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginBody = { token?: unknown; username?: unknown; password?: unknown };

/**
 * POST /api/auth/login
 *
 * Token mode:        body { token: string }
 * UserPassword mode: body { username: string, password: string }
 * Open mode:         returns 400 (no auth required)
 * OAuth2 mode:       returns 400 (use OIDC redirect flow)
 */
export async function POST(req: Request) {
  const config = readConfig();

  if (config.auth.mode === "open") {
    // Set a session marker so the Edge middleware lets subsequent requests through.
    // OpenStrategy.verify() always returns ok:true regardless of this cookie value.
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: "open",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  if (config.auth.mode === "oauth2") {
    return NextResponse.json(
      { ok: false, reason: "OAuth2-Mode nutzt den OIDC-Redirect-Flow — POST-Login nicht anwendbar" },
      { status: 400 },
    );
  }

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Ungültiger Request-Body" }, { status: 400 });
  }

  // ── Token mode ──────────────────────────────────────────────────────────
  if (config.auth.mode === "token") {
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) {
      return NextResponse.json({ ok: false, reason: "Token fehlt" }, { status: 400 });
    }
    if (!TokenStrategy.validate(token)) {
      return NextResponse.json({ ok: false, reason: "Ungültiges Token" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  // ── UserPassword mode ───────────────────────────────────────────────────
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ ok: false, reason: "Benutzername und Passwort erforderlich" }, { status: 400 });
  }

  const user = config.auth.users.find((u) => u.username === username);
  if (!user) {
    // Timing-safe: still run bcrypt to prevent user enumeration
    await UserPasswordStrategy.verifyPassword(password, "$2a$12$invalid-hash-for-timing");
    return NextResponse.json({ ok: false, reason: "Ungültige Anmeldedaten" }, { status: 401 });
  }

  const valid = await UserPasswordStrategy.verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ ok: false, reason: "Ungültige Anmeldedaten" }, { status: 401 });
  }

  const sessionValue = UserPasswordStrategy.makeSessionValue(user.username, user.passwordHash);
  const res = NextResponse.json({ ok: true, name: user.username, role: user.role });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: sessionValue,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
