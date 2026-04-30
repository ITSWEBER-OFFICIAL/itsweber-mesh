"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, CheckCircle2, Clock, Wrench } from "lucide-react";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";
import { WidgetSkeleton } from "@/components/ui/Skeleton";
import type { UptimeKumaWidgetData, KumaMonitor } from "@/app/api/widgets/uptime-kuma/route";
import type { WidgetRenderProps } from "./registry";

function formatUptime(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function statusColor(status: KumaMonitor["status"]): string {
  switch (status) {
    case "up":          return "var(--status-ok)";
    case "down":        return "var(--status-error)";
    case "pending":     return "var(--status-warn)";
    case "maintenance": return "var(--brand)";
    default:            return "var(--dim)";
  }
}

function HistoryBars({ values }: { values: number[] }) {
  if (!values.length) return null;
  return (
    <div className="kuma-history-bars">
      {values.slice(-30).map((v, i) => (
        <span
          key={i}
          className="kuma-history-bar"
          style={{ background: statusColor(({ 0: "down", 1: "up", 2: "pending", 3: "maintenance" } as const)[v as 0|1|2|3] ?? "unknown") }}
        />
      ))}
    </div>
  );
}

export function UptimeKumaWidget({ instance, compact }: WidgetRenderProps) {
  const { data, isLoading, error } = useQuery<UptimeKumaWidgetData>({
    queryKey: ["widget-uptime-kuma"],
    queryFn: () => fetch("/api/widgets/uptime-kuma").then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: Math.max(1, instance.refreshSec - 2) * 1000,
  });

  if (isLoading) return <WidgetSkeleton compact={compact} label={instance.label} />;

  if (error || !data) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <Activity size={14} />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-error-message">
          {error instanceof Error ? error.message : "Uptime-Kuma-Daten konnten nicht geladen werden"}
        </div>
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="widget-card">
        <span className="widget-accent" />
        <div className="widget-header">
          <Activity size={14} />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-hint">
          Uptime Kuma nicht konfiguriert — setze BaseURL + Status-Page-Slug unter <strong>Admin → Integrationen</strong>.
        </div>
      </div>
    );
  }

  if (!data.online) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <Activity size={14} />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-error-message">{data.error ?? "Uptime Kuma nicht erreichbar"}</div>
      </div>
    );
  }

  /* ── Compact ───────────────────────────────────────────────────────────── */
  if (compact) {
    const allUp = data.totals.down === 0;
    const Icon = allUp ? CheckCircle2 : AlertCircle;
    const color = allUp ? "var(--status-ok)" : "var(--status-error)";
    return (
      <WidgetLinkWrapper href={instance.linkUrl} className="widget-card widget-compact">
        <div className="widget-compact-icon" style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
          <Icon size={22} />
        </div>
        <div className="widget-compact-body">
          <div className="widget-compact-label">Uptime gesamt</div>
          <div className="widget-compact-value">{formatUptime(data.totals.avgUptime30d)}</div>
          <div className="widget-compact-sub">
            {data.totals.up} up · {data.totals.down} down
            {data.totals.maintenance > 0 ? ` · ${data.totals.maintenance} maint.` : ""}
          </div>
        </div>
      </WidgetLinkWrapper>
    );
  }

  /* ── Sidebar ───────────────────────────────────────────────────────────── */
  return (
    <WidgetLinkWrapper href={instance.linkUrl} className="widget-card kuma-widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Activity size={14} />
        <span className="widget-title">{instance.label}</span>
        {data.pageTitle && <span className="widget-badge">{data.pageTitle}</span>}
      </div>

      <div className="kuma-totals">
        <div className="kuma-total-cell" style={{ color: "var(--status-ok)" }}>
          <CheckCircle2 size={12} /> {data.totals.up}
        </div>
        <div className="kuma-total-cell" style={{ color: "var(--status-error)" }}>
          <AlertCircle size={12} /> {data.totals.down}
        </div>
        {data.totals.pending > 0 && (
          <div className="kuma-total-cell" style={{ color: "var(--status-warn)" }}>
            <Clock size={12} /> {data.totals.pending}
          </div>
        )}
        {data.totals.maintenance > 0 && (
          <div className="kuma-total-cell" style={{ color: "var(--brand)" }}>
            <Wrench size={12} /> {data.totals.maintenance}
          </div>
        )}
      </div>

      <ul className="kuma-monitor-list">
        {data.monitors.map((m) => (
          <li key={m.id} className="kuma-monitor-row">
            <span className="kuma-status-dot" style={{ background: statusColor(m.status) }} />
            <div className="kuma-monitor-name">{m.name}</div>
            <div className="kuma-monitor-meta">
              {m.uptime30d !== null && <span>{formatUptime(m.uptime30d)}</span>}
              {m.avgPingMs !== null && <span className="kuma-monitor-ping">{m.avgPingMs}ms</span>}
            </div>
            <HistoryBars values={m.history} />
          </li>
        ))}
      </ul>
    </WidgetLinkWrapper>
  );
}
