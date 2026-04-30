"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, Server } from "lucide-react";
import { SortableList } from "@/components/ui/SortableList";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import type { InfraNode } from "@/server/config/schema";

const FormSchema = z.object({
  label: z.string().min(1, "Name erforderlich"),
  ip: z.string().optional(),
  linkUrl: z.string().optional(),
  versionOverride: z.string().optional(),
  iconEmoji: z.string().default("⚡"),
  badge: z.string().default("PRIMARY"),
  primary: z.boolean().default(false),
  chipsRaw: z.string().optional(),
  unraidIntegrationId: z.string().optional(),
  glancesIntegrationId: z.string().optional(),
  enabled: z.boolean().default(true),
});
type Form = z.infer<typeof FormSchema>;

export default function AdminInfraNodesPage() {
  const { data: nodes = [] } = trpc.infraNodes.list.useQuery();
  const { data: integrations } = trpc.integrations.get.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [items, setItems] = useState(nodes);
  useEffect(() => { setItems(nodes); }, [nodes]);

  const upsert = trpc.infraNodes.upsert.useMutation({
    onSuccess: () => { utils.infraNodes.list.invalidate(); setEditing(null); toast.success("Server-Karte gespeichert"); },
    onError: onErr,
  });
  const del = trpc.infraNodes.delete.useMutation({
    onSuccess: () => { utils.infraNodes.list.invalidate(); toast.success("Server-Karte gelöscht"); },
    onError: onErr,
  });
  const reorder = trpc.infraNodes.reorder.useMutation({
    onError: () => { setItems(nodes); toast.error("Reihenfolge konnte nicht gespeichert werden"); },
  });

  const [editing, setEditing] = useState<InfraNode | null | "new">(null);

  return (
    <div className="admin-card">
      <div className="admin-list-header">
        <div className="admin-list-header-left">
          <span className="admin-list-header-icon"><Server size={16} /></span>
          <div>
            <div className="admin-card-title" style={{ margin: 0 }}>Server-Karten</div>
            <div className="admin-card-sub">
              {nodes.length} Karte{nodes.length === 1 ? "" : "n"} · zeigt Live-Daten konfigurierter Unraid-Integrationen
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary">
          <Plus size={14} />Hinzufügen
        </button>
      </div>

      {editing && (
        <NodeModal
          node={editing === "new" ? null : editing}
          unraidOptions={integrations?.unraid ?? []}
          glancesOptions={integrations?.glances ?? []}
          onClose={() => setEditing(null)}
          onSubmit={(d) => {
            const chips = (d.chipsRaw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
            const ref = d.unraidIntegrationId
              ? { kind: "unraid" as const, id: d.unraidIntegrationId }
              : null;
            const gRef = d.glancesIntegrationId
              ? { kind: "glances" as const, id: d.glancesIntegrationId }
              : null;
            upsert.mutate({
              id: editing !== "new" ? editing.id : undefined,
              label: d.label,
              kind: "unraid",
              ip: d.ip ?? "",
              linkUrl: d.linkUrl ?? "",
              versionOverride: d.versionOverride ?? "",
              iconEmoji: d.iconEmoji,
              badge: d.badge,
              primary: d.primary,
              chips,
              integrationRef: ref,
              glancesRef: gRef,
              sortOrder: editing !== "new" ? editing.sortOrder : nodes.length,
              enabled: d.enabled,
            });
          }}
          isPending={upsert.isPending}
        />
      )}

      {items.length === 0 && (
        <div className="int-empty">
          Keine Karten konfiguriert — pflege Unraid-Integrationen unter <strong>Admin → Integrationen</strong> und füge hier die zugehörige Karte hinzu.
        </div>
      )}

      <SortableList
        items={items}
        onReorder={(next) => {
          setItems(next);
          reorder.mutate(next.map((n, i) => ({ id: n.id, sortOrder: i })));
        }}
        renderItem={(n, handle) => {
          const color = n.primary ? "var(--brand)" : "var(--muted)";
          return (
            <>
              {handle}
              <span className="admin-list-row-icon admin-list-row-icon-emoji" style={{ "--row-color": color } as React.CSSProperties}>
                {n.iconEmoji}
              </span>
              <span className={`admin-list-row-dot ${n.enabled ? "admin-list-row-dot-ok" : "admin-list-row-dot-off"}`} title={n.enabled ? "Aktiv" : "Deaktiviert"} />
              <div className="admin-list-row-body">
                <span className="admin-list-row-name">{n.label}</span>
                <span className="admin-list-row-sub">{n.ip ?? "—"} · {n.integrationRef ? "Live-Daten" : "Statisch"}{n.glancesRef ? " + Glances" : ""}</span>
              </div>
              <span className="admin-list-row-badge" style={{ "--badge-color": color } as React.CSSProperties}>{n.badge}</span>
              <button type="button" title="Bearbeiten" className="icon-btn" onClick={() => setEditing(n)}><Pencil size={13} /></button>
              <button type="button" title="Löschen" className="icon-btn icon-btn-danger"
                onClick={() => { if (confirm(`"${n.label}" wirklich löschen?`)) del.mutate({ id: n.id }); }}>
                <Trash2 size={13} />
              </button>
            </>
          );
        }}
      />
    </div>
  );
}

function NodeModal({ node, unraidOptions, glancesOptions, onClose, onSubmit, isPending }: {
  node: InfraNode | null;
  unraidOptions: { id: string; label: string }[];
  glancesOptions: { id: string; label: string }[];
  onClose: () => void;
  onSubmit: (data: Form) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(FormSchema),
    defaultValues: node
      ? {
          label: node.label,
          ip: node.ip ?? "",
          linkUrl: node.linkUrl ?? "",
          versionOverride: node.versionOverride ?? "",
          iconEmoji: node.iconEmoji,
          badge: node.badge,
          primary: node.primary,
          chipsRaw: node.chips.join(", "),
          unraidIntegrationId: node.integrationRef?.id ?? "",
          glancesIntegrationId: node.glancesRef?.id ?? "",
          enabled: node.enabled,
        }
      : { iconEmoji: "⚡", badge: "PRIMARY", primary: true, enabled: true, chipsRaw: "", linkUrl: "" },
  });

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={node ? "Karte bearbeiten" : "Karte hinzufügen"}
        subtitle={node ? node.label : "Neue Server-Karte"}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
        <ModalBody>
          <div className="form-stack">
            <div className="admin-grid-2">
              <Field label="Name" error={errors.label?.message}>
                <input {...register("label")} className="admin-input" placeholder="ITSWEBER-CORE" />
              </Field>
              <Field label="Icon (Emoji)" error={errors.iconEmoji?.message}>
                <input {...register("iconEmoji")} className="admin-input" placeholder="⚡" />
              </Field>
            </div>
            <div className="admin-grid-2">
              <Field label="IP (für Anzeige)" error={errors.ip?.message}>
                <input {...register("ip")} className="admin-input" placeholder="192.168.1.100" />
              </Field>
              <Field label="Badge" error={errors.badge?.message}>
                <input {...register("badge")} className="admin-input" placeholder="PRIMARY" />
              </Field>
            </div>
            <Field label="Link-URL (bei Klick auf die Karte)" error={errors.linkUrl?.message}>
              <input {...register("linkUrl")} className="admin-input" placeholder="http://192.168.1.100:1080" />
              <span className="admin-hint">Leer lassen = kein Klick-Link. Hier kannst du Port oder NPM-Domain eintragen.</span>
            </Field>
            <Field label="Unraid-Integration (Array, Container, VMs)" error={errors.unraidIntegrationId?.message}>
              <select {...register("unraidIntegrationId")} className="admin-input">
                <option value="">— keine Verknüpfung —</option>
                {unraidOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Glances-Host (Live CPU% / RAM%, optional)" error={errors.glancesIntegrationId?.message}>
              <select {...register("glancesIntegrationId")} className="admin-input">
                <option value="">— keine Live-Stats —</option>
                {glancesOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
              <span className="admin-hint">Optional. Liefert echte CPU/RAM-Auslastung — funktioniert für jede Linux-Maschine.</span>
            </Field>
            <Field label="Chips (kommasepariert)" error={errors.chipsRaw?.message}>
              <input {...register("chipsRaw")} className="admin-input" placeholder="NVIDIA GPU, 10 GbE, Frigate" />
            </Field>
            <Field label="Version Override (optional)" error={errors.versionOverride?.message}>
              <input {...register("versionOverride")} className="admin-input" placeholder="z.B. 7.2.0 — überschreibt Live-Wert" />
            </Field>
            <label className="checkbox-row">
              <input type="checkbox" {...register("primary")} />
              <span>Primary-Hervorhebung (teal-Badge)</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" {...register("enabled")} />
              <span>Karte aktiviert</span>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-ghost">Abbrechen</button>
          <button type="submit" disabled={isPending} className="btn-primary">
            <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="admin-field">
      <label className="admin-label">{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
