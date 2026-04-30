"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Home, AlertTriangle, RefreshCw, Bell, ShieldCheck,
  Cpu, MemoryStick, Boxes, Workflow, Cable,
} from "lucide-react";
import type { SmartHomeWidgetData, SmartHomeHealthStatus } from "@/app/api/widgets/smart-home/route";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";

type Tone = "ok" | "warn" | "err" | "info";

function statusTone(status: SmartHomeHealthStatus): Tone {
  if (status === "error") return "err";
  if (status === "warn") return "warn";
  if (status === "healthy") return "ok";
  return "info";
}

function statusLabel(status: SmartHomeHealthStatus): string {
  if (status === "error") return "Problem";
  if (status === "warn") return "Achtung";
  if (status === "healthy") return "Alles ruhig";
  return "Verbindet…";
}

function ProgressBar({ value, tone = "info" }: { value: number; tone?: Tone }) {
  return (
    <div className={`shw-bar shw-bar--${tone}`}>
      <span className="shw-bar-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function KpiTile({
  label, value, icon, tone, hint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: Tone;
  hint?: string;
}) {
  return (
    <div className={`shw-kpi shw-kpi--${tone}`}>
      <span className="shw-kpi-icon">{icon}</span>
      <div className="shw-kpi-body">
        <div className="shw-kpi-value">{value}</div>
        <div className="shw-kpi-label">{label}</div>
        {hint && <div className="shw-kpi-hint">{hint}</div>}
      </div>
    </div>
  );
}

export function SmartHomeWidget({ label, refreshSec, linkUrl }: { label: string; refreshSec: number; linkUrl?: string }) {
  const { data, isLoading } = useQuery<SmartHomeWidgetData>({
    queryKey: ["widget-smart-home"],
    queryFn: () => fetch("/api/widgets/smart-home").then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  const href = linkUrl || (data?.online ? data.baseUrl : undefined);
  const tone = data?.online ? statusTone(data.health.status) : "info";

  return (
    <WidgetLinkWrapper href={href} className="widget-card shw-card">
      <span className={`shw-accent shw-accent--${tone}`} aria-hidden />

      {/* Header */}
      <div className="shw-head">
        <div className="shw-head-title">
          <span className="shw-icon-wrap"><Home size={16} /></span>
          <div className="shw-head-text">
            <div className="shw-head-name">{label}</div>
            {data?.locationName && <div className="shw-head-loc">{data.locationName}</div>}
          </div>
        </div>
        <div className="shw-head-meta">
          {data?.online && data.version && <span className="shw-version">v{data.version}</span>}
          {data?.online && (
            <span className={`shw-status shw-status--${tone}`}>
              {tone === "err" && <AlertTriangle size={11} />}
              {tone === "warn" && <AlertTriangle size={11} />}
              {tone === "ok" && <ShieldCheck size={11} />}
              <span>{statusLabel(data.health.status)}</span>
            </span>
          )}
        </div>
      </div>

      {isLoading && <div className="widget-loading">Verbinde mit Home Assistant…</div>}

      {data && !data.configured && (
        <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen → Home Assistant</strong></div>
      )}

      {data?.configured && !data.online && (
        <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
      )}

      {data?.online && (
        <>
          <div className="shw-kpi-row">
            <KpiTile
              label="Probleme"
              value={data.health.problems}
              icon={<AlertTriangle size={14} />}
              tone={data.health.problems > 0 ? "err" : "info"}
            />
            <KpiTile
              label="Updates"
              value={data.health.updatesAvailable}
              icon={<RefreshCw size={14} />}
              tone={data.health.updatesAvailable > 0 ? "warn" : "info"}
            />
            <KpiTile
              label="Notifications"
              value={data.health.notifications}
              icon={<Bell size={14} />}
              tone={data.health.notifications > 0 ? "warn" : "info"}
            />
          </div>

          {data.system && (
            <div className="shw-system">
              <div className="shw-system-row">
                <Cpu size={11} className="shw-system-icon" />
                <span className="shw-system-label">CPU</span>
                <span className="shw-system-value">{data.system.cpuPercent}%</span>
              </div>
              <ProgressBar value={data.system.cpuPercent} tone={data.system.cpuPercent > 80 ? "err" : data.system.cpuPercent > 60 ? "warn" : "ok"} />
              <div className="shw-system-row shw-system-row-mt">
                <MemoryStick size={11} className="shw-system-icon" />
                <span className="shw-system-label">RAM</span>
                <span className="shw-system-value">
                  {(data.system.memUsedMb / 1024).toFixed(1)} / {(data.system.memTotalMb / 1024).toFixed(1)} GB
                  <span className="shw-system-percent"> · {data.system.memPercent}%</span>
                </span>
              </div>
              <ProgressBar value={data.system.memPercent} tone={data.system.memPercent > 85 ? "err" : data.system.memPercent > 70 ? "warn" : "info"} />
            </div>
          )}

          {data.counts && (
            <div className="shw-counts">
              <div className="shw-count-tile">
                <Boxes size={12} className="shw-count-icon" />
                <span className="shw-count-value">{data.counts.entities.toLocaleString("de-DE")}</span>
                <span className="shw-count-label">Entities</span>
              </div>
              <div className="shw-count-tile">
                <Workflow size={12} className="shw-count-icon" />
                <span className="shw-count-value">{data.counts.automations}</span>
                <span className="shw-count-label">Automations</span>
              </div>
              {data.counts.components > 0 && (
                <div className="shw-count-tile">
                  <Cable size={12} className="shw-count-icon" />
                  <span className="shw-count-value">{data.counts.components}</span>
                  <span className="shw-count-label">Components</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </WidgetLinkWrapper>
  );
}
