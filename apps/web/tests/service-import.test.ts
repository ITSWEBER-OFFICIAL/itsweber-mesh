import { describe, it, expect } from "vitest";
import { planImport, ImportListSchema } from "@/lib/service-import";
import { ServiceSchema, type Service } from "@/server/config/schema";

const existing = (over: Partial<Service>): Service =>
  ServiceSchema.parse({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Home Assistant",
    url: "http://10.0.0.40:8123",
    urlInternal: "http://10.0.0.40:8123",
    category: "smart-home",
    pingTarget: { kind: "http", url: "http://10.0.0.40:8123" },
    pinnedToHome: true,
    ...over,
  });

describe("planImport", () => {
  it("adds an unknown service with sane defaults", () => {
    const plan = planImport([], [{ name: "Emby", urlExternal: "https://emby.example.net", protection: "login", category: "media" }]);
    expect(plan.added).toEqual(["Emby"]);
    expect(plan.services[0]).toMatchObject({
      name: "Emby",
      url: "https://emby.example.net",
      urlExternal: "https://emby.example.net",
      protection: "login",
      category: "media",
      enabled: true,
    });
    expect(ServiceSchema.safeParse(plan.services[0]).success).toBe(true);
  });

  it("checks health from inside when an internal address exists", () => {
    const plan = planImport([], [{ name: "Core", urlInternal: "http://192.168.1.10", urlExternal: "https://core.example.net", protection: "authentik" }]);
    expect(plan.services[0]!.url).toBe("https://core.example.net");
    expect(plan.services[0]!.pingTarget.url).toBe("http://192.168.1.10");
  });

  it("matches by host and only fills gaps", () => {
    const before = existing({});
    const plan = planImport([before], [
      { name: "HA", urlInternal: "http://10.0.0.40:8123", urlExternal: "https://home.example.net", protection: "login", category: "tools" },
    ]);
    expect(plan.added).toEqual([]);
    expect(plan.updated).toEqual([{ name: "Home Assistant", changes: ["Adresse extern", "Absicherung"] }]);
    const s = plan.services[0]!;
    expect(s).toMatchObject({ name: "Home Assistant", category: "smart-home", url: before.url, pinnedToHome: true });
    expect(s.urlExternal).toBe("https://home.example.net");
    expect(s.protection).toBe("login");
  });

  it("matches by name when the address differs", () => {
    const plan = planImport([existing({})], [{ name: "home-assistant", urlExternal: "https://home.example.net" }]);
    expect(plan.added).toEqual([]);
    expect(plan.services).toHaveLength(1);
  });

  it("never overwrites a protection that was set by hand", () => {
    const plan = planImport([existing({ protection: "authentik" })], [{ name: "Home Assistant", url: "http://10.0.0.40:8123", protection: "public" }]);
    expect(plan.services[0]!.protection).toBe("authentik");
    expect(plan.unchanged).toEqual(["Home Assistant"]);
  });

  it("sets the expected answer for an interface without a page", () => {
    const plan = planImport([], [{ name: "Status-API", urlExternal: "https://api.example.net", expectStatus: [404], protection: "public" }]);
    expect(plan.services[0]!.pingTarget.expectStatus).toEqual([404]);
  });

  it("is repeatable and leaves the input untouched", () => {
    const start = [existing({})];
    const entries = [
      { name: "Home Assistant", urlExternal: "https://home.example.net", protection: "login" as const },
      { name: "Emby", urlExternal: "https://emby.example.net" },
    ];
    const first = planImport(start, entries);
    const second = planImport(first.services, entries);
    expect(start[0]!.urlExternal).toBeUndefined();
    expect(second.added).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.unchanged).toHaveLength(2);
    expect(second.services).toEqual(first.services);
  });

  it("rejects entries without any address", () => {
    expect(ImportListSchema.safeParse([{ name: "Leer" }]).success).toBe(false);
    expect(ImportListSchema.safeParse([{ name: "Ok", url: "https://a.example.net" }]).success).toBe(true);
  });
});
