import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type AdguardWidgetData = {
  configured: boolean;
  online: boolean;
  baseUrl?: string;
  stats?: {
    dnsQueries: number;
    blocked: number;
    blockedSafebrowsing: number;
    blockedParental: number;
    blockedPercent: number;
    avgProcessingMs: number;
  };
  protection?: {
    enabled: boolean;
    safebrowsingEnabled: boolean;
    parentalEnabled: boolean;
  };
  error?: string;
};

/* AdGuard /control/stats response shape (relevant subset) */
type AgStats = {
  dns_queries?: number[];
  blocked_filtering?: number[];
  replaced_safebrowsing?: number[];
  replaced_parental?: number[];
  num_dns_queries?: number;
  num_blocked_filtering?: number;
  num_replaced_safebrowsing?: number;
  num_replaced_parental?: number;
  avg_processing_time?: number;
};

/* AdGuard /control/status response shape (relevant subset) */
type AgStatus = {
  protection_enabled?: boolean;
  running?: boolean;
};

function sumArray(a: number[] | undefined): number {
  if (!Array.isArray(a)) return 0;
  return a.reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const ag = cfg.integrations.adguard;

  if (!ag?.baseUrl) {
    return NextResponse.json({ configured: false, online: false } satisfies AdguardWidgetData);
  }

  try {
    const base = ag.baseUrl.replace(/\/$/, "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (ag.username && ag.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${ag.username}:${ag.password}`).toString("base64")}`;
    }

    const [statsRes, statusRes] = await Promise.all([
      fetch(`${base}/control/stats`, { headers, signal: AbortSignal.timeout(5000) }),
      fetch(`${base}/control/status`, { headers, signal: AbortSignal.timeout(5000) }),
    ]);

    if (!statsRes.ok) throw new Error(`HTTP ${statsRes.status}`);

    const data = (await statsRes.json()) as AgStats;
    const status = statusRes.ok ? ((await statusRes.json()) as AgStatus) : {};

    // Prefer scalar `num_*` fields. Fall back to summing the time-series arrays.
    const dnsQueries = data.num_dns_queries ?? sumArray(data.dns_queries);
    const blocked = data.num_blocked_filtering ?? sumArray(data.blocked_filtering);
    const blockedSafebrowsing = data.num_replaced_safebrowsing ?? sumArray(data.replaced_safebrowsing);
    const blockedParental = data.num_replaced_parental ?? sumArray(data.replaced_parental);

    const blockedTotal = blocked + blockedSafebrowsing + blockedParental;
    const blockedPercent = dnsQueries > 0
      ? Math.round((blockedTotal / dnsQueries) * 1000) / 10
      : 0;

    const result: AdguardWidgetData = {
      configured: true,
      online: true,
      baseUrl: ag.baseUrl,
      stats: {
        dnsQueries,
        blocked,
        blockedSafebrowsing,
        blockedParental,
        blockedPercent,
        avgProcessingMs: Math.round((data.avg_processing_time ?? 0) * 1000 * 100) / 100,
      },
      protection: {
        enabled: status.protection_enabled ?? true,
        safebrowsingEnabled: false,
        parentalEnabled: false,
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      baseUrl: ag.baseUrl,
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    } satisfies AdguardWidgetData);
  }
}
