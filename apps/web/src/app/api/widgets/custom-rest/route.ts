import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type CustomRestTile = {
  label: string;
  path: string;
  unit?: string;
};

export type CustomRestSettings = {
  url?: string;
  method?: "GET" | "POST";
  headers?: { key: string; value: string }[];
  body?: string;
  displayMode?: "tiles" | "single" | "raw";
  tiles?: CustomRestTile[];
};

export type CustomRestWidgetData = {
  ok: boolean;
  status?: number;
  error?: string;
  raw?: unknown;
  resolvedTiles?: { label: string; value: string; unit?: string }[];
};

/** Minimal JSONPath — supports $.key, $.a.b.c, $[0], $.arr[2].name */
function jsonPath(data: unknown, path: string): unknown {
  if (!path.startsWith("$")) return undefined;
  const parts = path
    .slice(1)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: unknown = data;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function isPrivate(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<CustomRestWidgetData>> {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const globalCfg = cfg.integrations.customRest;

  const body = (await req.json()) as CustomRestSettings;
  const { url, method = "GET", headers = [], body: reqBody, displayMode = "tiles", tiles = [] } = body;

  if (!url) {
    return NextResponse.json({ ok: false, error: "Keine URL konfiguriert" });
  }

  // Private-network guard
  if (!globalCfg.allowPrivateNetworks && isPrivate(url)) {
    return NextResponse.json({ ok: false, error: "Private Netzwerk-Adressen sind deaktiviert (Admin → Integrationen → Custom REST)" });
  }

  // Optional host allowlist
  if (globalCfg.allowedHosts.length > 0) {
    try {
      const { hostname } = new URL(url);
      if (!globalCfg.allowedHosts.includes(hostname)) {
        return NextResponse.json({ ok: false, error: `Host "${hostname}" ist nicht in der Allowlist` });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Ungültige URL" });
    }
  }

  const fetchHeaders: Record<string, string> = { accept: "application/json" };
  for (const h of headers) {
    if (h.key.trim()) fetchHeaders[h.key.trim()] = h.value;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: fetchHeaders,
      ...(method === "POST" && reqBody ? { body: reqBody } : {}),
      signal: AbortSignal.timeout(8000),
    });

    const text = await res.text();
    let raw: unknown = text;
    try { raw = JSON.parse(text); } catch { /* keep as string */ }

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: `HTTP ${res.status}`, raw });
    }

    if (displayMode === "raw" || displayMode === "single") {
      return NextResponse.json({ ok: true, status: res.status, raw });
    }

    // Resolve tiles via JSONPath
    const resolvedTiles = tiles.map((t) => {
      const tile: { label: string; value: string; unit?: string } = {
        label: t.label,
        value: stringify(jsonPath(raw, t.path)),
      };
      if (t.unit) tile.unit = t.unit;
      return tile;
    });

    return NextResponse.json({ ok: true, status: res.status, raw, resolvedTiles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verbindungsfehler";
    return NextResponse.json({ ok: false, error: msg });
  }
}
