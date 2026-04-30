import { NextResponse } from "next/server";
import { parseCookies, getStrategy } from "./index";
import { readConfig } from "../config/store";

function deny401(): NextResponse<never> {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) as NextResponse<never>;
}

function deny403(): NextResponse<never> {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) as NextResponse<never>;
}

/**
 * Verify an incoming API Request against the configured auth strategy.
 * Returns a 401 NextResponse when unauthenticated, or null when the request
 * is allowed to proceed. Usage:
 *
 *   const deny = await requireApiAuth(req);
 *   if (deny) return deny;
 *
 * The return type is `NextResponse<never>` so TypeScript allows returning the
 * response directly from handlers that have a more specific generic type
 * (since `never` is assignable to any type).
 */
export async function requireApiAuth(req: Request): Promise<NextResponse<never> | null> {
  const config = readConfig();
  const cookies = parseCookies(req.headers.get("cookie"));
  const strategy = getStrategy(config.auth);
  const result = await strategy.verify(req, cookies);
  if (!result.ok) return deny401();
  return null;
}

/**
 * Like requireApiAuth, but additionally requires the user to have role "admin".
 * Use for destructive or sensitive operations (backup/restore, etc.).
 */
export async function requireApiAdmin(req: Request): Promise<NextResponse<never> | null> {
  const config = readConfig();
  const cookies = parseCookies(req.headers.get("cookie"));
  const strategy = getStrategy(config.auth);
  const result = await strategy.verify(req, cookies);
  if (!result.ok) return deny401();
  if (result.user.role !== "admin") return deny403();
  return null;
}
