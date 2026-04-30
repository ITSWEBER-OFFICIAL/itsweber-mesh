"use client";

import { useQuery } from "@tanstack/react-query";
import { Network, Wifi, WifiOff, ArrowUp, ArrowDown } from "lucide-react";
import type { UnifiWidgetData } from "@/app/api/widgets/unifi/route";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function StatRow({ icon, label, value, sub }: { icon?: string; label: string; value: React.ReactNode; sub?: boolean }) {
  return (
    <div className="widget-stat-row">
      {icon && <span className="text-[11px]">{icon}</span>}
      <span className={`widget-stat-label${sub ? " pl-[16px]" : ""}`}>{label}</span>
      <span className="widget-stat-value font-mono text-[10px]">{value}</span>
    </div>
  );
}

export function UnifiWidget({
  label,
  refreshSec,
  linkUrl,
  wide,
}: {
  label: string;
  refreshSec: number;
  linkUrl?: string;
  wide?: boolean;
}) {
  const { data, isLoading } = useQuery<UnifiWidgetData>({
    queryKey: ["widget-unifi"],
    queryFn: () => fetch("/api/widgets/unifi").then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  const href = linkUrl || (data?.online ? data.controllerUrl : undefined);

  return (
    <WidgetLinkWrapper href={href}>
      <div className="widget-card">
        <span className="widget-accent unifi-accent" />
        <div className="widget-header">
          <Network size={14} className="unifi-icon" />
          <span className="widget-title">{label}</span>
          {data?.online
            ? <span className="widget-status-ok ml-auto"><Wifi size={10} />Online</span>
            : data?.configured
            ? <span className="widget-status-err ml-auto"><WifiOff size={10} />Offline</span>
            : null}
        </div>

        {isLoading && <div className="widget-loading">Verbinde…</div>}

        {data && !data.configured && (
          <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen</strong></div>
        )}

        {data?.configured && !data.online && (
          <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
        )}

        {data?.online && data.stats && (() => {
          const { devices, clients, wan, gateway, subsystems } = data.stats;

          if (wide) {
            return (
              <div className="unifi-wide-grid">
                {/* Spalte 1: WAN */}
                <div className="unifi-wide-col">
                  <span className="unifi-wide-heading">WAN</span>
                  {wan?.ispName && <StatRow label="ISP" value={wan.ispName} />}
                  {(wan?.xputUp !== undefined || wan?.xputDown !== undefined) && (
                    <div className="widget-stat-row">
                      <span className="widget-stat-label">Durchsatz</span>
                      <span className="widget-stat-value font-mono text-[10px] flex items-center gap-[4px]">
                        {wan?.xputUp !== undefined && (
                          <span className="flex items-center gap-[2px] text-[var(--status-ok)]">
                            <ArrowUp size={8} />{wan.xputUp} Mbps
                          </span>
                        )}
                        {wan?.xputDown !== undefined && (
                          <span className="flex items-center gap-[2px] text-[var(--brand)]">
                            <ArrowDown size={8} />{wan.xputDown} Mbps
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {wan?.latencyMs !== undefined && <StatRow label="Latenz" value={`${wan.latencyMs} ms`} />}
                  {wan?.uptimePct !== undefined && <StatRow label="Verfügbarkeit" value={`${wan.uptimePct.toFixed(2)} %`} />}
                </div>

                {/* Spalte 2: Clients */}
                <div className="unifi-wide-col">
                  <span className="unifi-wide-heading">Clients & Geräte</span>
                  <StatRow icon="📡" label="Geräte" value={`${devices.online} / ${devices.total}`} />
                  <StatRow icon="📱" label="Clients" value={clients.total} />
                  <StatRow icon="🔌" label="Wired" value={clients.wired} />
                  {clients.band24 > 0 && <StatRow label="2.4 GHz" value={clients.band24} sub />}
                  {clients.band5  > 0 && <StatRow label="5 GHz"   value={clients.band5}  sub />}
                  {clients.band6  > 0 && <StatRow label="6 GHz"   value={clients.band6}  sub />}
                </div>

                {/* Spalte 3: Gateway + Subsystems */}
                <div className="unifi-wide-col">
                  {gateway && (
                    <>
                      <span className="unifi-wide-heading">Gateway</span>
                      <StatRow icon="🖥️" label={gateway.name ?? "Gateway"} value={<span className="text-[var(--dim)] text-[9px]">{gateway.model}</span>} />
                      <StatRow label="CPU / RAM" value={`${gateway.cpu}% / ${gateway.mem}%`} sub />
                      {gateway.uptime && <StatRow label="Uptime" value={fmtUptime(Number(gateway.uptime))} sub />}
                    </>
                  )}
                  {subsystems.length > 0 && (
                    <>
                      <span className={`unifi-wide-heading${gateway ? " unifi-wide-heading--gap" : ""}`}>Subsysteme</span>
                      {subsystems.map((s) => (
                        <div key={s.name} className="widget-stat-row">
                          <span className="text-[10px]">{s.status === "ok" ? "✅" : "⚠️"}</span>
                          <span className="widget-stat-label">{s.name}</span>
                          <span className={`widget-stat-value font-mono text-[9px] uppercase ${s.status === "ok" ? "widget-stat-ok" : "widget-stat-warn"}`}>
                            {s.status}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          }

          // Sidebar-Layout (original, schmal)
          return (
            <div className="flex flex-col gap-[8px]">
              {wan && (
                <>
                  {wan.ispName && (
                    <div className="widget-stat-row">
                      <span className="widget-stat-label text-[var(--muted)]">ISP</span>
                      <span className="widget-stat-value font-mono text-[10px] truncate max-w-[120px]">{wan.ispName}</span>
                    </div>
                  )}
                  {(wan.xputUp !== undefined || wan.xputDown !== undefined) && (
                    <div className="widget-stat-row">
                      <span className="widget-stat-label">Durchsatz</span>
                      <span className="widget-stat-value font-mono text-[10px] flex items-center gap-[4px]">
                        {wan.xputUp !== undefined && (
                          <span className="flex items-center gap-[2px] text-[var(--status-ok)]">
                            <ArrowUp size={8} />{wan.xputUp} Mbps
                          </span>
                        )}
                        {wan.xputDown !== undefined && (
                          <span className="flex items-center gap-[2px] text-[var(--brand)]">
                            <ArrowDown size={8} />{wan.xputDown} Mbps
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {wan.latencyMs !== undefined && (
                    <div className="widget-stat-row">
                      <span className="widget-stat-label">WAN Latenz</span>
                      <span className="widget-stat-value font-mono text-[10px]">{wan.latencyMs} ms</span>
                    </div>
                  )}
                  <div className="widget-divider" />
                </>
              )}

              <div className="widget-stat-row">
                <span className="text-[11px]">📡</span>
                <span className="widget-stat-label">Geräte</span>
                <span className="widget-stat-value font-mono text-[10px]">{devices.online} / {devices.total}</span>
              </div>
              <div className="widget-stat-row">
                <span className="text-[11px]">📱</span>
                <span className="widget-stat-label">Clients</span>
                <span className="widget-stat-value font-mono text-[10px]">{clients.total}</span>
              </div>
              <div className="widget-stat-row">
                <span className="text-[11px]">🔌</span>
                <span className="widget-stat-label">Wired</span>
                <span className="widget-stat-value font-mono text-[10px]">{clients.wired}</span>
              </div>
              {clients.band24 > 0 && (
                <div className="widget-stat-row">
                  <span className="widget-stat-label pl-[16px]">2.4 GHz</span>
                  <span className="widget-stat-value font-mono text-[10px]">{clients.band24}</span>
                </div>
              )}
              {clients.band5 > 0 && (
                <div className="widget-stat-row">
                  <span className="widget-stat-label pl-[16px]">5 GHz</span>
                  <span className="widget-stat-value font-mono text-[10px]">{clients.band5}</span>
                </div>
              )}
              {clients.band6 > 0 && (
                <div className="widget-stat-row">
                  <span className="widget-stat-label pl-[16px]">6 GHz</span>
                  <span className="widget-stat-value font-mono text-[10px]">{clients.band6}</span>
                </div>
              )}

              {gateway && (
                <>
                  <div className="widget-divider" />
                  <div className="widget-stat-row">
                    <span className="text-[11px]">🖥️</span>
                    <span className="widget-stat-label">{gateway.name ?? "Gateway"}</span>
                    <span className="widget-stat-value font-mono text-[9px] text-[var(--dim)]">{gateway.model}</span>
                  </div>
                  <div className="widget-stat-row">
                    <span className="widget-stat-label pl-[16px]">CPU / RAM</span>
                    <span className="widget-stat-value font-mono text-[10px]">{gateway.cpu}% / {gateway.mem}%</span>
                  </div>
                  {gateway.uptime && (
                    <div className="widget-stat-row">
                      <span className="widget-stat-label pl-[16px]">Uptime</span>
                      <span className="widget-stat-value font-mono text-[10px]">{fmtUptime(Number(gateway.uptime))}</span>
                    </div>
                  )}
                </>
              )}

              {subsystems.length > 0 && (
                <>
                  <div className="widget-divider" />
                  {subsystems.slice(0, 5).map((s) => (
                    <div key={s.name} className="widget-stat-row">
                      <span className="text-[10px]">{s.status === "ok" ? "✅" : "⚠️"}</span>
                      <span className="widget-stat-label">{s.name}</span>
                      <span className={`widget-stat-value font-mono text-[9px] uppercase ${s.status === "ok" ? "widget-stat-ok" : "widget-stat-warn"}`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })()}
      </div>
    </WidgetLinkWrapper>
  );
}
