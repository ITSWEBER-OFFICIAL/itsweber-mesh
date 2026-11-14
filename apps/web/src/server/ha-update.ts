/* Update in Home Assistant anstoßen (Dienst update.install).
   Geprüft wird vorher gegen den aktuellen Stand von Home Assistant: nur eine
   Update-Entität, die es gibt und die gerade ein Update meldet. */
import type { HaUpdateEntity } from "./hints/build";

export const HA_UPDATE_WAIT_MS = 20_000;
const HA_UPDATE_TIMEOUT_MS = 30 * 60 * 1000;
const ENTITY_RE = /^update\.[a-z0-9_]{1,120}$/;

export type HaOutcome = {
  result: "ok" | "failed" | "refused";
  name: string;
  detail?: string;
  pending?: Promise<HaOutcome>;
};

export type HaApi = {
  states: () => Promise<HaUpdateEntity[]>;
  install: (entityId: string, timeoutMs: number) => Promise<void>;
};

export function haApi(baseUrl: string, token: string, doFetch: typeof fetch = fetch): HaApi {
  const base = baseUrl.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    states: async () => {
      const res = await doFetch(`${base}/api/states`, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Home Assistant antwortet mit Status ${res.status}`);
      return (await res.json()) as HaUpdateEntity[];
    },
    install: async (entityId, timeoutMs) => {
      const res = await doFetch(`${base}/api/services/update/install`, {
        method: "POST",
        headers,
        body: JSON.stringify({ entity_id: entityId }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`Home Assistant antwortet mit Status ${res.status}`);
    },
  };
}

export function updateName(e: HaUpdateEntity): string {
  return (e.attributes.title || e.attributes.friendly_name || e.entity_id.slice(7)).replace(/\s+Update$/i, "");
}

export async function runHaUpdate(api: HaApi, entityId: string, waitMs: number = HA_UPDATE_WAIT_MS): Promise<HaOutcome> {
  if (!ENTITY_RE.test(entityId)) return { result: "refused", name: entityId.slice(0, 80), detail: "Ungültige Kennung" };
  let states: HaUpdateEntity[];
  try {
    states = await api.states();
  } catch (err) {
    return { result: "failed", name: entityId, detail: err instanceof Error ? err.message : "Home Assistant antwortet nicht" };
  }
  const entity = states.find((e) => e.entity_id === entityId);
  if (!entity) return { result: "refused", name: entityId, detail: "Dieses Update gibt es in Home Assistant nicht mehr" };
  const name = updateName(entity);
  if (entity.state !== "on") return { result: "refused", name, detail: `Für ${name} steht kein Update an` };

  const final: Promise<HaOutcome> = api.install(entityId, HA_UPDATE_TIMEOUT_MS).then(
    (): HaOutcome => ({ result: "ok", name }),
    // Updating Home Assistant itself restarts it and cuts this very connection.
    (err): HaOutcome => ({ result: "failed", name, detail: err instanceof Error ? err.message : "Verbindung abgebrochen" }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = await Promise.race([
    final,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), waitMs);
    }),
  ]);
  if (timer) clearTimeout(timer);
  return waited ?? { result: "ok", name, detail: "Update läuft noch", pending: final };
}
