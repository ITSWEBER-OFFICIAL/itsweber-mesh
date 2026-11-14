import { describe, it, expect } from "vitest";
import { runMigrations, isInternalUrl, mapLegacyPreset, CURRENT_VERSION } from "@/server/config/migrations";
import { ConfigSchema } from "@/server/config/schema";

const svc = (over: Record<string, unknown>) => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Svc",
  url: "http://10.0.0.5:8123",
  category: "tools",
  icon: "globe",
  pingTarget: { kind: "http", url: "http://10.0.0.5:8123", expectStatus: [200, 404], timeoutMs: 3000 },
  sortOrder: 0,
  enabled: true,
  boardId: "home",
  gridLayout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
  pinnedToHome: true,
  ...over,
});

const v17 = (theme: Record<string, unknown>, services: unknown[] = []): Record<string, unknown> => ({
  version: 17,
  meta: { name: "Test" },
  theme,
  layout: {},
  auth: { mode: "oauth2", users: [] },
  services,
  integrations: {},
});

const migrate = (raw: Record<string, unknown>) => {
  const parsed = ConfigSchema.safeParse(runMigrations(raw));
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error.flatten()));
  return parsed.data;
};

describe("v17 → v18 theme", () => {
  it.each([
    ["dark", "dark"],
    ["light", "light"],
    ["terminal", "dark"],
    ["itsweber", "dark"],
    ["slate", "dark"],
    ["modern-light", "light"],
    ["graphite-command", "system"],
  ] as const)("preset %s becomes %s and stays readable", (old, expected) => {
    const cfg = migrate(v17({ preset: old, accent: "#15779b" }));
    expect(cfg.version).toBe(CURRENT_VERSION);
    expect(cfg.theme.preset).toBe(expected);
    expect(cfg.theme.legacyPreset).toBe(old);
  });

  it("missing preset falls back to system", () => {
    const cfg = migrate(v17({}));
    expect(cfg.theme.preset).toBe("system");
    expect(cfg.theme.legacyPreset).toBeUndefined();
    expect(mapLegacyPreset(undefined)).toBe("system");
  });

  it("keeps accent, background, pattern and custom CSS", () => {
    const theme = {
      preset: "itsweber",
      accent: "#15779b",
      background: { kind: "image", src: "/uploads/bg.webp" },
      backgroundPattern: "dots",
      customCss: ".app-header{display:none}",
    };
    const cfg = migrate(v17(theme));
    expect(cfg.theme).toMatchObject({ ...theme, preset: "dark", legacyPreset: "itsweber" });
  });

  it("does not touch auth", () => {
    expect(migrate(v17({ preset: "dark" })).auth.mode).toBe("oauth2");
  });
});

describe("v17 → v18 services", () => {
  it("sorts a private address into urlInternal", () => {
    const s = migrate(v17({}, [svc({})])).services[0]!;
    expect(s.url).toBe("http://10.0.0.5:8123");
    expect(s.urlInternal).toBe("http://10.0.0.5:8123");
    expect(s.urlExternal).toBeUndefined();
    expect(s.protection).toBe("unknown");
  });

  it("sorts a public domain into urlExternal", () => {
    const s = migrate(v17({}, [svc({ url: "https://home.example.net" })])).services[0]!;
    expect(s.urlExternal).toBe("https://home.example.net");
    expect(s.urlInternal).toBeUndefined();
  });

  it("keeps every existing field of a service", () => {
    const before = svc({ description: "Notiz", color: "#18bcf2" });
    const after = migrate(v17({}, [before])).services[0]!;
    expect(after).toMatchObject(before);
    expect(after.pingTarget.expectStatus).toEqual([200, 404]);
  });

  it("accepts the new categories", () => {
    const cfg = migrate(v17({}, [svc({ category: "web" }), svc({ category: "gaming" })]));
    expect(cfg.services.map((s) => s.category)).toEqual(["web", "gaming"]);
  });

  it.each([
    ["http://192.168.1.1", true],
    ["http://172.20.0.4:9000", true],
    ["http://172.32.0.4", false],
    ["http://100.100.1.2", true],
    ["http://localhost:3000", true],
    ["http://itsw-core", true],
    ["http://nas.local", true],
    ["http://[fd00::1]:8080", true],
    ["https://mesh.example.net", false],
    ["https://8.8.8.8", false],
    ["kein-url", null],
  ])("isInternalUrl(%s) is %s", (url, expected) => {
    expect(isInternalUrl(url)).toBe(expected);
  });
});

describe("v18 round trip", () => {
  it("migrated config survives write and read unchanged", () => {
    const first = migrate(v17({ preset: "slate", accent: "#d97706" }, [svc({}), svc({ url: "https://a.example.com" })]));
    const second = migrate(JSON.parse(JSON.stringify(first)) as Record<string, unknown>);
    expect(second).toEqual(first);
  });

  it("running the migration twice changes nothing", () => {
    const once = runMigrations(v17({ preset: "light" }, [svc({})]));
    expect(runMigrations(once)).toEqual(once);
  });

  it("full chain from v1 reaches v18 and validates", () => {
    const cfg = migrate({
      version: 1,
      meta: { name: "Test" },
      theme: { preset: "dark", accent: "#3ba7a7" },
      layout: {},
      auth: { mode: "open", users: [] },
      services: [],
      widgetInstances: [],
      integrations: { unraid: [], homeAssistant: {}, adguard: {}, unifi: {}, glances: [] },
    });
    expect(cfg.version).toBe(18);
    expect(cfg.theme.preset).toBe("dark");
  });
});
