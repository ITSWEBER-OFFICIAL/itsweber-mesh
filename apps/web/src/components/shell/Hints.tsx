"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import type { Hint } from "@/app/api/hints/route";
import { Dot } from "./AppShell";

export { useHints } from "./useHints";

export function HintList({ hints, limit, actions }: { hints: Hint[]; limit?: number; actions?: boolean }) {
  const list = limit ? hints.slice(0, limit) : hints;
  const { data: me } = trpc.status.me.useQuery(undefined, { staleTime: 300_000, enabled: Boolean(actions) });
  const qc = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<Hint | null>(null);
  const install = trpc.actions.haUpdate.useMutation({
    onSuccess: (res) => {
      if (res.pending) toast.success(`Update für ${res.name} läuft`, "Das Ergebnis steht im Protokoll");
      else toast.success(`${res.name} aktualisiert`);
      setTarget(null);
      void qc.invalidateQueries({ queryKey: ["mesh-hints"] });
    },
    onError: (e) => toast.error("Update nicht gestartet", e.message),
  });
  const canAct = Boolean(actions) && me?.role === "admin";
  return (
    <>
      {list.map((h) => (
        <div className="m-msg" key={h.id}>
          <Dot state={h.level === "urgent" ? "bad" : "warn"} />
          <div>
            <b>{h.title}</b>
            <small>{h.detail}</small>
          </div>
          {canAct && h.action?.kind === "haUpdate" && (
            <button type="button" className="m-btn" onClick={() => setTarget(h)}>
              Installieren
            </button>
          )}
        </div>
      ))}
      {target?.action && (
        <Modal onClose={() => !install.isPending && setTarget(null)} size="sm">
          <ModalHeader title={target.title} onClose={() => !install.isPending && setTarget(null)} />
          <ModalBody>
            <p style={{ margin: 0 }}>{target.detail}</p>
            <p style={{ margin: "8px 0 0", opacity: 0.75, fontSize: 13.5 }}>
              Home Assistant installiert das Update selbst. Bei Updates von Core oder Betriebssystem startet Home Assistant dabei neu und ist einige Minuten nicht erreichbar. Die Aktion wird im Protokoll festgehalten.
            </p>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="m-btn" disabled={install.isPending} onClick={() => setTarget(null)}>Abbrechen</button>
            <button
              type="button"
              className="m-btn p"
              disabled={install.isPending}
              onClick={() => target.action && install.mutate({ entityId: target.action.entityId })}
            >
              {install.isPending ? "Läuft" : "Installieren"}
            </button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
