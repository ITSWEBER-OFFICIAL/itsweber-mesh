"use client";

import type { ComponentType } from "react";
import type { GridLayout, WidgetInstance, WidgetKind } from "@/server/config/schema";
import { UnraidWidget } from "./UnraidWidget";
import { HaWidget } from "./HaWidget";
import { AdguardWidget } from "./AdguardWidget";
import { SmartHomeWidget } from "./SmartHomeWidget";
import { NetworkWidget } from "./NetworkWidget";
import { StorageWidget } from "./StorageWidget";
import { UnifiWidget } from "./UnifiWidget";
import { GlancesWidget } from "./GlancesWidget";
import { CameraWidget } from "./CameraWidget";
import { WeatherWidget } from "./WeatherWidget";
import { UptimeKumaWidget } from "./UptimeKumaWidget";
import { EsphomeWidget } from "./EsphomeWidget";
import { Zigbee2MqttWidget } from "./Zigbee2MqttWidget";
import { UnifiProtectWidget } from "./UnifiProtectWidget";
import { FrigateWidget } from "./FrigateWidget";
import { PortainerWidget } from "./PortainerWidget";
import { SpeedtestWidget } from "./SpeedtestWidget";
import { PiholeWidget } from "./PiholeWidget";
import { CustomRestWidget } from "./CustomRestWidget";

/** Props passed to every widget by the SlotRenderer / BoardGrid. */
export type WidgetRenderProps = {
  instance: WidgetInstance;
  /** True when the widget is in a narrow tile (w < 16, i.e. less than two-thirds of the 24-col grid) and should render compact. */
  compact: boolean;
  /** Current live grid layout, including unsaved drag/resize changes. */
  layout: GridLayout;
  /** True when the current tile is wide enough for the detailed layout. */
  isWide: boolean;
};

export type WidgetSizeSpec = { w: number; h: number };

export type WidgetDefinition = {
  kind: WidgetKind;
  /** Human-readable label for the widget picker UI. */
  displayName: string;
  /** Short description for the widget picker UI. */
  description: string;
  /** Lucide icon name (or emoji fallback). */
  icon: string;
  /** True if the widget supports compact-mode in narrow tiles. Defaults to false. */
  supportsCompact: boolean;
  /** Default grid size when adding a new instance. */
  defaultSize: WidgetSizeSpec;
  /** Minimum allowed grid size for resize constraints. */
  minSize: WidgetSizeSpec;
  /** Maximum allowed grid size (24-col grid). */
  maxSize: WidgetSizeSpec;
  /** Width threshold (cols) at which the widget switches from compact to wide rendering. Defaults to 16. */
  wideThreshold?: number;
  /** Render function. */
  Component: ComponentType<WidgetRenderProps>;
};

/* ── Adapter wrappers ──────────────────────────────────────────────────────
   Existing widgets take {label, refreshSec, linkUrl?} directly. Until they
   are migrated to the unified WidgetRenderProps interface, we adapt here.
   New v0.4.x widgets (weather, esphome, etc.) ship with the unified API. */

function withClassicProps<P extends { label: string; refreshSec: number; linkUrl?: string; integrationIds?: string[]; compact?: boolean }>(
  Comp: ComponentType<P>,
) {
  return function Adapted({ instance, compact }: WidgetRenderProps) {
    const s = instance.settings ?? {};
    const integrationIds: string[] = Array.isArray(s["integrationIds"])
      ? (s["integrationIds"] as string[])
      : typeof s["integrationId"] === "string" && s["integrationId"]
      ? [s["integrationId"] as string]
      : [];
    const props = {
      label: instance.label,
      refreshSec: instance.refreshSec,
      ...(instance.linkUrl ? { linkUrl: instance.linkUrl } : {}),
      ...(integrationIds.length > 0 ? { integrationIds } : {}),
      compact,
    } as unknown as P;
    return <Comp {...props} />;
  };
}

