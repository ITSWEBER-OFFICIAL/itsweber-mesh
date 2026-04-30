"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Cpu, MemoryStick } from "lucide-react";
import type { GlancesWidgetData } from "@/app/api/widgets/glances/route";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";

function fmtUptime(s: number | undefined): string {
  if (!s || s <= 0) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export function GlancesWidget({ label, refreshSec, linkUrl }: { label: string; refreshSec: number; linkUrl?: string }) {
  const { data, isLoading } = useQuery<GlancesWidgetData>({
    queryKey: ["widget-glances"],
    queryFn: () => fetch("/api/widgets/glances").then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  return (
    <WidgetLinkWrapper href={linkUrl} className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Activity size={14} className="glances-icon" />
        <span className="widget-title">{label}</span>
        <span className="widget-badge">Glances</span>
      </div>

      {isLoading && <div className="widget-loading">Lade…</div>}

      {data && data.instances.length === 0 && (
        <div className="widget-hint">
          Kein Glances-Host konfiguriert — <strong>Admin → Integrationen → Glances</strong>
        </div>
      )}

      {data && data.instances.length > 0 && (
        <div className="flex flex-col gap-[10px]">
          {data.instances.map((inst) => (
            <WidgetLinkWrapper key={inst.id} href={linkUrl ? undefined : (inst.online ? inst.baseUrl : undefined)}>
              <div className="widget-instance">
                <div className="widget-instance-header">
                  <span className="widget-instance-name">{inst.label}</span>
                  {inst.online
                    ? <span className="widget-status-ok">live</span>
                    : <span className="widget-status-err">offline</span>}
                </div>
                {!inst.online && <div className="widget-error-small">{inst.error}</div>}
                {inst.online && (
                  <div className="flex flex-col gap-[6px]">
                    <div className="widget-stat-row">
                      <Cpu size={11} className="glances-dim-icon" />
                      <span className="widget-stat-label">CPU</span>
                      <span className="widget-stat-value font-mono text-[10px]">
                        {inst.data.cpu.percent.toFixed(0)}%
                      </span>
                    </div>
                    <div className="widget-progress-track">
                      <div
                        className="widget-progress-fill ha-progress-brand"
                        style={{ width: `${Math.min(100, inst.data.cpu.percent)}%` }}
                      />
                    </div>
                    <div className="widget-stat-row">
                      <MemoryStick size={11} className="glances-dim-icon" />
                      <span className="widget-stat-label">RAM</span>
                      <span className="widget-stat-value font-mono text-[10px]">
                        {inst.data.memory.usedGb} / {inst.data.memory.totalGb} GB
                      </span>
                    </div>
                    <div className="widget-progress-track">
                      <div
                        className="widget-progress-fill ha-progress-teal"
                        style={{ width: `${Math.min(100, inst.data.memory.percent)}%` }}
                      />
                    </div>
                    {inst.data.uptimeSeconds !== undefined && (
                      <div className="widget-stat-row">
                        <span className="text-[11px]">⏱</span>
                        <span className="widget-stat-label">Uptime</span>
                        <span className="widget-stat-value font-mono text-[10px]">{fmtUptime(inst.data.uptimeSeconds)}</span>
                      </div>
                    )}
                    {inst.data.load && (
                      <div className="widget-stat-row">
                        <span className="text-[11px]">📊</span>
                        <span className="widget-stat-label">Load 1/5/15</span>
                        <span className="widget-stat-value font-mono text-[10px]">
                          {inst.data.load.min1.toFixed(2)} · {inst.data.load.min5.toFixed(2)} · {inst.data.load.min15.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </WidgetLinkWrapper>
          ))}
        </div>
      )}
    </WidgetLinkWrapper>
  );
}
