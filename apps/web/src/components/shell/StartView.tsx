"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { pickUrl, situation, segmentSentence } from "@/lib/service-view";
import type { UnraidWidgetData } from "@/app/api/widgets/unraid/route";
import { Screen, Dot } from "./AppShell";
import { Ring } from "./Ring";
import { DownList } from "./DownList";
import { useMeshData } from "./useMeshData";
import { useHints, HintList } from "./Hints";

export function StartView() {
  const { overview, services, pings, internal, health, down, loading } = useMeshData();
  const [selected, setSelected] = useState(-1);
  const hints = useHints();
  const urgent = down.length + hints.urgent.length;

  const { data: unraid } = useQuery<UnraidWidgetData>({
    queryKey: ["widget-unraid"],
    queryFn: () => fetch("/api/widgets/unraid").then((r) => (r.ok ? r.json() : { instances: [] })),
    refetchInterval: 30_000,
  });

  const seg = selected >= 0 ? overview.segments[selected] : undefined;
  const say = loading ? { lead: "Lage wird geladen.", rest: "" } : seg ? segmentSentence(seg) : situation(overview);
  const pinned = services.filter((s) => s.pinnedToHome);

  const pegel = (unraid?.instances ?? []).flatMap((inst) => {
    if (!inst.online) return [];
    const rows: { label: string; percent: number; value: string }[] = [];
    const cap = inst.data.array?.capacity;
    if (cap) rows.push({ label: `${inst.label} Array`, percent: cap.percent, value: `${Math.round(cap.percent)} %` });
    const c = inst.data.containers;
    if (c && c.total > 0) rows.push({ label: `${inst.label} Container`, percent: (c.running / c.total) * 100, value: `${c.running}/${c.total}` });
    return rows;
  });

  return (
    <Screen
      title="Mesh"
      brand
      context={internal ? "Heimnetz · intern" : "Unterwegs · extern"}
      kanzel={
        <>
          <Ring segments={overview.segments} urgent={urgent} selected={selected} onSelect={setSelected} />
          <p className="m-say" aria-live="polite">
            {say.lead} <span>{say.rest}</span>
          </p>
        </>
      }
    >
      <section className="m-sec">
        <h2 className="m-h">Dringend · {urgent}</h2>
        {urgent === 0 ? (
          <div className="m-msg">
            <Dot state="ok" />
            <div>
              <b>Nichts Dringendes</b>
              <small>Dienste, Server und Zertifikate sind in Ordnung</small>
            </div>
          </div>
        ) : (
          <>
            <HintList hints={hints.urgent} limit={3} />
            <DownList services={down} pings={pings} limit={Math.max(0, 3 - hints.urgent.length)} />
          </>
        )}
        {(urgent > 3 || hints.watch.length > 0) && (
          <Link href="/hinweise" className="m-btn" style={{ alignSelf: "flex-start", marginTop: 8 }}>
            {urgent > 3 ? `Alle ${urgent} ansehen` : `Im Blick · ${hints.watch.length}`}
          </Link>
        )}
      </section>

      {pegel.length > 0 && (
        <section className="m-sec" style={{ gap: 6 }}>
          <h2 className="m-h">Server</h2>
          {pegel.map((p) => (
            <div className="m-pegel" key={p.label}>
              <span>{p.label}</span>
              <div className="m-track">
                <i className={p.label.endsWith("Array") && p.percent >= 85 ? "warn" : ""} style={{ width: `${Math.min(100, p.percent)}%` }} />
              </div>
              <span className="v">{p.value}</span>
            </div>
          ))}
        </section>
      )}

      {pinned.length > 0 && (
        <section className="m-sec">
          <h2 className="m-h">Schnellzugriff</h2>
          <div className="m-quick">
            {pinned.map((s) => (
              <a key={s.id} href={pickUrl(s, internal).href} target="_blank" rel="noopener noreferrer">
                <Dot state={health(s)} />
                <span>{s.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </Screen>
  );
}
