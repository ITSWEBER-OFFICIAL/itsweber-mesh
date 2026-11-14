import { describe, it, expect } from "vitest";
import { layoutNetMap, spread, MAP_WIDTH, type MapNode } from "@/lib/net-map";

const node = (key: string, role: MapNode["role"]): MapNode => ({ key, label: key, short: key, state: "ok", role });

describe("net map layout", () => {
  it("keeps every node inside the drawing, also with many devices", () => {
    const nodes = [node("gateway", "gateway"), ...["a", "b", "c", "d", "e"].map((k) => node(k, "server")), ...Array.from({ length: 12 }, (_, i) => node(`d${i}`, "device"))];
    const { placed, height } = layoutNetMap(nodes);
    for (const p of placed) {
      expect(p.x - p.r).toBeGreaterThanOrEqual(0);
      expect(p.x + p.r).toBeLessThanOrEqual(MAP_WIDTH);
      expect(p.y + p.r).toBeLessThanOrEqual(height);
    }
    expect(placed).toHaveLength(nodes.length + 1);
  });

  it("never puts two nodes on top of each other", () => {
    const nodes = [node("gateway", "gateway"), ...["a", "b", "c", "d"].map((k) => node(k, "server")), ...Array.from({ length: 5 }, (_, i) => node(`d${i}`, "device"))];
    const { placed } = layoutNetMap(nodes);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  it("connects everything to the gateway and the gateway to the internet", () => {
    const { lines } = layoutNetMap([node("gateway", "gateway"), node("a", "server"), node("d", "device")]);
    expect(lines.map((l) => `${l.from}>${l.to}`)).toEqual(["internet>gateway", "gateway>a", "gateway>d"]);
  });

  it("works without a gateway and without any node", () => {
    expect(layoutNetMap([node("a", "server")]).lines.map((l) => `${l.from}>${l.to}`)).toEqual(["internet>a"]);
    expect(layoutNetMap([]).placed.map((p) => p.key)).toEqual(["internet"]);
  });

  it("centres a single item and spreads several", () => {
    expect(spread(1, 0)).toBe(MAP_WIDTH / 2);
    expect(spread(3, 1)).toBe(MAP_WIDTH / 2);
    expect(spread(2, 0)).toBeLessThan(spread(2, 1));
  });
});
