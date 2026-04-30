"use client";

import { useQuery } from "@tanstack/react-query";
import type { NetworkWidgetData } from "@/app/api/widgets/network/route";

export function NetworkWidget({ label, refreshSec }: { label: string; refreshSec: number }) {
  const { data, isLoading } = useQuery<NetworkWidgetData>({
    queryKey: ["widget-network"],
    queryFn: () => fetch("/api/widgets/network").then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  return (
    <div className="card net-card">
      <div className="section-label">{label}</div>

      {isLoading && <div className="widget-loading">Prüfe Geräte…</div>}

      {data && data.entries.length === 0 && (
        <div className="widget-hint">
          Keine Netzwerk-Geräte konfiguriert — füge welche unter <strong>Admin → Netzwerk</strong> hinzu.
        </div>
      )}

      {data && data.entries.length > 0 && (
        <div className="net-list net-list-scroll">
          {data.entries.map((e) => {
            const badgeClass =
              e.status === "online" ? "nb-ok" :
              e.status === "offline" ? "nb-warn" : "";
            const badgeLabel =
              e.status === "online" ? "OK" :
              e.status === "offline" ? "STOPPED" : "—";
            const Row = (
              <>
                <div className="net-left">
                  <span className="net-icon">{e.iconEmoji}</span>
                  <div>
                    <div className="net-label">{e.label}</div>
                    {e.sub && <div className="net-sub">{e.sub}</div>}
                  </div>
                </div>
                <span className={`nbadge ${badgeClass}`}>{badgeLabel}</span>
              </>
            );
            return e.url ? (
              <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="net-row">{Row}</a>
            ) : (
              <div key={e.id} className="net-row">{Row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
