"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import type { UnraidDetail, UnraidContainer, UnraidVm, UnraidDisk } from "@/app/api/unraid/detail/route";
import type { UnraidWidgetData } from "@/app/api/widgets/unraid/route";
import { Screen, Dot } from "./AppShell";

type Target =
  | { kind: "container"; item: UnraidContainer }
  | { kind: "vm"; item: UnraidVm };

const ROLE_LABEL: Record<UnraidDisk["role"], string> = { parity: "Parität", data: "Daten", cache: "Cache" };
const OP_LABEL = { start: "Starten", stop: "Stoppen", restart: "Neu starten" } as const;
const OP_DONE = { start: "gestartet", stop: "gestoppt", restart: "neu gestartet" } as const;

function diskState(d: UnraidDisk): "ok" | "warn" | "bad" {
  if (!d.ok) return "bad";
  if (d.errors > 0 || (d.usedPercent ?? 0) >= 90) return "warn";
  return "ok";
}

export function ServerDetailView({ nodeId }: { nodeId: string }) {
  const { data: nodes, isLoading: nodesLoading } = trpc.infraNodes.list.useQuery();
  const { data: me } = trpc.status.me.useQuery(undefined, { staleTime: 300_000 });
  const node = nodes?.find((n) => n.id === nodeId);
  const instanceId = node?.integrationRef?.id;
  const qc = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<Target | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: core } = useQuery<UnraidWidgetData>({
    queryKey: ["widget-unraid"],
    queryFn: () => fetch("/api/widgets/unraid").then((r) => (r.ok ? r.json() : { instances: [] })),
    refetchInterval: 30_000,
  });
  const detailKey = ["unraid-detail", instanceId];
  const { data: detail, isLoading } = useQuery<UnraidDetail | null>({
    queryKey: detailKey,
    enabled: !!instanceId,
    queryFn: () => fetch(`/api/unraid/detail?id=${instanceId}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    refetchInterval: 20_000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: detailKey });
    void qc.invalidateQueries({ queryKey: ["widget-unraid"] });
    void qc.invalidateQueries({ queryKey: ["mesh-hints"] });
  };
  const done = (op: keyof typeof OP_DONE) => (res: { name: string }) => {
    toast.success(`${res.name} ${OP_DONE[op]}`);
    setTarget(null);
    refresh();
    // Unraid needs a moment until the new state shows up in its list.
    window.setTimeout(refresh, 4000);
  };
  const containerAction = trpc.actions.container.useMutation({
    onSuccess: (res, vars) => done(vars.op)(res),
    onError: (e) => { toast.error("Aktion nicht ausgeführt", e.message); refresh(); },
  });
  const vmAction = trpc.actions.vm.useMutation({
    onSuccess: (res, vars) => done(vars.op)(res),
    onError: (e) => { toast.error("Aktion nicht ausgeführt", e.message); refresh(); },
  });
  const busy = containerAction.isPending || vmAction.isPending;
  const isAdmin = me?.role === "admin";

  if (!nodesLoading && !node) {
    return (
      <Screen title="Server" small>
        <section className="m-sec">
          <p className="m-note">Diesen Server gibt es nicht mehr.</p>
          <Link href="/server" className="m-btn" style={{ alignSelf: "flex-start" }}>Zur Übersicht</Link>
        </section>
      </Screen>
    );
  }

  const inst = core?.instances.find((i) => i.id === instanceId);
  const data = inst?.online ? inst.data : undefined;
  const containers = detail?.containers ?? [];
  const stopped = containers.filter((c) => !c.running);
  const shown = showAll ? containers : stopped;
  const disks = detail?.disks ?? [];
  const vms = detail?.vms ?? [];
  const notices = detail?.notices ?? [];

  return (
    <Screen
      title={node?.label ?? "Server"}
      small
      context={data?.unraidVersion ? `Unraid ${data.unraidVersion}` : undefined}
      kanzel={
        <div className="m-chips">
          <Link href="/server" className="m-chip"><span>Alle Server</span></Link>
          {node?.linkUrl && (
            <a href={node.linkUrl} target="_blank" rel="noopener noreferrer" className="m-chip"><span>Oberfläche</span></a>
          )}
        </div>
      }
    >
      {!instanceId ? (
        <section className="m-sec">
          <p className="m-note">Für diesen Server ist keine Schnittstelle verknüpft. Unter Verwaltung, Server lässt sich eine Unraid-Instanz zuordnen.</p>
        </section>
      ) : isLoading ? (
        <section className="m-sec"><p className="m-note">Wird geladen.</p></section>
      ) : !detail?.online ? (
        <section className="m-sec">
          <div className="m-msg">
            <Dot state="bad" />
            <div>
              <b>Die Schnittstelle antwortet nicht</b>
              <small>Platten, Container und VMs sind gerade nicht lesbar</small>
            </div>
          </div>
        </section>
      ) : (
        <>
          {data && (
            <section className="m-sec">
              <div className="m-kv">
                <div>
                  <b>{data.array?.capacity ? `${Math.round(data.array.capacity.percent)} %` : "–"}</b>
                  <span>Array belegt</span>
                </div>
                <div>
                  <b>{containers.length ? `${containers.length - stopped.length}/${containers.length}` : "–"}</b>
                  <span>Container</span>
                </div>
                <div>
                  <b>{vms.length ? `${vms.filter((v) => v.running).length}/${vms.length}` : "–"}</b>
                  <span>VMs</span>
                </div>
              </div>
            </section>
          )}

          {notices.length > 0 && (
            <section className="m-sec">
              <h2 className="m-h">Meldungen von Unraid · {notices.length}</h2>
              {notices.map((n) => (
                <div className="m-msg" key={n.id}>
                  <Dot state={n.level === "alert" ? "bad" : "warn"} />
                  <div>
                    <b>{n.subject || n.title}</b>
                    <small>
                      {[n.description, n.timestamp ? new Date(n.timestamp).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                </div>
              ))}
              <p className="m-note">Die Meldungen bleiben stehen, bis sie in Unraid archiviert sind.</p>
            </section>
          )}

          <section className="m-sec">
            <h2 className="m-h">Platten · {disks.length}</h2>
            {detail.disks === null && <p className="m-note">Die Platten konnten nicht gelesen werden.</p>}
            {disks.map((d) => (
              <div className="m-row" key={`${d.role}-${d.name}`}>
                <div className="m-row-link">
                  <Dot state={diskState(d)} />
                  <span>
                    <b>{d.name}</b>
                    <small>
                      {[ROLE_LABEL[d.role], d.sizeTb ? `${d.sizeTb} TB` : null, d.usedPercent !== null ? `${d.usedPercent} % belegt` : null, d.errors > 0 ? `${d.errors} Fehler` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </div>
                <span className="m-tag">{!d.ok ? d.status.replace("DISK_", "") : d.tempC !== null ? `${d.tempC} °C` : d.spinning === false ? "ruht" : "–"}</span>
              </div>
            ))}
          </section>

          <section className="m-sec">
            <h2 className="m-h">Container · {showAll ? containers.length : `${stopped.length} gestoppt`}</h2>
            {detail.containers === null && <p className="m-note">Die Container konnten nicht gelesen werden.</p>}
            {detail.containers !== null && shown.length === 0 && <p className="m-note">Alle {containers.length} Container laufen.</p>}
            {shown.map((c) => (
              <ItemRow
                key={c.id}
                name={c.name}
                sub={c.running ? c.status : c.autoStart ? `${c.status || "gestoppt"} · Autostart an` : c.status || "gestoppt"}
                state={c.running ? "ok" : c.autoStart ? "warn" : "unknown"}
                onOpen={isAdmin ? () => setTarget({ kind: "container", item: c }) : undefined}
              />
            ))}
            {containers.length > 0 && (
              <button type="button" className="m-btn" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Nur gestoppte zeigen" : `Alle ${containers.length} zeigen`}
              </button>
            )}
          </section>

          {detail.vms !== null && vms.length > 0 && (
            <section className="m-sec">
              <h2 className="m-h">VMs · {vms.length}</h2>
              {vms.map((v) => (
                <ItemRow
                  key={v.id}
                  name={v.name}
                  sub={v.running ? "läuft" : v.state === "SHUTOFF" ? "aus" : v.state.toLowerCase()}
                  state={v.running ? "ok" : v.state === "CRASHED" ? "bad" : "unknown"}
                  onOpen={isAdmin ? () => setTarget({ kind: "vm", item: v }) : undefined}
                />
              ))}
            </section>
          )}

          {!isAdmin && me && <p className="m-note" style={{ padding: "0 18px" }}>Starten und Stoppen ist Admins vorbehalten.</p>}
        </>
      )}

      {target && instanceId && (
        <Modal onClose={() => !busy && setTarget(null)} size="sm">
          <ModalHeader title={target.item.name} onClose={() => !busy && setTarget(null)} />
          <ModalBody>
            <p style={{ margin: 0 }}>
              {target.kind === "container" ? "Container" : "VM"} auf {node?.label}, {target.item.running ? "läuft gerade" : "läuft gerade nicht"}.
            </p>
            <p style={{ margin: "8px 0 0", opacity: 0.75, fontSize: 13.5 }}>
              {target.item.running
                ? "Stoppen beendet den Dienst für alle, die ihn gerade nutzen. Die Aktion wird im Protokoll festgehalten."
                : "Die Aktion wird im Protokoll festgehalten."}
            </p>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="m-btn" disabled={busy} onClick={() => setTarget(null)}>Abbrechen</button>
            {target.kind === "container" ? (
              target.item.running ? (
                <>
                  <button type="button" className="m-btn" disabled={busy} onClick={() => containerAction.mutate({ instanceId, containerId: target.item.id, op: "stop" })}>
                    {OP_LABEL.stop}
                  </button>
                  <button type="button" className="m-btn p" disabled={busy} onClick={() => containerAction.mutate({ instanceId, containerId: target.item.id, op: "restart" })}>
                    {busy ? "Läuft" : OP_LABEL.restart}
                  </button>
                </>
              ) : (
                <button type="button" className="m-btn p" disabled={busy} onClick={() => containerAction.mutate({ instanceId, containerId: target.item.id, op: "start" })}>
                  {busy ? "Läuft" : OP_LABEL.start}
                </button>
              )
            ) : (
              <button
                type="button"
                className="m-btn p"
                disabled={busy}
                onClick={() => vmAction.mutate({ instanceId, vmId: target.item.id, op: target.item.running ? "stop" : "start" })}
              >
                {busy ? "Läuft" : target.item.running ? OP_LABEL.stop : OP_LABEL.start}
              </button>
            )}
          </ModalFooter>
        </Modal>
      )}
    </Screen>
  );
}

function ItemRow({
  name,
  sub,
  state,
  onOpen,
}: {
  name: string;
  sub: string;
  state: "ok" | "warn" | "bad" | "unknown";
  onOpen: (() => void) | undefined;
}) {
  const inner = (
    <>
      <Dot state={state} />
      <span>
        <b>{name}</b>
        <small>{sub}</small>
      </span>
    </>
  );
  return (
    <div className="m-row">
      {onOpen ? (
        <button type="button" className="m-row-link m-row-btn" onClick={onOpen} aria-label={`${name}, Aktionen`}>
          {inner}
        </button>
      ) : (
        <div className="m-row-link">{inner}</div>
      )}
      {onOpen && <span className="m-tag" aria-hidden="true">Aktion</span>}
    </div>
  );
}
