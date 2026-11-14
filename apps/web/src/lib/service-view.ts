import type { Service, ServiceCategory, ServiceProtection } from "@/server/config/schema";

/** Mesh 2.0: pure view helpers for Start and Dienste. No React, no server imports. */

export type Health = "ok" | "bad" | "unknown";

export const CATEGORY_ORDER: ServiceCategory[] = [
  "infrastructure",
  "smart-home",
  "media",
  "web",
  "gaming",
  "tools",
  "external",
];

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  infrastructure: "Verwaltung",
  "smart-home": "Zuhause",
  media: "Medien",
  web: "Web",
  gaming: "Gaming",
  tools: "Werkzeuge",
  external: "Extern",
};

/** Short uppercase label for the ring. */
export const CATEGORY_SHORT: Record<ServiceCategory, string> = {
  infrastructure: "VERW",
  "smart-home": "HEIM",
  media: "MEDIEN",
  web: "WEB",
  gaming: "GAME",
  tools: "TOOLS",
  external: "EXTERN",
};

export const PROTECTION_TAG: Record<ServiceProtection, string | null> = {
  authentik: "AUTHENTIK",
  login: "LOGIN",
  public: "OFFEN",
  unknown: null,
};

type PingLike = { status: "online" | "offline" | "unknown"; statusCode?: number } | null | undefined;

export function healthOf(service: Service, ping: PingLike): Health {
  if (service.pingTarget.kind === "none" || !ping || ping.status === "unknown") return "unknown";
  return ping.status === "online" ? "ok" : "bad";
}

/**
 * Picks the address that works from where the user is. At home the internal
 * address wins, on the road only an external one is reachable.
 */
export function pickUrl(
  service: Pick<Service, "url" | "urlInternal" | "urlExternal">,
  internal: boolean,
): { href: string; homeOnly: boolean } {
  if (internal) {
    return { href: service.urlInternal ?? service.urlExternal ?? service.url, homeOnly: false };
  }
  if (service.urlExternal) return { href: service.urlExternal, homeOnly: false };
  return { href: service.url, homeOnly: Boolean(service.urlInternal) };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export type Segment = {
  category: ServiceCategory;
  label: string;
  short: string;
  total: number;
  ok: number;
  bad: number;
  state: Health;
  badNames: string[];
};

export type Overview = {
  total: number;
  ok: number;
  bad: number;
  unknown: number;
  segments: Segment[];
};

/** Every enabled service counts, also interfaces without a UI. */
export function buildOverview(
  services: Service[],
  pings: Record<string, PingLike>,
): Overview {
  const enabled = services.filter((s) => s.enabled);
  const segments: Segment[] = [];
  let ok = 0;
  let bad = 0;
  for (const category of CATEGORY_ORDER) {
    const list = enabled.filter((s) => s.category === category);
    if (list.length === 0) continue;
    const seg: Segment = {
      category,
      label: CATEGORY_LABEL[category],
      short: CATEGORY_SHORT[category],
      total: list.length,
      ok: 0,
      bad: 0,
      state: "unknown",
      badNames: [],
    };
    for (const s of list) {
      const h = healthOf(s, pings[s.id]);
      if (h === "ok") seg.ok++;
      if (h === "bad") {
        seg.bad++;
        seg.badNames.push(s.name);
      }
    }
    seg.state = seg.bad > 0 ? "bad" : seg.ok > 0 ? "ok" : "unknown";
    ok += seg.ok;
    bad += seg.bad;
    segments.push(seg);
  }
  return { total: enabled.length, ok, bad, unknown: enabled.length - ok - bad, segments };
}

const NUMBER_WORDS = ["Kein", "Ein", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun", "Zehn"];

/** The situation as one sentence, split so the second half can be dimmed. */
export function situation(o: Overview): { lead: string; rest: string } {
  if (o.total === 0) return { lead: "Noch keine Dienste angelegt.", rest: "" };
  const lead = `${o.ok} von ${o.total} Diensten laufen.`;
  if (o.bad === 0) {
    return { lead, rest: o.unknown > 0 ? `${o.unknown} ohne Prüfung.` : "Nichts braucht dich." };
  }
  const word = NUMBER_WORDS[o.bad] ?? String(o.bad);
  return { lead, rest: o.bad === 1 ? "Ein Dienst antwortet nicht." : `${word} Dienste antworten nicht.` };
}

export function segmentSentence(seg: Segment): { lead: string; rest: string } {
  const lead = `${seg.label}, ${seg.ok} von ${seg.total} laufen.`;
  if (seg.bad === 0) return { lead, rest: "Keine Störung." };
  const names = seg.badNames.slice(0, 2).join(seg.badNames.length === 2 ? " und " : ", ");
  const more = seg.badNames.length > 2 ? ` und ${seg.badNames.length - 2} weitere` : "";
  return { lead, rest: `${names}${more} ${seg.bad === 1 ? "antwortet" : "antworten"} nicht.` };
}
