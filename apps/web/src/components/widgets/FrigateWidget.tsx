"use client";

import { useQuery } from "@tanstack/react-query";
import { Cctv, CameraOff } from "lucide-react";
import type { FrigateWidgetData } from "@/app/api/widgets/frigate/route";
import type { WidgetRenderProps } from "./registry";

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function FrigateWidget({ instance }: WidgetRenderProps) {
  const integrationId =
    typeof instance.settings?.["integrationId"] === "string"
      ? instance.settings["integrationId"]
      : Array.isArray(instance.settings?.["integrationIds"]) && typeof instance.settings["integrationIds"][0] === "string"
      ? instance.settings["integrationIds"][0]
      : undefined;
  const url = integrationId ? `/api/widgets/frigate?id=${integrationId}` : "/api/widgets/frigate";
  const { data, isLoading } = useQuery<FrigateWidgetData>({
    queryKey: ["widget-frigate", integrationId],
    queryFn: () => fetch(url).then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: (instance.refreshSec - 2) * 1000,
  });

  const camCount = data?.cameras?.length ?? 0;

  return (
    <div className="widget-card">
      <span className="widget-accent" style={{ background: "linear-gradient(180deg, #f97316, #ea580c)" }} />
      <div className="widget-header">
        <Cctv size={14} className="text-[#f97316]" />
        <span className="widget-title">{instance.label}</span>
        {data?.online
          ? <span className="widget-status-ok ml-auto"><Cctv size={10} />{camCount} Kams</span>
          : data?.configured
          ? <span className="widget-status-err ml-auto"><CameraOff size={10} />Offline</span>
          : null}
      </div>

      {isLoading && <div className="widget-loading">Verbinde…</div>}

      {data && !data.configured && (
        <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen</strong></div>
      )}

      {data?.configured && !data.online && (
        <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
      )}

      {data?.online && (
        <div className="flex flex-col gap-[8px]">
          {/* Stats */}
          {data.stats && (
            <>
              <div className="widget-stat-row">
                <span className="widget-stat-label">Kamera FPS</span>
                <span className="widget-stat-value font-mono text-[10px]">{data.stats.totalFps}</span>
              </div>
              {data.stats.cpuUsage !== undefined && (
                <div className="widget-stat-row">
                  <span className="widget-stat-label">CPU</span>
                  <span className="widget-stat-value font-mono text-[10px]">{data.stats.cpuUsage}%</span>
                </div>
              )}
              {data.recentEvents && data.recentEvents.length > 0 && (
                <div className="widget-divider" />
              )}
            </>
          )}

          {/* Recent Events */}
          {data.recentEvents?.slice(0, 4).map((ev) => (
            <div key={ev.id} className="frigate-event-row">
              {ev.hasSnapshot && (
                <div className="frigate-thumb-wrap">
                  <img
                    src={ev.snapshotUrl}
                    alt={ev.label}
                    className="frigate-thumb"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-[var(--fg)] capitalize">{ev.label}</span>
                <span className="text-[10px] text-[var(--muted)] truncate">{ev.camera}</span>
                <span className="text-[9px] font-mono text-[var(--dim)]">
                  {timeAgo(ev.startTime)} ago{ev.topScore !== null ? ` · ${ev.topScore}%` : ""}
                </span>
              </div>
            </div>
          ))}

          {data.recentEvents?.length === 0 && (
            <div className="text-[11px] text-[var(--dim)]">Keine Events</div>
          )}
        </div>
      )}
    </div>
  );
}
