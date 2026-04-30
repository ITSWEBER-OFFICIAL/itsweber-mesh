"use client";

import { useQuery } from "@tanstack/react-query";
import { Radio, BatteryLow, CheckCircle2, XCircle, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";
import { WidgetSkeleton } from "@/components/ui/Skeleton";
import type { Zigbee2MqttWidgetData } from "@/app/api/widgets/zigbee2mqtt/route";
import type { WidgetRenderProps } from "./registry";

function timeAgo(iso: string): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  return `${Math.floor(hr / 24)} d`;
}

export function Zigbee2MqttWidget({ instance, isWide }: WidgetRenderProps) {
  const { data, isLoading, error } = useQuery<Zigbee2MqttWidgetData>({
    queryKey: ["widget-z2m"],
    queryFn: () => fetch("/api/widgets/zigbee2mqtt").then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: Math.max(1, instance.refreshSec - 2) * 1000,
  });

  if (isLoading) return <WidgetSkeleton compact={false} label={instance.label} />;

  if (error || !data) {
    return (
      <div className="widget-card">
        <div className="widget-header"><Radio size={14} /><span className="widget-title">{instance.label}</span></div>
        <div className="widget-error-message">
          {error instanceof Error ? error.message : "Z2M-Daten konnten nicht geladen werden"}
        </div>
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="widget-card">
        <span className="widget-accent" />
        <div className="widget-header"><Radio size={14} /><span className="widget-title">{instance.label}</span></div>
        <div className="widget-hint">
          {data.error ?? (
            <>Z2M-Widget aktivieren unter <strong>Admin → Integrationen → Zigbee2MQTT</strong>.</>
          )}
        </div>
      </div>
    );
  }

  if (!data.online) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <Radio size={14} />
          <span className="widget-title">{instance.label}</span>
          <span className="widget-status-err ml-auto"><WifiOff size={10} />Offline</span>
        </div>
        <div className="widget-error-message">{data.error ?? "Z2M nicht erreichbar"}</div>
      </div>
    );
  }

  const lowBatteryDevices = data.devices.filter((d) => d.lowBattery);
  const offlineDevices = data.devices.filter((d) => !d.online);

  return (
    <WidgetLinkWrapper href={instance.linkUrl} className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Radio size={14} className="z2m-icon" />
        <span className="widget-title">{instance.label}</span>
        {data.bridgeVersion && <span className="widget-badge">v{data.bridgeVersion}</span>}
        <span className={`ml-auto ${data.bridgeOnline ? "widget-status-ok" : "widget-status-err"}`}>
          {data.bridgeOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
          Bridge
        </span>
      </div>

      {/* KPI tiles */}
      <div className="z2m-kpi-grid">
        <div className="z2m-kpi z2m-kpi--ok">
          <CheckCircle2 size={14} className="z2m-kpi-icon" />
          <div className="z2m-kpi-value">{data.totals.online}</div>
          <div className="z2m-kpi-label">Online</div>
        </div>
        <div className={`z2m-kpi ${data.totals.offline > 0 ? "z2m-kpi--err" : "z2m-kpi--mute"}`}>
          <XCircle size={14} className="z2m-kpi-icon" />
          <div className="z2m-kpi-value">{data.totals.offline}</div>
          <div className="z2m-kpi-label">Offline</div>
        </div>
        <div className={`z2m-kpi ${data.totals.lowBattery > 0 ? "z2m-kpi--warn" : "z2m-kpi--mute"}`}>
          <BatteryLow size={14} className="z2m-kpi-icon" />
          <div className="z2m-kpi-value">{data.totals.lowBattery}</div>
          <div className="z2m-kpi-label">Akku &lt;20%</div>
        </div>
        <div className="z2m-kpi z2m-kpi--mute">
          <Radio size={14} className="z2m-kpi-icon" />
          <div className="z2m-kpi-value">{data.totals.total}</div>
          <div className="z2m-kpi-label">Gesamt</div>
        </div>
      </div>

      {data.lastActive && (
        <div className="z2m-last-active">
          Zuletzt aktiv: <strong>{data.lastActive.name}</strong> · vor {timeAgo(data.lastActive.lastChanged)}
        </div>
      )}

      {/* Wide-Modus: 2-Spalten-Listen Offline | Low-Battery */}
      {isWide && (offlineDevices.length > 0 || lowBatteryDevices.length > 0) && (
        <div className="z2m-wide-grid">
          {offlineDevices.length > 0 && (
            <div className="z2m-wide-col">
              <span className="z2m-section-heading"><AlertTriangle size={11} /> Offline ({offlineDevices.length})</span>
              {offlineDevices.slice(0, 8).map((d) => (
                <div key={d.id} className="z2m-row">
                  <span className="z2m-row-icon" style={{ color: "var(--status-error)" }}><XCircle size={11} /></span>
                  <span className="z2m-row-name">{d.friendlyName}</span>
                  {d.area && <span className="z2m-row-area">{d.area}</span>}
                </div>
              ))}
              {offlineDevices.length > 8 && (
                <div className="z2m-more">+ {offlineDevices.length - 8} weitere</div>
              )}
            </div>
          )}
          {lowBatteryDevices.length > 0 && (
            <div className="z2m-wide-col">
              <span className="z2m-section-heading"><BatteryLow size={11} /> Akku schwach ({lowBatteryDevices.length})</span>
              {lowBatteryDevices.slice(0, 8).map((d) => (
                <div key={d.id} className="z2m-row">
                  <span className="z2m-row-icon" style={{ color: "var(--status-warn)" }}><BatteryLow size={11} /></span>
                  <span className="z2m-row-name">{d.friendlyName}</span>
                  <span className="z2m-row-meta">{Math.round(d.battery ?? 0)}%</span>
                </div>
              ))}
              {lowBatteryDevices.length > 8 && (
                <div className="z2m-more">+ {lowBatteryDevices.length - 8} weitere</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Schmaler Modus: nur die 5 dringendsten Probleme als Liste */}
      {!isWide && (offlineDevices.length > 0 || lowBatteryDevices.length > 0) && (
        <ul className="z2m-issue-list">
          {offlineDevices.slice(0, 3).map((d) => (
            <li key={`off-${d.id}`} className="z2m-row">
              <span className="z2m-row-icon" style={{ color: "var(--status-error)" }}><XCircle size={11} /></span>
              <span className="z2m-row-name">{d.friendlyName}</span>
              <span className="z2m-row-meta">offline</span>
            </li>
          ))}
          {lowBatteryDevices.slice(0, 3).map((d) => (
            <li key={`bat-${d.id}`} className="z2m-row">
              <span className="z2m-row-icon" style={{ color: "var(--status-warn)" }}><BatteryLow size={11} /></span>
              <span className="z2m-row-name">{d.friendlyName}</span>
              <span className="z2m-row-meta">{Math.round(d.battery ?? 0)}%</span>
            </li>
          ))}
        </ul>
      )}

      {offlineDevices.length === 0 && lowBatteryDevices.length === 0 && (
        <div className="z2m-allgood">Alle {data.totals.total} Geräte online · Akkus ok</div>
      )}
    </WidgetLinkWrapper>
  );
}
