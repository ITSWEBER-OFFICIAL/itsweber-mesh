"use client";

import { useQuery } from "@tanstack/react-query";
import { Zap, WifiOff } from "lucide-react";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";
import { WidgetSkeleton } from "@/components/ui/Skeleton";
import type { SpeedtestWidgetData, SpeedtestResult } from "@/app/api/widgets/speedtest/route";
import type { WidgetRenderProps } from "./registry";

function timeAgo(iso: string): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function SpeedBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="widget-progress-track">
      <div className="speedtest-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function MiniChart({ results }: { results: SpeedtestResult[] }) {
  if (results.length < 2) return null;
  const maxDl = Math.max(...results.map((r) => r.download), 1);
  return (
    <div className="speedtest-chart">
      {results.map((r, i) => (
        <div
          key={i}
          className="speedtest-chart-bar"
          title={`↓${r.download} ↑${r.upload} Mbit/s`}
          style={{ height: `${Math.max(4, (r.download / maxDl) * 32)}px` }}
        />
      ))}
    </div>
  );
}

export function SpeedtestWidget({ instance, compact }: WidgetRenderProps) {
  const integrationId =
    typeof instance.settings?.["integrationId"] === "string"
      ? instance.settings["integrationId"]
      : Array.isArray(instance.settings?.["integrationIds"]) && typeof instance.settings["integrationIds"][0] === "string"
      ? instance.settings["integrationIds"][0]
      : undefined;
  const url = integrationId ? `/api/widgets/speedtest?id=${integrationId}` : "/api/widgets/speedtest";
  const { data, isLoading } = useQuery<SpeedtestWidgetData>({
    queryKey: ["widget-speedtest", integrationId],
    queryFn: () => fetch(url).then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: Math.max(1, instance.refreshSec - 2) * 1000,
  });

  if (isLoading) return <WidgetSkeleton compact={compact} label={instance.label} />;

  if (!data?.configured) {
    return (
      <div className="widget-card">
        <span className="widget-accent speedtest-accent" />
        <div className="widget-header">
          <Zap size={14} className="speedtest-icon" />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen</strong></div>
      </div>
    );
  }

  if (!data.online) {
    return (
      <div className="widget-card">
        <span className="widget-accent speedtest-accent" />
        <div className="widget-header">
          <Zap size={14} className="speedtest-icon" />
          <span className="widget-title">{instance.label}</span>
          <span className="widget-status-err ml-auto"><WifiOff size={10} />Offline</span>
        </div>
        <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
      </div>
    );
  }

  const r = data.latest;
  const maxSpeed = Math.max(r?.download ?? 0, r?.upload ?? 0, 100);

  if (compact) {
    return (
      <WidgetLinkWrapper href={instance.linkUrl} className="widget-card widget-compact">
        <div className="widget-compact-icon speedtest-compact-icon">
          <Zap size={22} />
        </div>
        <div className="widget-compact-body">
          <div className="widget-compact-label">{r?.serverName ?? "Speedtest"}</div>
          <div className="widget-compact-value speedtest-value">
            {r ? `↓${r.download} ↑${r.upload}` : "—"} Mbit/s
          </div>
          {r && <div className="widget-compact-sub">Ping {r.ping}ms · {timeAgo(r.finishedAt)} ago</div>}
        </div>
      </WidgetLinkWrapper>
    );
  }

  return (
    <WidgetLinkWrapper href={instance.linkUrl} className="widget-card">
      <span className="widget-accent speedtest-accent" />
      <div className="widget-header">
        <Zap size={14} className="speedtest-icon" />
        <span className="widget-title">{instance.label}</span>
        <span className="widget-status-ok ml-auto">
          <Zap size={10} />Online
        </span>
      </div>

      {r ? (
        <div className="flex flex-col gap-[10px]">
          {/* Download */}
          <div className="flex flex-col gap-[4px]">
            <div className="widget-stat-row">
              <span className="text-[11px]">↓</span>
              <span className="widget-stat-label">Download</span>
              <span className="widget-stat-value speedtest-dl">{r.download} Mbit/s</span>
            </div>
            <SpeedBar value={r.download} max={maxSpeed} color="var(--status-ok)" />
          </div>

          {/* Upload */}
          <div className="flex flex-col gap-[4px]">
            <div className="widget-stat-row">
              <span className="text-[11px]">↑</span>
              <span className="widget-stat-label">Upload</span>
              <span className="widget-stat-value speedtest-ul">{r.upload} Mbit/s</span>
            </div>
            <SpeedBar value={r.upload} max={maxSpeed} color="var(--brand)" />
          </div>

          <div className="widget-divider" />

          <div className="widget-stat-row">
            <span className="text-[11px]">📡</span>
            <span className="widget-stat-label">Ping</span>
            <span className="widget-stat-value font-mono text-[10px]">{r.ping} ms</span>
          </div>
          {r.isp && (
            <div className="widget-stat-row">
              <span className="text-[11px]">🏢</span>
              <span className="widget-stat-label">ISP</span>
              <span className="widget-stat-value font-mono text-[10px] truncate max-w-[90px]">{r.isp}</span>
            </div>
          )}
          <div className="widget-stat-row">
            <span className="text-[11px]">🕐</span>
            <span className="widget-stat-label">Letzter Test</span>
            <span className="widget-stat-value font-mono text-[10px]">{timeAgo(r.finishedAt)} ago</span>
          </div>

          {data.history.length > 1 && (
            <>
              <div className="widget-divider" />
              <div className="text-[9px] text-[var(--dim)] uppercase tracking-wide">Verlauf ↓</div>
              <MiniChart results={data.history} />
            </>
          )}
        </div>
      ) : (
        <div className="widget-hint">Noch kein Speedtest-Ergebnis vorhanden</div>
      )}
    </WidgetLinkWrapper>
  );
}
