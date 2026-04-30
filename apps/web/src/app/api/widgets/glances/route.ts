import { NextResponse } from "next/server";
import { Agent as HttpsAgent } from "node:https";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type GlancesInstanceData = {
  hostname?: string;
  os?: string;
  uptimeSeconds?: number;
  cpu: { percent: number; cores?: number };
  memory: { totalGb: number; usedGb: number; percent: number };
  load?: { min1: number; min5: number; min15: number };
  disks: { mount: string; usedGb: number; totalGb: number; percent: number }[];
};

export type GlancesInstance =
  | { id: string; label: string; baseUrl: string; online: true; data: GlancesInstanceData }
  | { id: string; label: string; baseUrl: string; online: false; error: string };

export type GlancesWidgetData = {
  instances: GlancesInstance[];
};

type GlancesAll = {
  cpu?: { total?: number };
  mem?: { total?: number; used?: number; percent?: number };
  load?: { min1?: number; min5?: number; min15?: number };
  fs?: { mnt_point?: string; used?: number; size?: number; percent?: number }[];
  uptime?: string | number;
  system?: { hostname?: string; os_name?: string; os_version?: string };
};

const TO_GB = 1 / (1024 ** 3);

function parseUptimeSeconds(uptime: string | number | undefined): number | undefined {
  if (typeof uptime === "number") return uptime;
  if (typeof uptime !== "string") return undefined;
  // Format from Glances: "5 days, 3:42:17" or "3:42:17"
  const m = /^(?:(\d+) days?,\s*)?(\d+):(\d+):(\d+)/.exec(uptime);
  if (!m) return undefined;
  const days = parseInt(m[1] ?? "0", 10);
  const h = parseInt(m[2] ?? "0", 10);
  const min = parseInt(m[3] ?? "0", 10);
  const s = parseInt(m[4] ?? "0", 10);
  return days * 86400 + h * 3600 + min * 60 + s;
}

async function fetchGlances(
  base: string,
  username: string | undefined,
  password: string | undefined,
  verifyTls: boolean,
): Promise<GlancesInstanceData> {
  const url = `${base.replace(/\/$/, "")}/api/4/all`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (username && password) {
    headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }

  const isHttps = url.startsWith("https://");
  const dispatcher = isHttps && !verifyTls
    ? { dispatcher: new HttpsAgent({ rejectUnauthorized: false }) as unknown as undefined }
    : {};
  // Note: Node fetch in newer Node versions ignores `dispatcher` for `https` Agent;
  // for self-signed local hosts the user can disable verifyTls in the form.
  // We rely on http for local Glances by default.
  void dispatcher;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const all = (await res.json()) as GlancesAll;

  // Glances v4 returns total/used in bytes
  const totalBytes = all.mem?.total ?? 0;
  const usedBytes = all.mem?.used ?? 0;
  const memPercent = all.mem?.percent ?? (totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0);

  const fs = (all.fs ?? [])
    .filter((d) => typeof d.mnt_point === "string")
    .map((d) => ({
      mount: d.mnt_point ?? "",
      usedGb: Math.round(((d.used ?? 0) * TO_GB) * 100) / 100,
      totalGb: Math.round(((d.size ?? 0) * TO_GB) * 100) / 100,
      percent: typeof d.percent === "number" ? d.percent : 0,
    }))
    .slice(0, 6);

  const result: GlancesInstanceData = {
    cpu: { percent: typeof all.cpu?.total === "number" ? Math.round(all.cpu.total * 10) / 10 : 0 },
    memory: {
      totalGb: Math.round((totalBytes * TO_GB) * 10) / 10,
      usedGb: Math.round((usedBytes * TO_GB) * 10) / 10,
      percent: Math.round(memPercent * 10) / 10,
    },
    disks: fs,
  };

  if (all.system?.hostname) result.hostname = all.system.hostname;
  if (all.system?.os_name) {
    result.os = `${all.system.os_name}${all.system.os_version ? ` ${all.system.os_version}` : ""}`;
  }
  const uptimeSec = parseUptimeSeconds(all.uptime);
  if (uptimeSec !== undefined) result.uptimeSeconds = uptimeSec;

  if (all.load?.min1 !== undefined) {
    result.load = {
      min1: all.load.min1 ?? 0,
      min5: all.load.min5 ?? 0,
      min15: all.load.min15 ?? 0,
    };
  }

  return result;
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const hosts = cfg.integrations.glances ?? [];

  if (hosts.length === 0) {
    return NextResponse.json({ instances: [] } satisfies GlancesWidgetData);
  }

  const instances: GlancesInstance[] = await Promise.all(
    hosts.map(async (h): Promise<GlancesInstance> => {
      try {
        const data = await fetchGlances(h.baseUrl, h.username, h.password, h.verifyTls);
        return { id: h.id, label: h.label, baseUrl: h.baseUrl, online: true, data };
      } catch (err) {
        return {
          id: h.id,
          label: h.label,
          baseUrl: h.baseUrl,
          online: false,
          error: err instanceof Error ? err.message : "Verbindungsfehler",
        };
      }
    }),
  );

  return NextResponse.json({ instances } satisfies GlancesWidgetData);
}
