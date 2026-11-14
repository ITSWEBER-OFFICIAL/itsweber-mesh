import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The service worker is a plain script. Pull its routing function out and test it alone.
const source = readFileSync(join(__dirname, "../public/sw.js"), "utf8");
const body = /function strategy\([^)]*\) \{[\s\S]*?\n\}/.exec(source)?.[0];
if (!body) throw new Error("strategy() not found in sw.js");
const strategy = new Function(`${body}; return strategy;`)() as (
  method: string,
  url: string,
  mode: string,
  origin: string,
) => "bypass" | "page" | "static";

const O = "https://mesh.example.net";
const s = (path: string, mode = "cors", method = "GET") => strategy(method, O + path, mode, O);

describe("service worker routing", () => {
  it.each([
    "/api/trpc/services.list",
    "/api/auth/oidc/start",
    "/api/auth/oidc/callback?code=x",
    "/api/auth/logout",
    "/api/widgets/unraid",
    "/login",
    "/admin/login",
  ])("never touches %s", (path) => {
    expect(s(path)).toBe("bypass");
    expect(s(path, "navigate")).toBe("bypass");
  });

  it("never touches writes or foreign origins", () => {
    expect(s("/_next/static/chunk.js", "cors", "POST")).toBe("bypass");
    expect(strategy("GET", "https://auth.example.net/application/o/authorize/", "navigate", O)).toBe("bypass");
  });

  it("serves pages from the network with an offline fallback, never from cache", () => {
    expect(s("/", "navigate")).toBe("page");
    expect(s("/services?cat=web", "navigate")).toBe("page");
    expect(s("/admin/services", "navigate")).toBe("page");
  });

  it("caches only built files and icons", () => {
    expect(s("/_next/static/chunks/main.js")).toBe("static");
    expect(s("/icons/app-icon-192.png")).toBe("static");
    expect(s("/uploads/bg.webp")).toBe("bypass");
    expect(s("/manifest.webmanifest")).toBe("bypass");
  });

  it("precaches nothing that depends on the session", () => {
    const pre = /const PRECACHE = \[([^\]]*)\]/.exec(source)?.[1] ?? "";
    expect(pre).not.toMatch(/"\/"|api|admin/);
  });
});
