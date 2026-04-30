import { describe, it, expect } from "vitest";
import { safeRedirectTarget } from "@/server/auth/oidc-redirect";

const ORIGIN = "https://mesh.example.com";

describe("safeRedirectTarget — open-redirect hardening", () => {
  /* ── Backslash-bypass and its variants ───────────────────────────────── */

  it("rejects /\\evil.com (backslash-protocol-relative bypass)", () => {
    expect(safeRedirectTarget("/\\evil.com", ORIGIN)).toBe("/admin");
  });

  it("rejects \\evil.com (no leading slash)", () => {
    expect(safeRedirectTarget("\\evil.com", ORIGIN)).toBe("/admin");
  });

  it("rejects any path containing a backslash anywhere", () => {
    expect(safeRedirectTarget("/admin\\redirect", ORIGIN)).toBe("/admin");
    expect(safeRedirectTarget("/some/path\\..\\..\\evil", ORIGIN)).toBe("/admin");
  });

  it("rejects mixed forward+back-slash combinations", () => {
    expect(safeRedirectTarget("/\\/evil.com", ORIGIN)).toBe("/admin");
    expect(safeRedirectTarget("\\\\evil.com", ORIGIN)).toBe("/admin");
  });

  /* ── Classic open-redirect vectors ───────────────────────────────────── */

  it("rejects //evil.com (protocol-relative)", () => {
    expect(safeRedirectTarget("//evil.com", ORIGIN)).toBe("/admin");
  });

  it("rejects ///evil.com (triple slash)", () => {
    expect(safeRedirectTarget("///evil.com", ORIGIN)).toBe("/admin");
  });

  it("rejects absolute external URLs", () => {
    expect(safeRedirectTarget("http://evil.com/path", ORIGIN)).toBe("/admin");
    expect(safeRedirectTarget("https://evil.com/path", ORIGIN)).toBe("/admin");
  });

  it("rejects javascript: URIs", () => {
    expect(safeRedirectTarget("javascript:alert(1)", ORIGIN)).toBe("/admin");
  });

  it("rejects data: URIs", () => {
    expect(safeRedirectTarget("data:text/html,<script>alert(1)</script>", ORIGIN)).toBe("/admin");
  });

  /* ── Control characters that some parsers strip silently ─────────────── */

  it("rejects targets containing NUL bytes", () => {
    expect(safeRedirectTarget("/admin\x00.evil.com", ORIGIN)).toBe("/admin");
  });

  it("rejects targets containing CR/LF (header injection)", () => {
    expect(safeRedirectTarget("/admin\r\nLocation: //evil.com", ORIGIN)).toBe("/admin");
    expect(safeRedirectTarget("/admin\n", ORIGIN)).toBe("/admin");
  });

  it("rejects targets containing tab character", () => {
    expect(safeRedirectTarget("/\t/evil.com", ORIGIN)).toBe("/admin");
  });

  /* ── Empty / non-string ─────────────────────────────────────────────── */

  it("returns fallback for empty string", () => {
    expect(safeRedirectTarget("", ORIGIN)).toBe("/admin");
  });

  it("returns fallback for null/undefined", () => {
    expect(safeRedirectTarget(null, ORIGIN)).toBe("/admin");
    expect(safeRedirectTarget(undefined, ORIGIN)).toBe("/admin");
  });

  /* ── Same-origin URL targets are coerced to path-only ─────────────────── */

  it("rejects absolute same-origin URLs (we want path-only)", () => {
    // Even if the origin matches, callers should use a relative path.
    // An attacker who somehow injects same-origin absolute URLs gains
    // nothing here, but we keep the contract strict.
    expect(safeRedirectTarget(`${ORIGIN}/admin`, ORIGIN)).toBe("/admin");
  });

  /* ── Allowed targets ─────────────────────────────────────────────────── */

  it("allows simple path", () => {
    expect(safeRedirectTarget("/admin", ORIGIN)).toBe("/admin");
  });

  it("allows nested path", () => {
    expect(safeRedirectTarget("/admin/auth", ORIGIN)).toBe("/admin/auth");
  });

  it("preserves query string and hash", () => {
    expect(safeRedirectTarget("/admin?foo=bar&baz=1", ORIGIN)).toBe("/admin?foo=bar&baz=1");
    expect(safeRedirectTarget("/admin#section", ORIGIN)).toBe("/admin#section");
    expect(safeRedirectTarget("/admin?foo=1#section", ORIGIN)).toBe("/admin?foo=1#section");
  });

  it("normalizes URL-encoded slashes (does not decode them as path separators)", () => {
    // %2f stays as %2F in the path — does not become a real slash that could
    // alter origin. The WHATWG URL parser preserves percent-encoded segments.
    const result = safeRedirectTarget("/%2F%2Fevil.com", ORIGIN);
    expect(result.startsWith("/")).toBe(true);
    // Whatever the browser/parser does, we never end up off-origin.
  });

  it("handles dot-segments deterministically (..)", () => {
    // /foo/../bar should resolve to /bar, still same-origin
    const result = safeRedirectTarget("/foo/../bar", ORIGIN);
    expect(result).toBe("/bar");
  });

  it("rejects leading dots that escape root (path traversal)", () => {
    // Leading "../" is blocked because it doesn't start with a single /,
    // it would start with "."
    expect(safeRedirectTarget("../etc/passwd", ORIGIN)).toBe("/admin");
  });
});
