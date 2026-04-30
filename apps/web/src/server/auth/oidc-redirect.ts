/**
 * Sanitize the post-login redirect target to prevent open-redirect attacks.
 *
 * History:
 *  - v1.4.1 initial: rejected `//` and non-`/`-prefix targets but missed
 *    backslash variants like `/\evil.com`. The WHATWG URL parser treats
 *    backslashes as forward slashes for "special" URL schemes (http/https),
 *    so `new URL("/\\evil.com", "https://app.example.com")` would resolve
 *    to `https://evil.com/`.
 *  - v1.4.1 hardened: rejects any control character, any backslash, any
 *    `//` prefix, and verifies that the resolved URL stays on the same
 *    origin as the base. Returns a path-only string (no origin) on success.
 *
 * Always returns a string starting with `/`. The fallback `/admin` is used
 * for any unsafe input.
 */
export function safeRedirectTarget(target: string | null | undefined, baseOrigin: string): string {
  const FALLBACK = "/admin";
  if (typeof target !== "string" || target.length === 0) return FALLBACK;
  // Must start with a single forward slash and not be a protocol-relative URL
  if (!target.startsWith("/")) return FALLBACK;
  if (target.startsWith("//")) return FALLBACK;
  // Block backslash (browsers treat \ as / in URLs for http/https schemes)
  if (target.includes("\\")) return FALLBACK;
  // Block raw control characters that some parsers strip silently
  // (NUL, tab, CR, LF, plus generic C0 controls and DEL/U+007F).
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return FALLBACK;
  }

  // Resolve against baseOrigin and verify same-origin.
  let baseUrl: URL;
  let resolved: URL;
  try {
    baseUrl = new URL(baseOrigin);
    resolved = new URL(target, baseUrl);
  } catch {
    return FALLBACK;
  }
  if (resolved.origin !== baseUrl.origin) return FALLBACK;

  // Return only path + query + hash; never include the origin so callers
  // can construct the absolute URL themselves and we cannot accidentally
  // leak a different host.
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
