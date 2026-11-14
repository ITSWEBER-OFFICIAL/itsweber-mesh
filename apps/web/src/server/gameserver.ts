/* Gameserver-Status aus der öffentlichen Status-API des Gameserver-Projekts.
   Gelesen werden nur die Zahlen, die die API ohne Anmeldung herausgibt. */

export type GameServer = {
  id: string;
  name: string;
  online: boolean;
  state: string;
  version: string | null;
  players: { online: number; max: number | null } | null;
};

export type GameserverStatus = {
  configured: boolean;
  online: boolean;
  /** True when the API itself says its data is old. */
  stale: boolean;
  maintenance: string;
  playersOnline: number;
  servers: GameServer[];
  generatedAt: string | null;
  error?: string;
};

export const NOT_CONFIGURED: GameserverStatus = {
  configured: false,
  online: false,
  stale: false,
  maintenance: "",
  playersOnline: 0,
  servers: [],
  generatedAt: null,
};

type Raw = {
  generatedAt?: unknown;
  stale?: unknown;
  wartung?: unknown;
  totals?: { playersOnline?: unknown };
  servers?: unknown;
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : null);

/** Maps the answer of GET /v1/status. Unknown or missing fields never throw. */
export function parseGameserverStatus(raw: unknown): GameserverStatus {
  const r = (raw && typeof raw === "object" ? raw : {}) as Raw;
  const list = Array.isArray(r.servers) ? r.servers : [];
  const servers: GameServer[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = item as { id?: unknown; name?: unknown; state?: unknown; version?: unknown; players?: { online?: unknown; max?: unknown } | null };
    const id = str(s.id);
    if (!id) continue;
    const state = str(s.state) ?? "unknown";
    const online = int(s.players?.online);
    servers.push({
      id,
      name: str(s.name) ?? id,
      state,
      online: state === "online" || state === "running",
      version: str(s.version),
      players: online !== null ? { online, max: int(s.players?.max) } : null,
    });
  }
  const total = int(r.totals?.playersOnline);
  return {
    configured: true,
    online: true,
    stale: r.stale === true,
    maintenance: str(r.wartung) ?? "",
    playersOnline: total ?? servers.reduce((sum, s) => sum + (s.players?.online ?? 0), 0),
    servers: servers.sort((a, b) => a.name.localeCompare(b.name, "de")),
    generatedAt: str(r.generatedAt),
  };
}

/** Accepts the base address or the full status address. */
export function statusEndpoint(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!/\/v1\/status\/?$/.test(u.pathname)) u.pathname = u.pathname.replace(/\/+$/, "") + "/v1/status";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

const TTL_MS = 15_000;
let cache: { at: number; url: string; value: GameserverStatus } | null = null;

export async function loadGameserverStatus(statusUrl: string | undefined, now: number = Date.now()): Promise<GameserverStatus> {
  if (!statusUrl) return NOT_CONFIGURED;
  const url = statusEndpoint(statusUrl);
  if (!url) return { ...NOT_CONFIGURED, configured: true, error: "Die Adresse ist ungültig" };
  if (cache && cache.url === url && now - cache.at < TTL_MS) return cache.value;
  let value: GameserverStatus;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    value = parseGameserverStatus(await res.json());
  } catch (err) {
    value = { ...NOT_CONFIGURED, configured: true, error: err instanceof Error ? err.message : "Keine Antwort" };
  }
  cache = { at: now, url, value };
  return value;
}
