"use client";

import { useQuery } from "@tanstack/react-query";
import { Server, Cpu, HardDrive, Wifi, WifiOff, Box, MonitorPlay, Activity } from "lucide-react";
import type { UnraidWidgetData } from "@/app/api/widgets/unraid/route";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="widget-progress-track">
      <div className="widget-progress-fill ha-progress-brand" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function UnraidWidget({ label, refreshSec, linkUrl, integrationIds }: { label: string; refreshSec: number; linkUrl?: string; integrationIds?: string[] }) {
  const idsKey = integrationIds?.join(",") ?? "all";
  const url = integrationIds?.length ? `/api/widgets/unraid?ids=${integrationIds.join(",")}` : "/api/widgets/unraid";
  const { data, isLoading, error } = useQuery<UnraidWidgetData>({
    queryKey: ["widget-unraid", idsKey],
    queryFn: () => fetch(url).then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  return (
    <WidgetLinkWrapper href={linkUrl} className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Server size={14} className="unraid-server-icon" />
        <span className="widget-title">{label}</span>
        <span className="widget-badge">Unraid</span>
      </div>

      {isLoading && <div className="widget-loading">Verbinde…</div>}
      {error && <div className="widget-error">Fehler beim Laden</div>}

      {data && (
        <div className="flex flex-col gap-[12px]">
          {data.instances.length === 0 && (
            <div className="widget-hint">Keine Instanz konfiguriert — <strong>Admin → Integrationen</strong></div>
          )}
          {data.instances.map((inst) => (
            <WidgetLinkWrapper key={inst.id} href={linkUrl ? undefined : inst.webUrl}>
              <div className="widget-instance">
                <div className="widget-instance-header">
                  <span className="widget-instance-name">{inst.label}</span>
                  {inst.online
                    ? <span className="widget-status-ok"><Wifi size={10} />Online</span>
                    : <span className="widget-status-err"><WifiOff size={10} />Offline</span>
                  }
                  {inst.online && inst.data.unraidVersion && (
                    <span className="unraid-version">v{inst.data.unraidVersion}</span>
                  )}
                </div>

                {!inst.online && (
                  <div className="widget-error-small">{inst.error}</div>
                )}

                {inst.online && (
                  <div className="flex flex-col gap-[8px]">
                    {inst.data.array && (
                      <div className="widget-stat-row">
                        <HardDrive size={11} className="unraid-dim-icon" />
                        <span className="widget-stat-label">Array</span>
                        <span className={`widget-stat-value font-mono text-[10px]${inst.data.array.state === "STARTED" ? " widget-stat-ok" : " widget-stat-warn"}`}>
                          {inst.data.array.state}
                          {inst.data.array.capacity && (
                            <span className="text-[var(--dim)]"> · {inst.data.array.capacity.usedTb}/{inst.data.array.capacity.totalTb} TB ({inst.data.array.capacity.percent}%)</span>
                          )}
                        </span>
                      </div>
                    )}
                    {inst.data.cpu && (
                      <div className="widget-stat-row">
                        <Cpu size={11} className="unraid-dim-icon" />
                        <span className="widget-stat-label truncate" title={inst.data.cpu.brand}>{inst.data.cpu.brand}</span>
                        <span className="widget-stat-value font-mono text-[10px] flex-shrink-0">
                          {inst.data.cpu.cores}C/{inst.data.cpu.threads}T
                          {inst.data.memoryTotalGb !== undefined && (
                            <span className="text-[var(--dim)]"> · {inst.data.memoryTotalGb} GB RAM</span>
                          )}
                        </span>
                      </div>
                    )}
                    {inst.data.containers && (
                      <div className="widget-stat-row">
                        <Box size={11} className="unraid-dim-icon" />
                        <span className="widget-stat-label">Container</span>
                        <span className={`widget-stat-value font-mono text-[10px]${inst.data.containers.running === inst.data.containers.total ? " widget-stat-ok" : ""}`}>
                          {inst.data.containers.running}/{inst.data.containers.total}
                        </span>
                      </div>
                    )}
                    {inst.data.vms && inst.data.vms.total > 0 && (
                      <div className="widget-stat-row">
                        <MonitorPlay size={11} className="unraid-dim-icon" />
                        <span className="widget-stat-label">VMs</span>
                        <span className="widget-stat-value font-mono text-[10px]">
                          {inst.data.vms.running}/{inst.data.vms.total}
                        </span>
                      </div>
                    )}
                    {inst.data.services && inst.data.services.length > 0 && (() => {
                      const onlineCount = inst.data.services.filter((s) => s.online).length;
                      const totalCount = inst.data.services.length;
                      return (
                        <div className="widget-stat-row">
                          <Activity size={11} className="unraid-dim-icon" />
                          <span className="widget-stat-label">Services</span>
                          <span className={`widget-stat-value font-mono text-[10px]${onlineCount === totalCount ? " widget-stat-ok" : " widget-stat-warn"}`}>
                            {onlineCount}/{totalCount}
                          </span>
                        </div>
                      );
                    })()}
                    {inst.data.bootedAt && (
                      <div className="widget-stat-row">
                        <span className="widget-stat-label pl-[16px] text-[10px]">Uptime seit</span>
                        <span className="widget-stat-value font-mono text-[9px] text-[var(--dim)]">
                          {new Date(inst.data.bootedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
