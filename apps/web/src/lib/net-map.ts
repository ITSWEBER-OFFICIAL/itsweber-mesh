/* Anordnung des Netzplans. Oben das Internet, darunter das Gateway, darunter
   die Server und in einer weiteren Reihe die übrigen Geräte. Reine Rechnung,
   damit sich die Lage ohne Browser prüfen lässt. */

export type NodeState = "ok" | "warn" | "bad" | "unknown";
export type MapNode = { key: string; label: string; short: string; state: NodeState; role: "gateway" | "server" | "device" };
export type PlacedNode = MapNode & { x: number; y: number; r: number };
export type MapLine = { from: string; to: string; x1: number; y1: number; x2: number; y2: number };

export const MAP_WIDTH = 340;
const MARGIN = 34;
const PER_ROW = { server: 4, device: 5 } as const;

/** Spreads `count` items evenly across the width. */
export function spread(count: number, index: number): number {
  if (count <= 1) return MAP_WIDTH / 2;
  const usable = MAP_WIDTH - 2 * MARGIN;
  return MARGIN + (usable * index) / (count - 1);
}

function rows<T>(list: T[], perRow: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += perRow) out.push(list.slice(i, i + perRow));
  return out;
}

export function layoutNetMap(nodes: MapNode[]): { placed: PlacedNode[]; lines: MapLine[]; height: number } {
  const gateway = nodes.find((n) => n.role === "gateway");
  const servers = nodes.filter((n) => n.role === "server");
  const devices = nodes.filter((n) => n.role === "device");

  const placed: PlacedNode[] = [];
  const lines: MapLine[] = [];
  const internet: PlacedNode = { key: "internet", label: "Internet", short: "Internet", state: gateway?.state === "bad" ? "unknown" : "ok", role: "device", x: MAP_WIDTH / 2, y: 20, r: 7 };
  const hub: PlacedNode | null = gateway ? { ...gateway, x: MAP_WIDTH / 2, y: 78, r: 16 } : null;
  let y = hub ? 78 : 20;

  const connect = (a: PlacedNode, b: PlacedNode) => lines.push({ from: a.key, to: b.key, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  if (hub) connect(internet, hub);
  const root = hub ?? internet;

  for (const row of rows(servers, PER_ROW.server)) {
    y += 84;
    row.forEach((n, i) => {
      const p: PlacedNode = { ...n, x: spread(row.length, i), y, r: 25 };
      placed.push(p);
      connect(root, p);
    });
  }
  for (const row of rows(devices, PER_ROW.device)) {
    y += servers.length > 0 || placed.length > 0 ? 70 : 76;
    row.forEach((n, i) => {
      const p: PlacedNode = { ...n, x: spread(row.length, i), y, r: 10 };
      placed.push(p);
      connect(root, p);
    });
  }

  // The internet node is drawn but not selectable content of its own.
  const all = [...(hub ? [hub] : []), ...placed];
  const last = all.reduce((max, n) => Math.max(max, n.y + n.r + (n.r >= 24 ? 12 : 22)), 60);
  return { placed: [{ ...internet }, ...all], lines, height: Math.round(last) };
}
