import { describe, it, expect } from "vitest";
import { parseGameserverStatus, statusEndpoint } from "@/server/gameserver";

describe("gameserver status", () => {
  it("maps the public status answer", () => {
    const s = parseGameserverStatus({
      generatedAt: "2026-11-14T12:00:00.000Z",
      stale: false,
      wartung: "",
      totals: { playersOnline: 3 },
      servers: [
        { id: "b", name: "Survival", state: "online", version: "1.21.4", players: { online: 3, max: 20 } },
        { id: "a", name: "Creative", state: "offline", version: null, players: null },
        { name: "ohne id" },
        null,
      ],
    });
    expect(s.online).toBe(true);
    expect(s.playersOnline).toBe(3);
    expect(s.servers.map((x) => [x.name, x.online, x.players?.online ?? null])).toEqual([
      ["Creative", false, null],
      ["Survival", true, 3],
    ]);
  });

  it("survives an empty or foreign answer", () => {
    expect(parseGameserverStatus(null)).toMatchObject({ servers: [], playersOnline: 0, stale: false });
    expect(parseGameserverStatus({ servers: "x", totals: { playersOnline: "viele" } }).playersOnline).toBe(0);
  });

  it("sums players when the total is missing and keeps the stale flag", () => {
    const s = parseGameserverStatus({ stale: true, servers: [{ id: "a", state: "online", players: { online: 2 } }, { id: "b", state: "online", players: { online: 1 } }] });
    expect(s.playersOnline).toBe(3);
    expect(s.stale).toBe(true);
  });

  it("builds the status address from a base address", () => {
    expect(statusEndpoint("https://api.example.net")).toBe("https://api.example.net/v1/status");
    expect(statusEndpoint("https://api.example.net/")).toBe("https://api.example.net/v1/status");
    expect(statusEndpoint("https://api.example.net/v1/status?x=1")).toBe("https://api.example.net/v1/status");
    expect(statusEndpoint("ftp://api.example.net")).toBeNull();
    expect(statusEndpoint("kein url")).toBeNull();
  });
});
