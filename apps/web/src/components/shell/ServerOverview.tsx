"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc-client";
import type { UnraidWidgetData } from "@/app/api/widgets/unraid/route";
import type { NetworkWidgetData } from "@/app/api/widgets/network/route";
import type { UnifiWidgetData } from "@/app/api/widgets/unifi/route";
import type { AdguardWidgetData } from "@/app/api/widgets/adguard/route";
import { Screen, Dot } from "./AppShell";
import { useHints } from "./useHints";
import { layoutNetMap, shortLabel, type MapNode, type NodeState } from "@/lib/net-map";

const getJson = <T,>(url: string, empty: T) => (): Promise<T> =>
  fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : empty));

const nf = new Intl.NumberFormat("de-DE");

/* ── Netzplan in der Kanzel ──────────────────────────────────────────────── */
function NetMap({ nodes, selected, onSelect }: { nodes: MapNode[]; selected: string | null; onSelect: (key: string) => void }) {
  const { placed, lines, height } = layoutNetMap(nodes);
  return (
    <svg className="m-map" viewBox={`0 0 340 ${height}`} role="group" aria-label="Netzplan">
      {lines.map((l) => (
        <line key={`${l.from}-${l.to}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      {placed.map((n) => {
        const inside = n.r >= 24;
        return (
          <g
            key={n.key}
            className={`nd ${n.state} ${n.key === selected ? "sel" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`${n.label}, ${STATE_LABEL[n.state]}`}
            aria-pressed={n.key === selected}
            onClick={() => onSelect(n.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(n.key);
              }
            }}
          >
            <circle cx={n.x} cy={n.y} r={Math.max(22, n.r + 6)} fill="transparent" />
            <circle className="s" cx={n.x} cy={n.y} r={n.r + 5} />
            {n.state === "bad" ? (
              <rect className="b" x={n.x - n.r * 0.86} y={n.y - n.r * 0.86} width={n.r * 1.72} height={n.r * 1.72} rx={3} />
            ) : n.state === "warn" ? (
              <rect className="b" x={n.x - n.r * 0.8} y={n.y - n.r * 0.8} width={n.r * 1.6} height={n.r * 1.6} rx={3} transform={`rotate(45 ${n.x} ${n.y})`} />
            ) : (
              <circle className="b" cx={n.x} cy={n.y} r={n.r} />
            )}
            <text x={n.x} y={inside ? n.y + 4 : n.y + n.r + 15} className={inside ? "in" : ""}>
              {n.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const STATE_LABEL: Record<NodeState, string> = { ok: "läuft", warn: "Achtung", bad: "Störung", unknown: "ungeprüft" };

/* ── Server ──────────────────────────────────────────────────────────────── */
export function ServerView() {
  const { data: nodes = [] } = trpc.infraNodes.list.useQuery();
  const hints = useHints();
  const { data: unraid } = useQuery({
    queryKey: ["widget-unraid"],
    queryFn: getJson<UnraidWidgetData>("/api/widgets/unraid", { instances: [] }),
    refetchInterval: 30_000,
  });
  const { data: network } = useQuery({
    queryKey: ["widget-network"],
    queryFn: getJson<NetworkWidgetData>("/api/widgets/network", { entries: [] }),
    refetchInterval: 30_000,
  });
  const { data: unifi } = useQuery({
    queryKey: ["widget-unifi"],
    queryFn: getJson<UnifiWidgetData>("/api/widgets/unifi", { configured: false, online: false }),
    refetchInterval: 60_000,
  });
  const { data: adguard } = useQuery({
    queryKey: ["widget-adguard"],
    queryFn: getJson<AdguardWidgetData>("/api/widgets/adguard", { configured: false, online: false }),
    refetchInterval: 60_000,
  });
  const [selected, setSelected] = useState<string | null>(null);

  const enabled = nodes.filter((n) => n.enabled);
  const devices = network?.entries ?? [];
  const all = [...hints.urgent, ...hints.watch];

  const serverState = (node: (typeof enabled)[number]): NodeState => {
    if (!node.integrationRef) return "unknown";
    const inst = unraid?.instances.find((i) => i.id === node.integrationRef?.id);
    if (!inst) return "unknown";
    if (!inst.online) return "bad";
    const own = all.filter((h) => h.system === inst.label);
    if (own.some((h) => h.level === "urgent")) return "bad";
    return own.length > 0 ? "warn" : "ok";
  };

  const gatewayState: NodeState = !unifi?.configured ? "unknown" : unifi.online ? "ok" : "bad";
  const mapNodes: MapNode[] = [
    { key: "gateway", label: unifi?.stats?.gateway?.name ?? "Netzwerk", short: "Netz", state: gatewayState, role: "gateway" },
    ...enabled.map((n) => ({ key: `server-${n.id}`, label: n.label, short: shortLabel(n.label), state: serverState(n), role: "server" as const })),
    ...devices.map((d) => ({
      key: `device-${d.id}`,
      label: d.label,
      short: shortLabel(d.label),
      state: (d.status === "online" ? "ok" : d.status === "offline" ? "bad" : "unknown") as NodeState,
      role: "device" as const,
    })),
  ];

  const select = (key: string) => {
    setSelected(key);
    document.getElementById(key === "gateway" ? "net-gateway" : key)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const u = unifi?.stats;
  const a = adguard?.stats;

  return (
    <Screen
      title="Server"
      small
      context={`${enabled.length + devices.length} Geräte`}
      kanzel={<NetMap nodes={mapNodes} selected={selected} onSelect={select} />}
    >
      <section className="m-sec">
        <h2 className="m-h">Server · {enabled.length}</h2>
        {enabled.length === 0 && <p className="m-note">Noch keine Server angelegt.</p>}
        <div className="m-sheets">
          {enabled.map((node) => {
            const inst = unraid?.instances.find((i) => i.id === node.integrationRef?.id);
            const data = inst?.online ? inst.data : undefined;
            const state = serverState(node);
            const cap = data?.array?.capacity;
            const own = inst ? all.filter((h) => h.system === inst.label) : [];
            return (
              <article className={`m-sheet ${selected === `server-${node.id}` ? "sel" : ""}`} key={node.id} id={`server-${node.id}`}>
                <h3>
                  <Dot state={state} />
                  {node.label}
                  <small>{data?.unraidVersion ? `Unraid ${data.unraidVersion}` : node.versionOverride ?? node.ip ?? ""}</small>
                </h3>
                {data ? (
                  <div className="m-kv">
                    <div>
                      <b>{cap ? `${Math.round(cap.percent)} %` : "–"}</b>
                      <span>Array</span>
                    </div>
                    <div>
                      <b>{data.containers ? `${data.containers.running}/${data.containers.total}` : "–"}</b>
                      <span>Container</span>
                    </div>
                    <div>
                      <b>{data.vms ? `${data.vms.running}/${data.vms.total}` : "–"}</b>
                      <span>VMs</span>
                    </div>
                  </div>
                ) : (
                  <p className="m-note">
                    {state === "bad" ? "Die Schnittstelle antwortet nicht." : "Keine Live-Werte, es ist keine Schnittstelle verknüpft."}
                  </p>
                )}
                {own.length > 0 && (
                  <p className="m-note">
                    {own.length === 1 ? own[0]?.title : `${own.length} Hinweise, zuerst: ${own[0]?.title}`}
                  </p>
                )}
                {(node.linkUrl || node.integrationRef) && (
                  <div className="m-act">
                    {node.integrationRef && (
                      <Link className="m-btn p" href={`/server/${node.id}`}>
                        Platten, Container, VMs
                      </Link>
                    )}
                    {node.linkUrl && (
                      <a className={node.integrationRef ? "m-btn" : "m-btn p"} href={node.linkUrl} target="_blank" rel="noopener noreferrer">
                        Oberfläche
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {(unifi?.configured || adguard?.configured) && (
        <section className="m-sec">
          <h2 className="m-h">Netz</h2>
          <div className="m-sheets">
            {unifi?.configured && (
              <article className={`m-sheet ${selected === "gateway" ? "sel" : ""}`} id="net-gateway">
                <h3>
                  <Dot state={gatewayState} />
                  {u?.gateway?.name ?? "UniFi"}
                  <small>{u?.gateway?.model ?? ""}</small>
                </h3>
                {unifi.online && u ? (
                  <>
                    <div className="m-kv">
                      <div>
                        <b>{u.devices.online}/{u.devices.total}</b>
                        <span>Geräte online</span>
                      </div>
                      <div>
                        <b>{nf.format(u.clients.total)}</b>
                        <span>Clients</span>
                      </div>
                      <div>
                        <b>{typeof u.wan?.latencyMs === "number" ? `${Math.round(u.wan.latencyMs)} ms` : "–"}</b>
                        <span>Internet</span>
                      </div>
                    </div>
                    <p className="m-note">
                      {[
                        `${u.clients.wired} per Kabel, ${u.clients.wireless} per WLAN`,
                        u.gateway ? `Gateway CPU ${u.gateway.cpu} %, Speicher ${u.gateway.mem} %` : "",
                        u.wan?.ispName ?? "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {u.subsystems.some((s) => s.status !== "ok") && (
                      <p className="m-note">Auffällig: {u.subsystems.filter((s) => s.status !== "ok").map((s) => `${s.name} ${s.status}`).join(", ")}</p>
                    )}
                  </>
                ) : (
                  <p className="m-note">{unifi.error ?? "UniFi antwortet nicht."}</p>
                )}
                {unifi.controllerUrl && (
                  <div className="m-act">
                    <a className="m-btn" href={unifi.controllerUrl} target="_blank" rel="noopener noreferrer">UniFi öffnen</a>
                  </div>
                )}
              </article>
            )}
            {adguard?.configured && (
              <article className="m-sheet" id="net-dns">
                <h3>
                  <Dot state={!adguard.online ? "bad" : adguard.protection && !adguard.protection.enabled ? "warn" : "ok"} />
                  AdGuard
                  <small>{adguard.online ? (adguard.protection?.enabled === false ? "Schutz aus" : "Schutz an") : ""}</small>
                </h3>
                {adguard.online && a ? (
                  <div className="m-kv">
                    <div>
                      <b>{nf.format(a.dnsQueries)}</b>
                      <span>Anfragen heute</span>
                    </div>
                    <div>
                      <b>{a.blockedPercent.toFixed(1).replace(".", ",")} %</b>
                      <span>geblockt</span>
                    </div>
                    <div>
                      <b>{Math.round(a.avgProcessingMs)} ms</b>
                      <span>Antwortzeit</span>
                    </div>
                  </div>
                ) : (
                  <p className="m-note">AdGuard antwortet nicht.</p>
                )}
                {adguard.baseUrl && (
                  <div className="m-act">
                    <a className="m-btn" href={adguard.baseUrl} target="_blank" rel="noopener noreferrer">AdGuard öffnen</a>
                  </div>
                )}
              </article>
            )}
          </div>
        </section>
      )}

      {devices.length > 0 && (
        <section className="m-sec">
          <h2 className="m-h">Geräte im Netz · {devices.length}</h2>
          {devices.map((d) => {
            const state = d.status === "online" ? "ok" : d.status === "offline" ? "bad" : "unknown";
            const inner = (
              <>
                <Dot state={state} />
                <span>
                  <b>{d.label}</b>
                  {d.sub && <small>{d.sub}</small>}
                </span>
              </>
            );
            return (
              <div className={`m-row ${selected === `device-${d.id}` ? "sel" : ""}`} key={d.id} id={`device-${d.id}`}>
                {d.url ? (
                  <a className="m-row-link" href={d.url} target="_blank" rel="noopener noreferrer">
                    {inner}
                  </a>
                ) : (
                  <div className="m-row-link">{inner}</div>
                )}
                {typeof d.latencyMs === "number" && <span className="m-tag">{d.latencyMs} ms</span>}
              </div>
            );
          })}
        </section>
      )}
    </Screen>
  );
}
