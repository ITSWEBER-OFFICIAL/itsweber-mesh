import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type PiholeWidgetData = {
  configured: boolean;
  online: boolean;
  error?: string;
  status: "enabled" | "disabled" | "unknown";
  totalQueries: number;
  blockedQueries: number;
  blockPercent: number;
  domainsOnBlocklist: number;
  clients: number;
  queriesOverTime?: Record<string, number>; // unix-ts → count (last 24h, 10min buckets)
};

type PiholeApiSummary = {
  status?: string;
  dns_queries_today?: number;
  ads_blocked_today?: number;
  ads_percentage_today?: number;
  domains_being_blocked?: number;
  unique_clients?: number;
  domains_over_time?: Record<string, number>;
  ads_over_time?: Record<string, number>;
};

export async function GET(req: Request): Promise<NextResponse<PiholeWidgetData>> {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const instances = cfg.integrations.pihole;
  const ph = id ? instances.find((i) => i.id === id) : instances[0];

  if (!ph?.baseUrl) {
    return NextResponse.json({
      configured: false,
      online: false,
      status: "unknown",
      totalQueries: 0,
      blockedQueries: 0,
      blockPercent: 0,
      domainsOnBlocklist: 0,
      clients: 0,
    });
  }

  const base = ph.baseUrl.replace(/\/+$/, "");
  const tokenParam = ph.apiToken ? `&auth=${encodeURIComponent(ph.apiToken)}` : "";
  const url = `${base}/admin/api.php?summary${tokenParam}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({
        configured: true,
        online: false,
        status: "unknown",
        totalQueries: 0,
        blockedQueries: 0,
        blockPercent: 0,
        domainsOnBlocklist: 0,
        clients: 0,
        error: `HTTP ${res.status}`,
      });
    }

    const data = (await res.json()) as PiholeApiSummary;

    return NextResponse.json({
      configured: true,
      online: true,
      status: data.status === "enabled" ? "enabled" : data.status === "disabled" ? "disabled" : "unknown",
      totalQueries: data.dns_queries_today ?? 0,
      blockedQueries: data.ads_blocked_today ?? 0,
      blockPercent: Math.round((data.ads_percentage_today ?? 0) * 10) / 10,
      domainsOnBlocklist: data.domains_being_blocked ?? 0,
      clients: data.unique_clients ?? 0,
    });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      status: "unknown",
      totalQueries: 0,
      blockedQueries: 0,
      blockPercent: 0,
      domainsOnBlocklist: 0,
      clients: 0,
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    });
  }
}
