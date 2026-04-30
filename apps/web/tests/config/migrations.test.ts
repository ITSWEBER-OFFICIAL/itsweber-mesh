import { describe, it, expect } from "vitest";
import { runMigrations, migrations, CURRENT_VERSION } from "@/server/config/migrations";
import { ConfigSchema } from "@/server/config/schema";

// Minimal valid v1 config fixture used across most tests
const V1_MINIMAL: Record<string, unknown> = {
  version: 1,
  meta: { name: "Test" },
  theme: { preset: "dark", accent: "#3ba7a7" },
  layout: {},
  auth: { mode: "open", users: [] },
  services: [],
  widgetInstances: [],
  integrations: {
    unraid: [],
    homeAssistant: {},
    adguard: {},
    unifi: {},
    glances: [],
  },
};

describe("migrations chain", () => {
  it("has 16 migration steps covering v1 → v17", () => {
    expect(migrations).toHaveLength(16);
    expect(migrations[0]!.from).toBe(1);
    expect(migrations[15]!.to).toBe(17);
    expect(CURRENT_VERSION).toBe(17);
  });

  it("no gaps or overlaps in migration versions", () => {
    for (let i = 1; i < migrations.length; i++) {
      expect(migrations[i]!.from).toBe(migrations[i - 1]!.to);
    }
  });

  it("full chain v1 → v17 produces version 17", () => {
    const result = runMigrations({ ...V1_MINIMAL });
    expect(result["version"]).toBe(17);
  });

  it("full chain v1 → v17 passes ConfigSchema validation", () => {
    const result = runMigrations({ ...V1_MINIMAL });
    const parsed = ConfigSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("already-current config (v17) passes through unchanged", () => {
    const alreadyCurrent = runMigrations({ ...V1_MINIMAL });
    const secondPass = runMigrations(alreadyCurrent);
    expect(secondPass["version"]).toBe(17);
  });

  it("v16 → v17: removes layout.tabs and adds pinnedToHome to services", () => {
    const v16: Record<string, unknown> = {
      ...V1_MINIMAL,
      version: 16,
      layout: {
        showQuickAccess: true,
        showSystemBadge: true,
        serviceCardShowCategory: true,
        tabs: [{ id: "overview", label: "Übersicht", enabled: true, sortOrder: 0 }],
      },
      services: [
        {
          id: "aaa",
          name: "Svc",
          url: "http://example.com",
          category: "tools",
          icon: "globe",
          pingTarget: { kind: "none" },
          sortOrder: 0,
          enabled: true,
          boardId: "home",
          gridLayout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
        },
      ],
    };
    const result = runMigrations(v16);
    const layout = result["layout"] as Record<string, unknown>;
    expect(layout["tabs"]).toBeUndefined();
    const services = result["services"] as Record<string, unknown>[];
    expect(services[0]!["pinnedToHome"]).toBe(false);
  });

  it("v16 → v17: preserves existing pinnedToHome: true", () => {
    const v16: Record<string, unknown> = {
      ...V1_MINIMAL,
      version: 16,
      layout: {},
      services: [
        {
          id: "bbb",
          name: "Pinned",
          url: "http://example.com",
          category: "tools",
          icon: "globe",
          pingTarget: { kind: "none" },
          sortOrder: 0,
          enabled: true,
          boardId: "home",
          gridLayout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
          pinnedToHome: true,
        },
      ],
    };
    const result = runMigrations(v16);
    const services = result["services"] as Record<string, unknown>[];
    expect(services[0]!["pinnedToHome"]).toBe(true);
  });

  it("runMigrations is idempotent: running twice on v17 output yields same result", () => {
    const once = runMigrations({ ...V1_MINIMAL });
    const twice = runMigrations(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});
