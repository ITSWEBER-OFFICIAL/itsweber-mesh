"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Home, Thermometer, Wifi, WifiOff,
  Lightbulb, DoorOpen, Eye, Users, Zap, Cog,
} from "lucide-react";
import type { HaWidgetData, HaDomainSummary } from "@/app/api/widgets/homeassistant/route";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";

const DEVICE_CLASS_ICON: Record<string, string> = {
  temperature: "🌡️",
  humidity: "💧",
  motion: "👁️",
  door: "🚪",
  window: "🪟",
  light: "💡",
  power: "⚡",
  energy: "🔋",
};

function formatState(state: string, unit?: string): string {
  if (state === "on") return "An";
  if (state === "off") return "Aus";
  if (state === "home") return "Zuhause";
  if (state === "not_home") return "Unterwegs";
  if (state === "unavailable") return "–";
  if (unit) {
    const v = parseFloat(state);
    return Number.isFinite(v) ? `${v.toFixed(1)} ${unit}` : state;
  }
  return state;
}

function SummaryChip({
  Icon, value, hint, tone,
}: {
  Icon: React.ComponentType<{ size?: number }>;
  value: React.ReactNode;
  hint: string;
  tone?: "ok" | "warn" | "info";
}) {
  const toneClass =
    tone === "ok" ? "ha-chip--ok" :
    tone === "warn" ? "ha-chip--warn" :
    "ha-chip--info";
  return (
    <div className={`ha-chip ${toneClass}`}>
      <span className="ha-chip-icon"><Icon size={12} /></span>
      <div className="ha-chip-body">
        <span className="ha-chip-value">{value}</span>
        <span className="ha-chip-hint">{hint}</span>
      </div>
    </div>
  );
}

function SummarySection({ summary }: { summary: HaDomainSummary }) {
  const chips: React.ReactNode[] = [];

  if (summary.lights.on > 0 || summary.lights.off > 0) {
    chips.push(
      <SummaryChip
        key="lights"
        Icon={Lightbulb}
        value={`${summary.lights.on}/${summary.lights.on + summary.lights.off}`}
        hint="Lampen an"
        tone={summary.lights.on > 0 ? "ok" : "info"}
      />,
    );
  }

  const doorsOpen = summary.doors.open + summary.windows.open;
  const doorsTotal = doorsOpen + summary.doors.closed + summary.windows.closed;
  if (doorsTotal > 0) {
    chips.push(
      <SummaryChip
        key="doors"
        Icon={DoorOpen}
        value={`${doorsOpen}`}
        hint={doorsOpen > 0 ? "offen" : "alles zu"}
        tone={doorsOpen > 0 ? "warn" : "ok"}
      />,
    );
  }

  if (summary.motion.total > 0) {
    chips.push(
      <SummaryChip
        key="motion"
        Icon={Eye}
        value={`${summary.motion.active}/${summary.motion.total}`}
        hint="Bewegung"
        tone={summary.motion.active > 0 ? "warn" : "info"}
      />,
    );
  }

  if (summary.people.home > 0 || summary.people.away > 0) {
    chips.push(
      <SummaryChip
        key="people"
        Icon={Users}
        value={summary.people.home}
        hint={`zuhause · ${summary.people.away} weg`}
        tone={summary.people.home > 0 ? "ok" : "info"}
      />,
    );
  }

  if (summary.avgTemperatureC !== undefined) {
    chips.push(
      <SummaryChip
        key="temp"
        Icon={Thermometer}
        value={`${summary.avgTemperatureC}°C`}
        hint="Ø Temperatur"
        tone="info"
      />,
    );
  }

  if (summary.totalPowerW !== undefined && summary.totalPowerW > 0) {
    const display = summary.totalPowerW >= 1000
      ? `${(summary.totalPowerW / 1000).toFixed(1)} kW`
      : `${summary.totalPowerW} W`;
    chips.push(
      <SummaryChip
        key="power"
        Icon={Zap}
        value={display}
        hint="Verbrauch"
        tone="info"
      />,
    );
  }

  if (summary.climate.total > 0) {
    chips.push(
      <SummaryChip
        key="climate"
        Icon={Cog}
        value={`${summary.climate.active}/${summary.climate.total}`}
        hint="Klima aktiv"
        tone={summary.climate.active > 0 ? "ok" : "info"}
      />,
    );
  }

  if (chips.length === 0) return null;

  return <div className="ha-summary-grid">{chips}</div>;
}

function EntityList({ entities }: { entities: NonNullable<HaWidgetData["entities"]> }) {
  return (
    <div className="flex flex-col gap-[6px]">
      {entities.map((e) => {
        const icon = DEVICE_CLASS_ICON[e.attributes.device_class ?? ""]
          ?? (e.entity_id.startsWith("light.") ? "💡"
              : e.entity_id.startsWith("person.") ? "🧍"
              : "●");
        const name = e.attributes.friendly_name ?? e.entity_id;
        const val = formatState(e.state, e.attributes.unit_of_measurement);
        return (
          <div key={e.entity_id} className="widget-stat-row">
            <span className="text-[11px] leading-none flex-shrink-0">{icon}</span>
            <span className="widget-stat-label truncate" title={name}>{name}</span>
            <span
              className={`widget-stat-value font-mono text-[10px] flex-shrink-0${e.state === "on" || e.state === "home" ? " widget-stat-ok" : e.state === "off" ? " ha-state-off" : ""}`}
            >
              {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HaWidget({
  label, refreshSec, linkUrl, wide,
}: { label: string; refreshSec: number; linkUrl?: string; wide?: boolean }) {
  const { data, isLoading } = useQuery<HaWidgetData>({
    queryKey: ["widget-homeassistant"],
    queryFn: () => fetch("/api/widgets/homeassistant").then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  const href = linkUrl || (data?.online ? data.baseUrl : undefined);

  return (
    <WidgetLinkWrapper href={href} className="widget-card">
      <span className="widget-accent ha-accent" />
      <div className="widget-header">
        <Home size={14} className="ha-icon" />
        <span className="widget-title">{label}</span>
        {data?.online
          ? <span className="widget-status-ok ml-auto"><Wifi size={10} />Online</span>
          : data?.configured
          ? <span className="widget-status-err ml-auto"><WifiOff size={10} />Offline</span>
          : null
        }
        {data?.online && data.entityCount !== undefined && (
          <span className="widget-badge">{data.entityCount}</span>
        )}
      </div>

      {isLoading && <div className="widget-loading">Verbinde…</div>}

      {data && !data.configured && (
        <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen</strong></div>
      )}

      {data?.configured && !data.online && (
        <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
      )}

      {data?.online && data.summary && (
        wide ? (
          <div className="ha-wide-layout">
            <div className="ha-wide-summary">
              <SummarySection summary={data.summary} />
            </div>
            {data.entities && data.entities.length > 0 && (
              <div className="ha-wide-entities">
                <span className="ha-section-heading">Aktiv jetzt</span>
                <EntityList entities={data.entities} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[10px]">
            <SummarySection summary={data.summary} />
            {data.entities && data.entities.length > 0 && (
              <>
                <div className="widget-divider" />
                <EntityList entities={data.entities} />
              </>
            )}
          </div>
        )
      )}
    </WidgetLinkWrapper>
  );
}
