import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type KumaMonitor = {
  id: number;
  name: string;
  status: "up" | "down" | "pending" | "maintenance" | "unknown";
  uptime24h: number | null;       // 0..1
  uptime30d: number | null;       // 0..1
  avgPingMs: number | null;
  /** Last 30 heartbeat status values (0/1/2/3) for sparkline */
  history: number[];
};

export type UptimeKumaWidgetData = {
  configured: boolean;
  online: boolean;
  error?: string;
  pageTitle?: string;
  monitors: KumaMonitor[];
  totals: {
    up: number;
    down: number;
    pending: number;
    maintenance: number;
    unknown: number;
    avgUptime24h: number;        // 0..1
    avgUptime30d: number;        // 0..1
  };
};

/* Kuma payload shapes (verified against louislam/uptime-kuma v1 — see plan recherche) */
type KumaStatusPage = {
  config?: { title?: string };
  publicGroupList?: Array<{
    id: number;
    name: string;
    monitorList: Array<{ id: number; name: string; type?: string }>;
  }>;
};

type KumaHeartbeat = { status: 0 | 1 | 2 | 3; ping: number | null; time: string; msg?: string };
type KumaHeartbeatResp = {
  heartbeatList: Record<string, KumaHeartbeat[]>;
  uptimeList: Record<string, number>;
};

const STATUS_MAP: Record<number, KumaMonitor["status"]> = {
  0: "down",
  1: "up",
  2: "pending",
  3: "maintenance",
};

function emptyData(): UptimeKumaWidgetData {
  return {
    configured: false,
    online: false,
    monitors: [],
    totals: { up: 0, down: 0, pending: 0, maintenance: 0, unknown: 0, avgUptime24h: 0, avgUptime30d: 0 },
  };
}

export async function GET(req: Request): Promise<NextResponse<UptimeKumaWidgetData>> {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const k = cfg.integrations.uptimeKuma;

  if (!k.baseUrl || !k.statusPageSlug) {
    return NextResponse.json({ ...emptyData(), configured: false });
  }

  const baseUrl = k.baseUrl.replace(/\/+$/, "");
  const slug = encodeURIComponent(k.statusPageSlug);

  try {
    const [pageRes, hbRes] = await Promise.all([
      fetch(`${baseUrl}/api/status-page/${slug}`, {
        signal: AbortSignal.timeout(5000),
        headers: { accept: "application/json" },
      }),
      fetch(`${baseUrl}/api/status-page/heartbeat/${slug}`, {
        signal: AbortSignal.timeout(5000),
        headers: { accept: "application/json" },
      }),
    ]);

    if (!pageRes.ok || !hbRes.ok) {
      return NextResponse.json({
        ...emptyData(),
        configured: true,
        online: false,
        error: `Kuma HTTP ${pageRes.status}/${hbRes.status} — Status-Page öffentlich?`,
      });
    }

    const page = (await pageRes.json()) as KumaStatusPage;
    const hb = (await hbRes.json()) as KumaHeartbeatResp;

    const monitors: KumaMonitor[] = [];
    for (const group of page.publicGroupList ?? []) {
      for (const mon of group.monitorList ?? []) {
        const beats = hb.heartbeatList?.[String(mon.id)] ?? [];
        const last = beats[beats.length - 1];
        const status = last ? (STATUS_MAP[last.status] ?? "unknown") : "unknown";
        const pings = beats.map((b) => b.ping).filter((p): p is number => typeof p === "number" && p >= 0);
        const avgPing = pings.length > 0 ? pings.reduce((a, b) => a + b, 0) / pings.length : null;
        const uptime24h = hb.uptimeList?.[`${mon.id}_24`];
        const uptime30d = hb.uptimeList?.[`${mon.id}_720`];
        monitors.push({
          id: mon.id,
          name: mon.name,
          status,
          uptime24h: typeof uptime24h === "number" ? uptime24h : null,
          uptime30d: typeof uptime30d === "number" ? uptime30d : null,
          avgPingMs: avgPing !== null ? Math.round(avgPing) : null,
          history: beats.slice(-30).map((b) => b.status),
        });
      }
    }

    const totals = monitors.reduce(
      (acc, m) => {
        acc[m.status] += 1;
        if (m.uptime24h !== null) {
          acc._sum24 += m.uptime24h;
          acc._n24 += 1;
        }
        if (m.uptime30d !== null) {
          acc._sum30 += m.uptime30d;
          acc._n30 += 1;
        }
        return acc;
      },
      { up: 0, down: 0, pending: 0, maintenance: 0, unknown: 0, _sum24: 0, _n24: 0, _sum30: 0, _n30: 0 },
    );

    const data: UptimeKumaWidgetData = {
      configured: true,
      online: true,
      ...(page.config?.title ? { pageTitle: page.config.title } : {}),
      monitors,
      totals: {
        up: totals.up,
        down: totals.down,
        pending: totals.pending,
        maintenance: totals.maintenance,
        unknown: totals.unknown,
        avgUptime24h: totals._n24 > 0 ? totals._sum24 / totals._n24 : 0,
        avgUptime30d: totals._n30 > 0 ? totals._sum30 / totals._n30 : 0,
      },
    };

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({
      ...emptyData(),
      configured: true,
      online: false,
      error: err instanceof Error ? err.message : "Kuma-Verbindung fehlgeschlagen",
    });
  }
}
