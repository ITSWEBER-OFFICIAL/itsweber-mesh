import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware — redirects unauthenticated visitors to /admin/login.
 *
 * Only checks cookie *presence* (can't run bcrypt/jose on Edge).
 * The actual cryptographic validation happens in each tRPC/API route via
 * requireApiAdmin / adminProcedure. This middleware is purely a UX guard.
 *
 * Open mode: the /api/auth/login route sets mesh_session=open when mode
 * is "open", so the middleware lets those requests through too.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page and OIDC flow must always be reachable
  if (pathname.startsWith("/login") || pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  // Protect all /admin/** paths — redirect to /login if no session cookie
  if (pathname.startsWith("/admin")) {
    const session = req.cookies.get("mesh_session");
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
