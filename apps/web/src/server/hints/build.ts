/* Hinweise „Im Blick“ und Sicherheit. Reine Funktionen, die aus den Rohdaten
   der Quellen Meldungen bauen. Dienste, die nicht antworten, kommen weiter aus
   dem Healthcheck und stehen nicht hier. */

export type HintLevel = "urgent" | "watch";
export type HintKind = "cert" | "update" | "container" | "server" | "array";

export type Hint = {
  /** Stable across polls, so a later push can tell new from known. */
  id: string;
  level: HintLevel;
  kind: HintKind;
  title: string;
  detail: string;
  /** System the hint belongs to, e.g. the Unraid label or "Home Assistant". */
  system?: string;
};

export type SourceState = { source: "certs" | "homeAssistant" | "unraid"; ok: boolean; note?: string };

/* ── Zertifikate ─────────────────────────────────────────────────────────── */

export type CertProbe =
  | { host: string; ok: true; validTo: number }
  | { host: string; ok: false; error: string };

export const CERT_WATCH_DAYS = 21;
export const CERT_URGENT_DAYS = 3;
const DAY_MS = 86_400_000;

export function certHints(probes: CertProbe[], now: number): Hint[] {
  const out: Hint[] = [];
  for (const p of probes) {
    // A host that cannot be reached already shows up as a failing service.
    if (!p.ok) continue;
    const days = Math.floor((p.validTo - now) / DAY_MS);
    if (days >= CERT_WATCH_DAYS) continue;
    const date = new Date(p.validTo).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    if (p.validTo <= now) {
      out.push({ id: `cert:${p.host}`, level: "urgent", kind: "cert", title: `Zertifikat von ${p.host} ist abgelaufen`, detail: `Seit ${date}` });
    } else {
      out.push({
        id: `cert:${p.host}`,
        level: days < CERT_URGENT_DAYS ? "urgent" : "watch",
        kind: "cert",
        title: `Zertifikat von ${p.host} läuft ab`,
        detail: days <= 0 ? `Heute, ${date}` : days === 1 ? `Morgen, ${date}` : `In ${days} Tagen, ${date}`,
      });
    }
  }
  return out;
}

/** Distinct https hosts worth a certificate check. Addresses without a real
 *  host name (IPs) use self-signed certificates and are skipped. */
export function certHosts(urls: (string | undefined)[]): string[] {
  const hosts = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:") continue;
      if (/^[\d.]+$/.test(u.hostname) || u.hostname.includes(":")) continue;
      if (u.hostname === "localhost" || u.hostname.endsWith(".local")) continue;
      hosts.add(u.port && u.port !== "443" ? `${u.hostname}:${u.port}` : u.hostname);
    } catch {
      // not a URL, nothing to check
    }
  }
  return [...hosts].sort();
}

/* ── Updates aus Home Assistant ──────────────────────────────────────────── */

export type HaUpdateEntity = {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    title?: string | null;
    installed_version?: string | null;
    latest_version?: string | null;
    skipped_version?: string | null;
  };
};

export function haUpdateHints(entities: HaUpdateEntity[]): Hint[] {
  return entities
    .filter((e) => e.entity_id.startsWith("update.") && e.state === "on")
    .filter((e) => !e.attributes.skipped_version || e.attributes.skipped_version !== e.attributes.latest_version)
    .map((e) => {
      const name = (e.attributes.title || e.attributes.friendly_name || e.entity_id.slice(7)).replace(/\s+Update$/i, "");
      const from = e.attributes.installed_version;
      const to = e.attributes.latest_version;
      return {
        id: `update:${e.entity_id}`,
        level: "watch" as const,
        kind: "update" as const,
        title: `Update für ${name}`,
        detail: from && to ? `${from} auf ${to}` : to ? `Version ${to}` : "Neue Version verfügbar",
        system: "Home Assistant",
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
}

/* ── Unraid ──────────────────────────────────────────────────────────────── */

export type UnraidHintInput =
  | { id: string; label: string; online: false }
  | {
      id: string;
      label: string;
      online: true;
      data: { array?: { state: string }; containers?: { running: number; total: number; stopped?: string[] } };
    };

const MAX_NAMES = 4;

export function unraidHints(instances: UnraidHintInput[]): Hint[] {
  const out: Hint[] = [];
  for (const i of instances) {
    if (!i.online) {
      out.push({ id: `server:${i.id}`, level: "urgent", kind: "server", title: `${i.label} antwortet nicht`, detail: "Die Unraid-Schnittstelle ist nicht erreichbar", system: i.label });
      continue;
    }
    const state = i.data.array?.state;
    if (state && state !== "STARTED") {
      out.push({ id: `array:${i.id}`, level: "urgent", kind: "array", title: `Array auf ${i.label} läuft nicht`, detail: `Zustand ${state}`, system: i.label });
    }
    const c = i.data.containers;
    const stoppedCount = c ? c.total - c.running : 0;
    if (c && stoppedCount > 0) {
      const names = c.stopped ?? [];
      const shown = names.slice(0, MAX_NAMES).join(", ");
      const rest = names.length - MAX_NAMES;
      out.push({
        id: `container:${i.id}`,
        level: "watch",
        kind: "container",
        title: stoppedCount === 1 ? `1 Container auf ${i.label} gestoppt` : `${stoppedCount} Container auf ${i.label} gestoppt`,
        detail: names.length === 0 ? `${c.running} von ${c.total} laufen` : rest > 0 ? `${shown} und ${rest} weitere` : shown,
        system: i.label,
      });
    }
  }
  return out;
}

/* ── Zusammenführen ──────────────────────────────────────────────────────── */

export function sortHints(hints: Hint[]): Hint[] {
  const rank: Record<HintLevel, number> = { urgent: 0, watch: 1 };
  const kind: Record<HintKind, number> = { server: 0, array: 1, cert: 2, container: 3, update: 4 };
  return [...hints].sort((a, b) => rank[a.level] - rank[b.level] || kind[a.kind] - kind[b.kind] || a.title.localeCompare(b.title, "de"));
}
