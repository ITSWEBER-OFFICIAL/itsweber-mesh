"use client";

import { useQuery } from "@tanstack/react-query";
import { Shield, WifiOff } from "lucide-react";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";
import { WidgetSkeleton } from "@/components/ui/Skeleton";
import type { PiholeWidgetData } from "@/app/api/widgets/pihole/route";
import type { WidgetRenderProps } from "./registry";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="widget-progress-track">
      <div className="pihole-bar-fill" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function PiholeWidget({ instance, compact }: WidgetRenderProps) {
  const integrationId =
    typeof instance.settings?.["integrationId"] === "string"
      ? instance.settings["integrationId"]
      : Array.isArray(instance.settings?.["integrationIds"]) && typeof instance.settings["integrationIds"][0] === "string"
      ? instance.settings["integrationIds"][0]
      : undefined;
  const url = integrationId ? `/api/widgets/pihole?id=${integrationId}` : "/api/widgets/pihole";
  const { data, isLoading } = useQuery<PiholeWidgetData>({
    queryKey: ["widget-pihole", integrationId],
    queryFn: () => fetch(url).then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: Math.max(1, instance.refreshSec - 2) * 1000,
  });

  if (isLoading) return <WidgetSkeleton compact={compact} label={instance.label} />;

  if (!data?.configured) {
    return (
      <div className="widget-card">
        <span className="widget-accent pihole-accent" />
        <div className="widget-header">
          <Shield size={14} className="pihole-icon" />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen</strong></div>
      </div>
    );
  }

  if (!data.online) {
    return (
      <div className="widget-card">
        <span className="widget-accent pihole-accent" />
        <div className="widget-header">
          <Shield size={14} className="pihole-icon" />
          <span className="widget-title">{instance.label}</span>
          <span className="widget-status-err ml-auto"><WifiOff size={10} />Offline</span>
        </div>
        <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
      </div>
    );
  }

  const statusOk = data.status === "enabled";

  if (compact) {
    return (
      <WidgetLinkWrapper href={instance.linkUrl} className="widget-card widget-compact">
        <div
          className="widget-compact-icon"
          style={{
            color: statusOk ? "var(--pihole-color)" : "var(--status-error)",
            background: statusOk
              ? "color-mix(in srgb, var(--pihole-color) 15%, transparent)"
              : "color-mix(in srgb, var(--status-error) 15%, transparent)",
          }}
        >
          <Shield size={22} />
        </div>
        <div className="widget-compact-body">
          <div className="widget-compact-label">Pi-hole</div>
          <div className="widget-compact-value">{data.blockPercent}%</div>
          <div className="widget-compact-sub">{fmt(data.blockedQueries)} geblockt · {fmt(data.totalQueries)} gesamt</div>
        </div>
      </WidgetLinkWrapper>
    );
  }

  return (
    <WidgetLinkWrapper href={instance.linkUrl} className="widget-card">
      <span className="widget-accent pihole-accent" />
      <div className="widget-header">
        <Shield size={14} className="pihole-icon" />
        <span className="widget-title">{instance.label}</span>
        <span className={`ml-auto ${statusOk ? "widget-status-ok" : "widget-status-err"}`}>
          <Shield size={10} />{statusOk ? "Aktiv" : "Deaktiviert"}
        </span>
      </div>

      <div className="flex flex-col gap-[10px]">
        {/* Block-Rate */}
        <div className="flex flex-col gap-[4px]">
          <div className="widget-stat-row">
            <span className="text-[11px]">🛡️</span>
            <span className="widget-stat-label">Blockrate</span>
            <span className="widget-stat-value pihole-blockrate">{data.blockPercent}%</span>
          </div>
          <ProgressBar value={data.blockPercent} />
        </div>

        <div className="widget-divider" />

        <div className="widget-stat-row">
          <span className="text-[11px]">🔍</span>
          <span className="widget-stat-label">DNS-Anfragen</span>
          <span className="widget-stat-value font-mono text-[10px]">{fmt(data.totalQueries)}</span>
        </div>
        <div className="widget-stat-row">
          <span className="text-[11px]">❌</span>
          <span className="widget-stat-label">Geblockt</span>
          <span className="widget-stat-value pihole-blocked">{fmt(data.blockedQueries)}</span>
        </div>
        <div className="widget-stat-row">
          <span className="text-[11px]">📋</span>
          <span className="widget-stat-label">Blockliste</span>
          <span className="widget-stat-value font-mono text-[10px]">{fmt(data.domainsOnBlocklist)}</span>
        </div>
        {data.clients > 0 && (
          <div className="widget-stat-row">
            <span className="text-[11px]">💻</span>
            <span className="widget-stat-label">Clients</span>
            <span className="widget-stat-value font-mono text-[10px]">{data.clients}</span>
          </div>
        )}
      </div>
    </WidgetLinkWrapper>
  );
}