function PendingWidget({ instance }: WidgetRenderProps) {
  return (
    <div className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <span className="text-[14px]">⏳</span>
        <span className="widget-title">{instance.label}</span>
      </div>
      <div className="widget-hint">
        {instance.kind}-Widget — Integration konfigurierbar, Widget-UI folgt in v0.4.x
      </div>
    </div>
  );
}

export const widgetRegistry: Record<WidgetKind, WidgetDefinition> = {
  unraid: {
    kind: "unraid",
    displayName: "Unraid Server",
    description: "Live-Stats von Unraid (CPU, RAM, Array)",
    icon: "Server",
    supportsCompact: false,
    defaultSize: { w: 6, h: 24 },
    minSize: { w: 4, h: 16 },
    maxSize: { w: 12, h: 48 },
    Component: withClassicProps(UnraidWidget),
  },
  homeassistant: {
    kind: "homeassistant",
    displayName: "Home Assistant",
    description: "Sensor-Übersicht + Personen-Status",
    icon: "Home",
    supportsCompact: false,
    defaultSize: { w: 8, h: 20 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 24, h: 48 },
    wideThreshold: 12,
    Component: ({ instance, isWide }: WidgetRenderProps) => (
      <HaWidget
        label={instance.label}
        refreshSec={instance.refreshSec}
        wide={isWide}
        {...(instance.linkUrl ? { linkUrl: instance.linkUrl } : {})}
      />
    ),
  },
  smartHome: {
    kind: "smartHome",
    displayName: "Smart Home",
    description: "Schnellüberblick Räume + Verbrauch",
    icon: "Lightbulb",
    supportsCompact: false,
    defaultSize: { w: 8, h: 14 },
    minSize: { w: 4, h: 7 },
    maxSize: { w: 24, h: 40 },
    Component: withClassicProps(SmartHomeWidget),
  },
  adguard: {
    kind: "adguard",
    displayName: "AdGuard Home",
    description: "DNS-Stats + Block-Rate",
    icon: "Shield",
    supportsCompact: true,
    defaultSize: { w: 6, h: 20 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 24, h: 40 },
    wideThreshold: 8,
    Component: withClassicProps(AdguardWidget),
  },
  unifi: {
    kind: "unifi",
    displayName: "UniFi Network",
    description: "Geräte- und Client-Übersicht",
    icon: "Network",
    supportsCompact: false,
    defaultSize: { w: 8, h: 20 },
    minSize: { w: 4, h: 12 },
    maxSize: { w: 24, h: 48 },
    wideThreshold: 12,
    Component: ({ instance, isWide }: WidgetRenderProps) => (
      <UnifiWidget label={instance.label} refreshSec={instance.refreshSec} wide={isWide} {...(instance.linkUrl ? { linkUrl: instance.linkUrl } : {})} />
    ),
  },
  network: {
    kind: "network",
    displayName: "Netzwerk-Geräte",
    description: "Liste konfigurierter Netzwerk-Geräte mit Health",
    icon: "Globe",
    supportsCompact: false,
    defaultSize: { w: 6, h: 24 },
    minSize: { w: 4, h: 6 },
    maxSize: { w: 12, h: 48 },
    Component: withClassicProps(NetworkWidget),
  },
  storage: {
    kind: "storage",
    displayName: "Speicher",
    description: "Storage-Übersicht (Array, Cache, Pools)",
    icon: "HardDrive",
    supportsCompact: false,
    defaultSize: { w: 6, h: 20 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 12, h: 40 },
    Component: withClassicProps(StorageWidget),
  },
  glances: {
    kind: "glances",
    displayName: "Glances",
    description: "Live-System-Stats von Glances",
    icon: "Activity",
    supportsCompact: false,
    defaultSize: { w: 6, h: 20 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 12, h: 40 },
    Component: withClassicProps(GlancesWidget),
  },
  cameras: {
    kind: "cameras",
    displayName: "Kameras",
    description: "Kamera-Snapshots",
    icon: "Camera",
    supportsCompact: false,
    defaultSize: { w: 8, h: 20 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 24, h: 40 },
    Component: withClassicProps(CameraWidget),
  },
  // v0.4.1 — live widgets
  weather: {
    kind: "weather",
    displayName: "Wetter",
    description: "Aktuelles Wetter + 5-Tage-Forecast",
    icon: "Sun",
    supportsCompact: false,
    defaultSize: { w: 8, h: 18 },
    minSize: { w: 4, h: 10 },
    maxSize: { w: 24, h: 32 },
    Component: WeatherWidget,
  },
  uptimeKuma: {
    kind: "uptimeKuma",
    displayName: "Uptime Kuma",
    description: "Status-Page-Monitore (öffentliche Slug)",
    icon: "Activity",
    supportsCompact: true,
    defaultSize: { w: 6, h: 16 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 24, h: 40 },
    Component: UptimeKumaWidget,
  },
  esphome: {
    kind: "esphome",
    displayName: "ESPHome",
    description: "ESPHome-Geräte direkt via REST oder via HA-Group",
    icon: "Cpu",
    supportsCompact: true,
    defaultSize: { w: 8, h: 16 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 24, h: 48 },
    /* Wide layout (Device-Liste mit Sensoren) ab 6 Spalten — der esphome-device-grid
       (auto-fill, minmax(220px, 1fr)) kollabiert sauber auf eine Spalte bei schmalen
       Breiten, also lieber Wide-Layout behalten als zu früh in die Compact-Kachel
       (nur Online-Counter) springen. Compact erst bei w=4–5. */
    wideThreshold: 6,
    Component: EsphomeWidget,
  },
  zigbee2mqtt: {
    kind: "zigbee2mqtt",
    displayName: "Zigbee2MQTT",
    description: "Z2M-Geräte: online/offline, Akku-Tracking, Auto-Discovery via HA",
    icon: "Radio",
    supportsCompact: false,
    defaultSize: { w: 8, h: 16 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 24, h: 48 },
    wideThreshold: 12,
    Component: Zigbee2MqttWidget,
  },
  portainer: {
    kind: "portainer",
    displayName: "Portainer",
    description: "Container-Übersicht (Stacks + Status)",
    icon: "Box",
    supportsCompact: false,
    defaultSize: { w: 12, h: 20 },
    minSize: { w: 8, h: 12 },
    maxSize: { w: 24, h: 40 },
    Component: PortainerWidget,
  },
  speedtest: {
    kind: "speedtest",
    displayName: "Speedtest",
    description: "Download / Upload / Ping via Speedtest-Tracker",
    icon: "Zap",
    supportsCompact: true,
    defaultSize: { w: 8, h: 16 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 24, h: 40 },
    wideThreshold: 10,
    Component: SpeedtestWidget,
  },
  pihole: {
    kind: "pihole",
    displayName: "Pi-hole",
    description: "DNS-Stats + Block-Rate",
    icon: "Shield",
    supportsCompact: true,
    defaultSize: { w: 6, h: 16 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 12, h: 32 },
    Component: PiholeWidget,
  },
  unifiProtect: {
    kind: "unifiProtect",
    displayName: "UniFi Protect",
    description: "Kameras + Snapshot-Proxy",
    icon: "Video",
    supportsCompact: true,
    defaultSize: { w: 12, h: 20 },
    minSize: { w: 6, h: 10 },
    maxSize: { w: 24, h: 40 },
    Component: UnifiProtectWidget,
  },
  frigate: {
    kind: "frigate",
    displayName: "Frigate",
    description: "Letzte Events + Thumbnails",
    icon: "Eye",
    supportsCompact: false,
    defaultSize: { w: 12, h: 20 },
    minSize: { w: 8, h: 12 },
    maxSize: { w: 24, h: 40 },
    Component: FrigateWidget,
  },
  customRest: {
    kind: "customRest",
    displayName: "Custom REST",
    description: "Generischer JSON-Endpoint mit JSONPath",
    icon: "Code",
    supportsCompact: true,
    defaultSize: { w: 6, h: 16 },
    minSize: { w: 4, h: 8 },
    maxSize: { w: 24, h: 40 },
    Component: CustomRestWidget,
  },
};

export function getWidgetDefinition(kind: WidgetKind): WidgetDefinition {
  return widgetRegistry[kind];
}
