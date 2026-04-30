"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, Play, Square, Pause, Layers } from "lucide-react";
import type { PortainerWidgetData } from "@/app/api/widgets/portainer/route";
import type { WidgetRenderProps } from "./registry";

const STATE_COLOR: Record<string, string> = {
  running: "var(--status-ok)",
  exited:  "var(--status-error)",
  paused:  "var(--status-warn)",
};

function StateBadge({ state }: { state: string }) {
  const color = STATE_COLOR[state] ?? "var(--dim)";
  const Icon = state === "running" ? Play : state === "paused" ? Pause : Square;
  return (
    <span className="portainer-state-badge" style={{ color }}>
      <Icon size={8} />
      {state.toUpperCase()}
    </span>
  );
}

export function PortainerWidget({ instance, layout }: WidgetRenderProps) {
  const integrationId =
    typeof instance.settings?.["integrationId"] === "string"
      ? instance.settings["integrationId"]
      : Array.isArray(instance.settings?.["integrationIds"]) && typeof instance.settings["integrationIds"][0] === "string"
      ? instance.settings["integrationIds"][0]
      : undefined;
  const url = integrationId ? `/api/widgets/portainer?id=${integrationId}` : "/api/widgets/portainer";
  const wide = layout.w >= 8;

  const { data, isLoading } = useQuery<PortainerWidgetData>({
    queryKey: ["widget-portainer", integrationId],
    queryFn: () => fetch(url).then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: (instance.refreshSec - 2) * 1000,
  });

  const summary = data?.summary;

  return (
    <div className="widget-card">
      <span className="widget-accent portainer-accent" />
      <div className="widget-header">
        <Box size={14} className="portainer-icon" />
        <span className="widget-title">{instance.label}</span>
        {data?.endpointName && (
          <span className="widget-badge ml-auto font-mono text-[10px] text-[var(--dim)]">{data.endpointName}</span>
        )}
        {data?.online
          ? <span className="widget-status-ok" style={{ marginLeft: data.endpointName ? "6px" : "auto" }}>
              <Play size={9} />{summary?.running ?? 0} running
            </span>
          : data?.configured
          ? <span className="widget-status-err ml-auto"><Square size={9} />Offline</span>
          : null}
      </div>

      {isLoading && <div className="widget-loading">Verbinde…</div>}
      {data && !data.configured && (
        <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen</strong></div>
      )}
      {data?.configured && !data.online && (
        <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
      )}

      {data?.online && summary && (
        <>
          {/* Summary — gleich in beiden Layouts */}
          <div className="portainer-summary">
            <div className="portainer-summary-item">
              <span className="portainer-summary-num portainer-num--running">{summary.running}</span>
              <span className="portainer-summary-label">Running</span>
            </div>
            <div className="portainer-summary-item">
              <span className="portainer-summary-num portainer-num--stopped">{summary.stopped}</span>
              <span className="portainer-summary-label">Stopped</span>
            </div>
            <div className="portainer-summary-item">
              <span className="portainer-summary-num portainer-num--paused">{summary.paused}</span>
              <span className="portainer-summary-label">Paused</span>
            </div>
            <div className="portainer-summary-item">
              <span className="portainer-summary-num portainer-num--total">{summary.total}</span>
              <span className="portainer-summary-label">Gesamt</span>
            </div>
          </div>

          {wide ? (
            /* ── Wide layout ─────────────────────────────────────────── */
            <div className="portainer-wide-layout">
              {/* Stacks — nur wenn vorhanden, als horizontale Badge-Leiste */}
              {data.stacks && data.stacks.length > 0 && (
                <div className="portainer-wide-stacks-bar">
                  <span className="portainer-section-label"><Layers size={10} />Stacks</span>
                  <div className="portainer-stacks-pills">
                    {data.stacks.map((s) => (
                      <span key={s.name} className={`portainer-stack-pill ${s.status === 1 ? "portainer-stack-pill--ok" : "portainer-stack-pill--off"}`}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Container Grid */}
              <div className="portainer-section-label portainer-section-label--mt">
                <Box size={10} />Container
              </div>
              <div className="portainer-container-grid">
                {data.containers?.map((c) => (
                  <div
                    key={c.id}
                    className={`portainer-container-card ${c.state !== "running" ? "portainer-container-card--problem" : ""}`}
                  >
                    <div className="portainer-card-top">
                      <StateBadge state={c.state} />
                      <span className="portainer-card-image">{c.image}</span>
                    </div>
                    <span className="portainer-card-name">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Sidebar layout ──────────────────────────────────────── */
            <>
              {data.stacks && data.stacks.length > 0 && (
                <>
                  <div className="widget-divider" />
                  <div className="portainer-section-label"><Layers size={10} />Stacks</div>
                  <div className="portainer-stack-list">
                    {data.stacks.map((s) => (
                      <div key={s.name} className="portainer-stack-row">
                        <span className="portainer-stack-name">{s.name}</span>
                        <span className={`portainer-stack-status ${s.status === 1 ? "portainer-stack-ok" : "portainer-stack-off"}`}>
                          {s.status === 1 ? "active" : "inactive"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="widget-divider" />
              <div className="portainer-section-label"><Box size={10} />Container</div>
              <div className="portainer-container-list">
                {data.containers?.map((c) => (
                  <div key={c.id} className={`portainer-container-row ${c.state !== "running" ? "portainer-container-row--problem" : ""}`}>
                    <StateBadge state={c.state} />
                    <span className="portainer-container-name">{c.name}</span>
                    <span className="portainer-container-image">{c.image}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
