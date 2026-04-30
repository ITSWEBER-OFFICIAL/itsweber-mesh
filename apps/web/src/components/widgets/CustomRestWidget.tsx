"use client";

import { useQuery } from "@tanstack/react-query";
import { Code, WifiOff, RefreshCw } from "lucide-react";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";
import { WidgetSkeleton } from "@/components/ui/Skeleton";
import type { CustomRestWidgetData, CustomRestSettings, CustomRestTile } from "@/app/api/widgets/custom-rest/route";
import type { WidgetRenderProps } from "./registry";

function parseSettings(raw: Record<string, unknown>): CustomRestSettings {
  const s: CustomRestSettings = {
    method: raw["method"] === "POST" ? "POST" : "GET",
    headers: Array.isArray(raw["headers"]) ? (raw["headers"] as { key: string; value: string }[]) : [],
    displayMode: (raw["displayMode"] as CustomRestSettings["displayMode"]) ?? "tiles",
    tiles: Array.isArray(raw["tiles"]) ? (raw["tiles"] as CustomRestTile[]) : [],
  };
  if (typeof raw["url"] === "string") s.url = raw["url"];
  if (typeof raw["body"] === "string") s.body = raw["body"];
  return s;
}

export function CustomRestWidget({ instance, compact }: WidgetRenderProps) {
  const settings = parseSettings(instance.settings);
  const hasUrl = !!settings.url;

  const { data, isLoading, refetch, isFetching } = useQuery<CustomRestWidgetData>({
    queryKey: ["widget-custom-rest", instance.id, settings.url],
    queryFn: () =>
      fetch("/api/widgets/custom-rest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      }).then((r) => r.json()),
    enabled: hasUrl,
    refetchInterval: instance.refreshSec * 1000,
    staleTime: Math.max(1, instance.refreshSec - 2) * 1000,
  });

  if (!hasUrl) {
    return (
      <div className="widget-card">
        <span className="widget-accent custom-rest-accent" />
        <div className="widget-header">
          <Code size={14} className="custom-rest-icon" />
          <span className="widget-title">{instance.label}</span>
        </div>
        <div className="widget-hint">
          Keine URL konfiguriert — <strong>Widget bearbeiten → URL eintragen</strong>
        </div>
      </div>
    );
  }

  if (isLoading) return <WidgetSkeleton compact={compact} label={instance.label} />;

  const tiles = data?.resolvedTiles ?? [];
  const isError = !data?.ok;

  /* ── Compact ───────────────────────────────────────────────────────────── */
  if (compact) {
    const firstTile = tiles[0];
    return (
      <WidgetLinkWrapper href={instance.linkUrl} className="widget-card widget-compact">
        <div className="widget-compact-icon custom-rest-compact-icon">
          <Code size={22} />
        </div>
        <div className="widget-compact-body">
          <div className="widget-compact-label">{instance.label}</div>
          {isError ? (
            <div className="widget-compact-value custom-rest-error-text">Fehler</div>
          ) : firstTile ? (
            <>
              <div className="widget-compact-value">{firstTile.value}{firstTile.unit ? ` ${firstTile.unit}` : ""}</div>
              <div className="widget-compact-sub">{firstTile.label}</div>
            </>
          ) : (
            <div className="widget-compact-sub">Keine Tiles definiert</div>
          )}
        </div>
      </WidgetLinkWrapper>
    );
  }

  /* ── Sidebar ───────────────────────────────────────────────────────────── */
  return (
    <WidgetLinkWrapper href={instance.linkUrl} className="widget-card">
      <span className="widget-accent custom-rest-accent" />
      <div className="widget-header">
        <Code size={14} className="custom-rest-icon" />
        <span className="widget-title">{instance.label}</span>
        <button
          type="button"
          className="ml-auto custom-rest-refresh-btn"
          onClick={() => void refetch()}
          title="Jetzt aktualisieren"
        >
          <RefreshCw size={10} className={isFetching ? "animate-spin" : ""} />
        </button>
        {data?.status && (
          <span className={`widget-badge ${isError ? "widget-badge-err" : ""}`}>
            {data.status}
          </span>
        )}
      </div>

      {isError && (
        <div className="widget-error">
          <WifiOff size={11} />
          {data?.error ?? "Verbindungsfehler"}
        </div>
      )}

      {!isError && settings.displayMode === "raw" && (
        <pre className="custom-rest-raw">{JSON.stringify(data?.raw, null, 2)}</pre>
      )}

      {!isError && settings.displayMode === "single" && (
        <div className="custom-rest-single">
          {String(data?.raw ?? "—")}
        </div>
      )}

      {!isError && (settings.displayMode === "tiles" || !settings.displayMode) && (
        <>
          {tiles.length === 0 && (
            <div className="widget-hint">Keine Tiles konfiguriert — Widget bearbeiten.</div>
          )}
          <div className="custom-rest-tiles">
            {tiles.map((t, i) => (
              <div key={i} className="custom-rest-tile">
                <span className="custom-rest-tile-label">{t.label}</span>
                <span className="custom-rest-tile-value">
                  {t.value}
                  {t.unit && <span className="custom-rest-tile-unit"> {t.unit}</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </WidgetLinkWrapper>
  );
}
