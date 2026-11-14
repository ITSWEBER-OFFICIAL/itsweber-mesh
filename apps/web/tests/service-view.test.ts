import { describe, it, expect } from "vitest";
import { buildOverview, healthOf, pickUrl, situation, segmentSentence } from "@/lib/service-view";
import { clientIsInternal } from "@/server/trpc/routers/status";
import type { Service } from "@/server/config/schema";

const svc = (over: Partial<Service>): Service => ({
  id: over.name ?? "x",
  name: "Svc",
  url: "https://a.example.com",
  protection: "unknown",
  category: "tools",
  icon: "globe",
  pingTarget: { kind: "http", expectStatus: [200], timeoutMs: 3000 },
  sortOrder: 0,
  enabled: true,
  boardId: "home",
  gridLayout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
  pinnedToHome: false,
  ...over,
});

describe("pickUrl", () => {
  const both = { url: "https://a.example.com", urlInternal: "http://10.0.0.5", urlExternal: "https://a.example.com" };
  it("prefers the internal address at home", () => {
    expect(pickUrl(both, true)).toEqual({ href: "http://10.0.0.5", homeOnly: false });
  });
  it("uses the external address on the road", () => {
    expect(pickUrl(both, false)).toEqual({ href: "https://a.example.com", homeOnly: false });
  });
  it("marks a service without external address as home only", () => {
    expect(pickUrl({ url: "http://10.0.0.5", urlInternal: "http://10.0.0.5" }, false)).toEqual({ href: "http://10.0.0.5", homeOnly: true });
  });
  it("falls back to url when nothing else is set", () => {
    expect(pickUrl({ url: "https://b.example.com" }, true).href).toBe("https://b.example.com");
  });
});

describe("overview", () => {
  const services = [
    svc({ name: "a", category: "media" }),
    svc({ name: "b", category: "media" }),
    svc({ name: "c", category: "web" }),
    svc({ name: "d", category: "web", pingTarget: { kind: "none", expectStatus: [200], timeoutMs: 3000 } }),
    svc({ name: "off", enabled: false }),
  ];
  const pings = { a: { status: "online" as const }, b: { status: "offline" as const }, c: { status: "online" as const }, d: { status: "online" as const } };
  const o = buildOverview(services, pings);

  it("counts every enabled service, disabled ones never", () => {
    expect(o).toMatchObject({ total: 4, ok: 2, bad: 1, unknown: 1 });
  });
  it("builds one segment per used category in fixed order", () => {
    expect(o.segments.map((s) => [s.category, s.state, s.bad])).toEqual([["media", "bad", 1], ["web", "ok", 0]]);
  });
  it("treats a service without check as unknown, not as running", () => {
    expect(healthOf(services[3]!, pings.d)).toBe("unknown");
  });
  it("puts the situation into one sentence", () => {
    expect(situation(o)).toEqual({ lead: "2 von 4 Diensten laufen.", rest: "Ein Dienst antwortet nicht." });
    expect(segmentSentence(o.segments[0]!).rest).toBe("b antwortet nicht.");
    expect(situation(buildOverview([], {})).lead).toBe("Noch keine Dienste angelegt.");
  });
});

describe("clientIsInternal", () => {
  const h = (v: Record<string, string>) => new Headers(v);
  it.each([
    [{}, true],
    [{ "x-forwarded-for": "192.168.1.20" }, true],
    [{ "x-forwarded-for": "10.0.0.4, 172.18.0.1" }, true],
    [{ "x-forwarded-for": "::ffff:192.168.1.20" }, true],
    [{ "x-forwarded-for": "fd00::12" }, true],
    [{ "x-forwarded-for": "80.187.100.12, 172.18.0.1" }, false],
    [{ "x-real-ip": "2a01:598:8189::1" }, false],
  ])("%j → %s", (headers, expected) => {
    expect(clientIsInternal(h(headers as Record<string, string>))).toBe(expected);
  });
});
