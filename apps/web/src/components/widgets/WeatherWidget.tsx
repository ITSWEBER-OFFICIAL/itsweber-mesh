"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog,
  CloudDrizzle, CloudRain, CloudHail, CloudSnow, Snowflake, CloudLightning,
  Wind, Droplets, MapPin,
} from "lucide-react";
import type { ComponentType } from "react";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";
import { WidgetSkeleton } from "@/components/ui/Skeleton";
import type { WeatherWidgetData } from "@/app/api/widgets/weather/route";
import type { WidgetRenderProps } from "./registry";
import type { WmoIconName } from "@/lib/weather-codes";

const ICON_MAP: Record<WmoIconName, ComponentType<{ size?: number; className?: string }>> = {
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog,
  CloudDrizzle, CloudRain, CloudHail, CloudSnow, Snowflake, CloudLightning,
};

function WmoIcon({ name, size = 16 }: { name: WmoIconName; size?: number }) {
  const Comp = ICON_MAP[name] ?? Cloud;
  return <Comp size={size} />;
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
}

function unitSuffix(unit: "celsius" | "fahrenheit" | undefined): string {
  return unit === "fahrenheit" ? "°F" : "°";
}

export function WeatherWidget({ instance, compact }: WidgetRenderProps) {
  const { data, isLoading, error } = useQuery<WeatherWidgetData>({
    queryKey: ["widget-weather"],
    queryFn: () => fetch("/api/widgets/weather").then((r) => r.json()),
    refetchInterval: instance.refreshSec * 1000,
    staleTime: Math.max(1, instance.refreshSec - 2) * 1000,
  });

  if (isLoading) return <WidgetSkeleton compact={compact} label={instance.label} />;

  if (error || !data) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <Sun size={14} className="weather-icon" />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-error-message">
          {error instanceof Error ? error.message : "Wetter-Daten konnten nicht geladen werden"}
        </div>
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="widget-card">
        <span className="widget-accent" />
        <div className="widget-header">
          <Sun size={14} className="weather-icon" />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-hint">
          Wetter nicht konfiguriert — setze Lat/Lon unter <strong>Admin → Integrationen → Wetter</strong>.
        </div>
      </div>
    );
  }

  if (!data.online || !data.current) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <Sun size={14} className="weather-icon" />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-error-message">{data.error ?? "Open-Meteo nicht erreichbar"}</div>
      </div>
    );
  }

  const unit = unitSuffix(data.unit);
  const c = data.current;

  /* ── Compact: horizontal, ein Eintrag pro Slot-Tile ────────────────────── */
  if (compact) {
    return (
      <WidgetLinkWrapper href={instance.linkUrl} className="widget-card widget-compact">
        <div className="widget-compact-icon weather-compact-icon">
          <WmoIcon name={c.icon} size={26} />
        </div>
        <div className="widget-compact-body">
          <div className="widget-compact-label">{data.location?.name ?? "Wetter"}</div>
          <div className="widget-compact-value">
            {Math.round(c.temperature)}{unit}
          </div>
          <div className="widget-compact-sub">
            {c.label} · gefühlt {Math.round(c.apparent)}{unit}
          </div>
        </div>
      </WidgetLinkWrapper>
    );
  }

  /* ── Sidebar: vertikal mit 5-Tage-Forecast ─────────────────────────────── */
  return (
    <WidgetLinkWrapper href={instance.linkUrl} className="widget-card weather-widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Sun size={14} className="weather-icon" />
        <span className="widget-title">{instance.label}</span>
      </div>

      <div className="weather-main">
        <span className="weather-icon-large">
          <WmoIcon name={c.icon} size={42} />
        </span>
        <div className="weather-temp-block">
          <div className="weather-temp-big">{Math.round(c.temperature)}{unit}</div>
          <div className="weather-loc-row">
            <MapPin size={11} /> <span>{data.location?.name}</span>
          </div>
        </div>
      </div>

      <div className="weather-state">{c.label}</div>

      <div className="weather-extra">
        <span><Wind size={11} /> {Math.round(c.windSpeed)} km/h</span>
        {c.humidity !== undefined && (
          <span><Droplets size={11} /> {Math.round(c.humidity)}%</span>
        )}
        <span>gefühlt {Math.round(c.apparent)}{unit}</span>
      </div>

      {data.daily && data.daily.length > 1 && (
        <div className="weather-forecast">
          {data.daily.slice(1, 6).map((d) => (
            <div key={d.date} className="weather-forecast-day">
              <div className="weather-forecast-label">{shortDay(d.date)}</div>
              <div className="weather-forecast-icon">
                <WmoIcon name={d.icon} size={18} />
              </div>
              <div className="weather-forecast-temps">
                <span className="weather-temp-max">{Math.round(d.tempMax)}</span>
                <span className="weather-temp-sep">/</span>
                <span className="weather-temp-min">{Math.round(d.tempMin)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetLinkWrapper>
  );
}
