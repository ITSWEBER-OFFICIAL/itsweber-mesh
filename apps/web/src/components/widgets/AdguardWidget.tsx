"use client";

import { useQuery } from "@tanstack/react-query";
import { Shield, Wifi, WifiOff } from "lucide-react";
import type { AdguardWidgetData } from "@/app/api/widgets/adguard/route";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="widget-progress-track">
      <div className="widget-progress-fill adguard-fill" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function fmt(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function AdguardWidget({
  label,
  refreshSec,
  linkUrl,
  compact,
}: {
  label: string;
  refreshSec: number;
  linkUrl?: string;
  compact?: boolean;
}) {
  const { data, isLoading } = useQuery<AdguardWidgetData>({
    queryKey: ["widget-adguard"],
    queryFn: () => fetch("/api/widgets/adguard").then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  const href = linkUrl || (data?.online ? data.baseUrl : undefined);

  if (compact && data?.online && data.stats) {
    return (
      <WidgetLinkWrapper href={href} className="widget-card widget-compact">
        <div className="widget-compact-icon adguard-compact-icon">
          <Shield size={22} />
        </div>
        <div className="widget-compact-body">
          <div className="widget-compact-label">{label}</div>
          <div className="widget-compact-value adguard-blockrate">
            {data.stats.blockedPercent.toFixed(1)}%
          </div>
          <div className="widget-compact-sub">
            {fmt(data.stats.blocked)} blockiert von {fmt(data.stats.dnsQueries)}
          </div>
        </div>
      </WidgetLinkWrapper>
    );
  }

  return (
    <WidgetLinkWrapper href={href}>
      <div className="widget-card">
        <span className="widget-accent adguard-accent" />
        <div className="widget-header">
          <Shield size={14} className="adguard-icon" />
          <span className="widget-title">{label}</span>
          {data?.online
            ? <span className="widget-status-ok ml-auto"><Wifi size={10} />Online</span>
            : data?.configured
            ? <span className="widget-status-err ml-auto"><WifiOff size={10} />Offline</span>
            : null
          }
        </div>

        {isLoading && <div className="widget-loading">Verbinde…</div>}

        {data && !data.configured && (
          <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen</strong></div>
        )}

        {data?.configured && !data.online && (
          <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
        )}

        {data?.online && data.stats && (
          <div className="flex flex-col gap-[10px]">
            <div className="flex flex-col gap-[4px]">
              <div className="widget-stat-row">
                <span className="text-[11px]">🛡️</span>
                <span className="widget-stat-label">Blockrate</span>
                <span className="widget-stat-value adguard-blockrate">
                  {data.stats.blockedPercent.toFixed(1)}%
                </span>
              </div>
              <ProgressBar value={data.stats.blockedPercent} />
            </div>

            <div className="widget-divider" />

            <div className="widget-stat-row">
              <span className="text-[11px]">🔍</span>
              <span className="widget-stat-label">DNS-Anfragen</span>
              <span className="widget-stat-value font-mono text-[10px]">
                {fmt(data.stats.dnsQueries)}
              </span>
            </div>
            <div className="widget-stat-row">
              <span className="text-[11px]">❌</span>
              <span className="widget-stat-label">Geblockt</span>
              <span className="widget-stat-value adguard-blocked">
                {fmt(data.stats.blocked)}
              </span>
            </div>
            {data.stats.avgProcessingMs > 0 && (
              <div className="widget-stat-row">
                <span className="text-[11px]">⚡</span>
                <span className="widget-stat-label">Ø Latenz</span>
                <span className="widget-stat-value font-mono text-[10px]">
                  {data.stats.avgProcessingMs.toFixed(2)} ms
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </WidgetLinkWrapper>
  );
}
