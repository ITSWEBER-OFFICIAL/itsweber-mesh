"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Cpu, CheckCircle2, XCircle, Wifi, WifiOff, ChevronDown, ChevronUp,
  Settings as SettingsIcon, AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";
import { WidgetSkeleton } from "@/components/ui/Skeleton";
import { useEditMode } from "@/components/layout/EditModeContext";
import type { EsphomeWidgetData } from "@/app/api/widgets/esphome/route";
import type { EsphomeDirectWidgetData, EsphomeDirectDevice } from "@/app/api/widgets/esphome/direct/route";
import type { WidgetRenderProps } from "./registry";

type EsphomeMode = "direct" | "ha" | "auto";

const ADMIN_ESPHOME_HREF = "/admin/integrations?focus=esphome#esphome";

function getIntegrationIds(instance: WidgetRenderProps["instance"]): string[] {
  const settings = instance.settings ?? {};
  if (Array.isArray(settings["integrationIds"])) {
    return settings["integrationIds"].filter((id): id is string => typeof id === "string" && id.length > 0);
  }
  if (typeof settings["integrationId"] === "string" && settings["integrationId"]) {
    return [settings["integrationId"]];
  }
  return [];
}

function esphomeDirectUrl(instance: WidgetRenderProps["instance"]): string {
  const ids = getIntegrationIds(instance);
  return ids.length > 0
    ? `/api/widgets/esphome/direct?ids=${encodeURIComponent(ids.join(","))}`
    : "/api/widgets/esphome/direct";
}

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

function ModeBadge({ mode, resolved }: { mode: EsphomeMode; resolved?: "direct" | "ha" }) {
  const label = mode === "auto" && resolved
    ? `auto · ${resolved}`
    : mode;
  return <span className="esphome-mode-badge">{label}</span>;
}

