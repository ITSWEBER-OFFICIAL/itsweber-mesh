import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type SpeedtestResult = {
  id: number;
  ping: number;
  download: number; // Mbit/s
  upload: number;   // Mbit/s
  isp: string | null;
  serverName: string | null;
  finishedAt: string; // ISO
};

export type SpeedtestWidgetData = {
  configured: boolean;
  online: boolean;
  error?: string;
  latest: SpeedtestResult | null;
  history: SpeedtestResult[]; // up to 10 latest
};

type RawResult = {
  id: number;
  ping: number | string | null;
  download: number | string | null;
  upload: number | string | null;
  data?: {
    isp?: string;
    server?: { name?: string };
  };
  created_at?: string;
  updated_at?: string;
};

function bitsToMbit(val: number | string | null): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return 0;
  // speedtest-tracker stores bits/s
  return Math.round((n / 1_000_000) * 10) / 10;
}

function mapResult(r: RawResult): SpeedtestResult {
  return {
    id: r.id,
    ping: typeof r.ping === "string" ? parseFloat(r.ping) : (r.ping ?? 0),
    download: bitsToMbit(r.download),
    upload: bitsToMbit(r.upload),
    isp: r.data?.isp ?? null,
    serverName: r.data?.server?.name ?? null,
    finishedAt: r.updated_at ?? r.created_at ?? "",
  };
}

export async function GET(req: Request): Promise<NextResponse<SpeedtestWidgetData>> {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const instances = cfg.integrations.speedtest;
  const st = id ? instances.find((i) => i.id === id) : instances[0];

  if (!st?.baseUrl) {
    return NextResponse.json({ configured: false, online: false, latest: null, history: [] });
  }

  const base = st.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    accept: "application/json",
    ...(st.bearerToken ? { authorization: `Bearer ${st.bearerToken}` } : {}),
  };

  try {
    // Latest result
    const [latestRes, historyRes] = await Promise.all([
      fetch(`${base}/api/v1/results/latest`, { headers, signal: AbortSignal.timeout(6000) }),
      fetch(`${base}/api/v1/results?per_page=10`, { headers, signal: AbortSignal.timeout(6000) }),
    ]);

    if (!latestRes.ok) {
      return NextResponse.json({
        configured: true,
        online: false,
        latest: null,
        history: [],
        error: `HTTP ${latestRes.status}`,
      });
    }

    const latestJson = (await latestRes.json()) as { data?: RawResult };
    const latest = latestJson.data ? mapResult(latestJson.data) : null;

    let history: SpeedtestResult[] = [];
    if (historyRes.ok) {
      const histJson = (await historyRes.json()) as { data?: RawResult[] };
      history = (histJson.data ?? []).map(mapResult).reverse(); // oldest→newest
    }

    return NextResponse.json({ configured: true, online: true, latest, history });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      latest: null,
      history: [],
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    });
  }
}
