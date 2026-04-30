"use client";

import { useQuery } from "@tanstack/react-query";
import { HardDrive } from "lucide-react";
import type { UnraidWidgetData } from "@/app/api/widgets/unraid/route";

type StorageEntry = {
  id: string;
  label: string;
  usedTb: number;
  totalTb: number;
  percent: number;
};

export function StorageWidget({ label, refreshSec, integrationIds }: { label: string; refreshSec: number; integrationIds?: string[] }) {
  const idsKey = integrationIds?.join(",") ?? "all";
  const url = integrationIds?.length ? `/api/widgets/unraid?ids=${integrationIds.join(",")}` : "/api/widgets/unraid";
  const { data, isLoading } = useQuery<UnraidWidgetData>({
    queryKey: ["widget-unraid", idsKey],
    queryFn: () => fetch(url).then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  const entries: StorageEntry[] = (data?.instances ?? [])
    .flatMap((inst) =>
      inst.online && inst.data.array?.capacity
        ? [{
            id: inst.id,
            label: inst.label,
            usedTb: inst.data.array.capacity.usedTb,
            totalTb: inst.data.array.capacity.totalTb,
            percent: inst.data.array.capacity.percent,
          }]
        : []
    );

  const sumUsed = entries.reduce((s, e) => s + e.usedTb, 0);
  const sumTotal = entries.reduce((s, e) => s + e.totalTb, 0);
  const sumFree = Math.max(0, Math.round((sumTotal - sumUsed) * 100) / 100);

  return (
    <div className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <HardDrive size={14} style={{ color: "var(--brand)" }} />
        <span className="widget-title">{label}</span>
      </div>

      {isLoading && <div className="widget-loading">Lade…</div>}

      {!isLoading && entries.length === 0 && (
        <div className="widget-hint">Keine Unraid-Instanz konfiguriert.</div>
      )}

      {entries.length > 0 && (
        <div className="storage-layout">
          <div className="stor-bars">
            {entries.map((e, i) => (
              <div key={e.id} className="stor-col">
                <div className="stor-track">
                  <div
                    className={`stor-fill ${i === 0 ? "stor-fill-teal" : "stor-fill-dim"}`}
                    style={{ height: `${Math.min(100, e.percent)}%` }}
                  />
                </div>
                <div className="stor-name">{e.label}</div>
              </div>
            ))}
          </div>
          <div className="stor-info">
            {entries.map((e) => (
              <div key={e.id} className="stor-row">
                <span className="stor-key">{e.label}</span>
                <span className="stor-val">{e.usedTb} / {e.totalTb} TB</span>
              </div>
            ))}
            {entries.length > 1 && (
              <div className="stor-row">
                <span className="stor-key">Gesamt</span>
                <span className="stor-val">{Math.round(sumUsed * 100) / 100} / {Math.round(sumTotal * 100) / 100} TB</span>
              </div>
            )}
            <div className="stor-row">
              <span className="stor-key">Frei</span>
              <span className="stor-val good">{sumFree} TB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