function OnboardingCard({
  instance,
  title,
  message,
  ctaLabel = "Integration konfigurieren",
}: {
  instance: WidgetRenderProps["instance"];
  title?: string;
  message: React.ReactNode;
  ctaLabel?: string;
}) {
  return (
    <div className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Cpu size={14} />
        <span className="widget-title">{title ?? instance.label}</span>
      </div>
      <div className="esphome-onboarding">
        <AlertTriangle size={14} className="esphome-onboarding-icon" />
        <div className="esphome-onboarding-text">{message}</div>
        <Link href={ADMIN_ESPHOME_HREF} className="esphome-onboarding-cta">
          <SettingsIcon size={11} />
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

/* ── Direct mode: single device block ───────────────────────────────────── */

function DeviceBlock({
  device,
  defaultExpanded = false,
}: {
  device: EsphomeDirectDevice;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasSensors = device.sensors.length > 0;

  return (
    <div className={`esphome-device-block ${device.online ? "" : "esphome-device-block--offline"}`}>
      <button
        type="button"
        className="esphome-device-header"
        onClick={() => hasSensors && setExpanded((v) => !v)}
        disabled={!hasSensors}
      >
        <span className={`protect-status-dot ${device.online ? "protect-status-dot--ok" : "protect-status-dot--err"}`} />
        <span className="esphome-device-name">{device.label}</span>
        {device.version && <span className="esphome-device-version">v{device.version}</span>}
        {!device.online && device.error && (
          <span className="esphome-device-error">{device.error}</span>
        )}
        {hasSensors && (
          <span className="esphome-device-toggle ml-auto">
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            <span className="text-[10px] text-[var(--dim)]">{device.sensors.length}</span>
          </span>
        )}
      </button>
      {expanded && hasSensors && (
        <div className="esphome-sensor-list">
          {device.sensors.map((s) => (
            <div key={s.id} className="esphome-sensor-row">
              <span className="esphome-sensor-name">{s.name}</span>
              <span className="esphome-sensor-value">
                {s.state}
                {s.unit && <span className="esphome-sensor-unit">{s.unit}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Direct mode widget ──────────────────────────────────────────────────── */

function EsphomeDirectWidget({
  instance,
  compact,
  layout,
  modeBadge,
}: WidgetRenderProps & { modeBadge?: React.ReactNode }) {
  const { active: editMode } = useEditMode();
  const url = esphomeDirectUrl(instance);
  const { data, isLoading } = useQuery<EsphomeDirectWidgetData>({
    queryKey: ["widget-esphome-direct", url],
    queryFn: () => fetch(url).then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: Math.max(1, instance.refreshSec - 2) * 1000,
  });

  if (isLoading) return <WidgetSkeleton compact={compact} label={instance.label} />;

  if (!data?.configured) {
    return (
      <OnboardingCard
        instance={instance}
        message={
          <>
            Keine ESPHome-Geräte im <strong>Direct-Modus</strong> konfiguriert. Lege unter
            {" "}<strong>Admin → Integrationen → ESPHome</strong> die einzelnen Gerät-URLs
            (z.B. <code>http://esphome-device.local</code>) an. Optional pro Gerät ein API-Passwort.
          </>
        }
      />
    );
  }

  const { devices, totals } = data;
  const allOnline = totals.offline === 0 && totals.total > 0;
  const statusColor = allOnline ? "var(--status-ok)" : totals.offline > 0 ? "var(--status-warn)" : "var(--dim)";

  if (compact) {
    return (
      <WidgetLinkWrapper href={instance.linkUrl} className="widget-card widget-compact">
        <div className="widget-compact-icon" style={{ color: statusColor, background: `color-mix(in srgb, ${statusColor} 15%, transparent)` }}>
          <Cpu size={22} />
        </div>
        <div className="widget-compact-body">
          <div className="widget-compact-label">{instance.label}</div>
          <div className="widget-compact-value">
            {totals.online}<span className="widget-compact-value-sep">/</span>{totals.total}
          </div>
          <div className="widget-compact-sub">
            {totals.offline > 0 ? `${totals.offline} offline` : "alle online"}
          </div>
        </div>
      </WidgetLinkWrapper>
    );
  }

  const isWide = !compact;
  /* Auto-expand sensor lists when the widget has enough vertical room. */
  const autoExpandSensors = !compact && devices.length <= 3;

  return (
    <WidgetLinkWrapper href={instance.linkUrl} className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Cpu size={14} />
        <span className="widget-title">{instance.label}</span>
        {modeBadge}
        <span className={`ml-auto flex items-center gap-[4px] text-[11px] font-mono ${allOnline ? "widget-status-ok" : totals.offline > 0 ? "widget-status-warn" : ""}`}>
          {allOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
          {totals.online}/{totals.total}
        </span>
      </div>

      <div className={isWide ? "esphome-device-grid" : "esphome-device-list"}>
        {devices.map((device) => (
          <DeviceBlock key={device.id} device={device} defaultExpanded={autoExpandSensors} />
        ))}
      </div>

      {editMode && devices.length > 3 && layout.h < 16 && (
        <div className="esphome-size-hint">
          {devices.length} Geräte verfügbar — Widget vergrößern, um alle Sensoren auf einen Blick zu sehen.
        </div>
      )}
    </WidgetLinkWrapper>
  );
}

/* ── HA-Group (legacy) mode ──────────────────────────────────────────────── */

function EsphomeLegacyWidget({
  instance,
  compact,
  modeBadge,
}: WidgetRenderProps & { modeBadge?: React.ReactNode }) {
  const { data, isLoading, error } = useQuery<EsphomeWidgetData>({
    queryKey: ["widget-esphome"],
    queryFn: () => fetch("/api/widgets/esphome").then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: Math.max(1, instance.refreshSec - 2) * 1000,
  });

  if (isLoading) return <WidgetSkeleton compact={compact} label={instance.label} />;

  if (error || !data) {
    return (
      <OnboardingCard
        instance={instance}
        message={
          <>
            HA-Modus konnte nicht geladen werden:{" "}
            <code>{error instanceof Error ? error.message : "Unbekannter Fehler"}</code>.
            Prüfe die HA-Integration unter <strong>Admin → Integrationen → Home Assistant</strong>
            oder wechsle das Widget in den Direct-Modus.
          </>
        }
        ctaLabel="HA-Integration prüfen"
      />
    );
  }

  if (!data.configured) {
    return (
      <OnboardingCard
        instance={instance}
        message={
          <>
            HA-Modus benötigt eine Group-Entity <code>group.esphome_devices</code>. Lege sie
            in HA an oder wechsle das Widget unter <strong>Admin → Widgets</strong> auf{" "}
            <strong>Direct</strong> (nutzt die ESPHome-Native-API direkt, kein HA nötig).
            {data.error && <span className="esphome-onboarding-error">{data.error}</span>}
          </>
        }
        ctaLabel="ESPHome-Setup öffnen"
      />
    );
  }

  if (!data.online) {
    return (
      <OnboardingCard
        instance={instance}
        message={
          <>
            Home Assistant ist nicht erreichbar:
            {" "}<code>{data.error ?? "no response"}</code>. Prüfe Token + URL unter{" "}
            <strong>Admin → Integrationen → Home Assistant</strong>.
          </>
        }
        ctaLabel="HA-Integration prüfen"
      />
    );
  }

  if (compact) {
    const allOnline = data.totals.offline === 0 && data.totals.total > 0;
    const color = allOnline ? "var(--status-ok)" : data.totals.offline > 0 ? "var(--status-warn)" : "var(--dim)";
    return (
      <WidgetLinkWrapper href={instance.linkUrl} className="widget-card widget-compact">
        <div className="widget-compact-icon" style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
          <Cpu size={22} />
        </div>
        <div className="widget-compact-body">
          <div className="widget-compact-label">ESPHome</div>
          <div className="widget-compact-value">
            {data.totals.online}<span className="widget-compact-value-sep">/</span>{data.totals.total}
          </div>
          <div className="widget-compact-sub">
            {data.totals.offline > 0 ? `${data.totals.offline} offline` : "alle online"}
          </div>
        </div>
      </WidgetLinkWrapper>
    );
  }

  return (
    <WidgetLinkWrapper href={instance.linkUrl} className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Cpu size={14} />
        <span className="widget-title">{instance.label}</span>
        {modeBadge}
        <span className="widget-badge">{data.totals.online}/{data.totals.total}</span>
      </div>
      <ul className="esphome-list">
        {data.devices.map((d) => (
          <li key={d.entityId} className="esphome-row">
            <span className="esphome-icon" style={{ color: d.online ? "var(--status-ok)" : "var(--status-error)" }}>
              {d.online ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            </span>
            <span className="esphome-name">{d.friendlyName}</span>
            <span className="esphome-meta">
              {d.online ? d.state : "offline"} · {timeAgo(d.lastChanged)}
            </span>
          </li>
        ))}
      </ul>
    </WidgetLinkWrapper>
  );
}

/* ── Main export: auto-detect mode ──────────────────────────────────────── */

export function EsphomeWidget(props: WidgetRenderProps) {
  const mode = ((props.instance.settings?.["mode"] as string | undefined) ?? "auto") as EsphomeMode;

  if (mode === "direct") {
    return <EsphomeDirectWidget {...props} modeBadge={<ModeBadge mode="direct" />} />;
  }
  if (mode === "ha") {
    return <EsphomeLegacyWidget {...props} modeBadge={<ModeBadge mode="ha" />} />;
  }
  return <EsphomeAutoWidget {...props} />;
}

function EsphomeAutoWidget(props: WidgetRenderProps) {
  const url = esphomeDirectUrl(props.instance);
  const { data: directData, isLoading } = useQuery<EsphomeDirectWidgetData>({
    queryKey: ["widget-esphome-direct-probe", url],
    queryFn: () => fetch(url).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <WidgetSkeleton compact={props.compact} label={props.instance.label} />;
  }

  if (directData?.configured) {
    return <EsphomeDirectWidget {...props} modeBadge={<ModeBadge mode="auto" resolved="direct" />} />;
  }
  return <EsphomeLegacyWidget {...props} modeBadge={<ModeBadge mode="auto" resolved="ha" />} />;
}
