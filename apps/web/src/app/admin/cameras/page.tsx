"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, Camera } from "lucide-react";
import { SortableList } from "@/components/ui/SortableList";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import type { Camera as CameraType } from "@/server/config/schema";

const FormSchema = z.object({
  label: z.string().min(1, "Name erforderlich"),
  snapshotUrl: z.string().min(1, "Snapshot-URL erforderlich"),
  linkUrl: z.string().optional(),
  refreshSec: z.number().int().min(2).default(10),
  enabled: z.boolean().default(true),
});
type Form = z.infer<typeof FormSchema>;

export default function AdminCamerasPage() {
  const { data: cameras = [] } = trpc.cameras.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [items, setItems] = useState(cameras);
  useEffect(() => { setItems(cameras); }, [cameras]);

  const upsert = trpc.cameras.upsert.useMutation({
    onSuccess: () => { utils.cameras.list.invalidate(); setEditing(null); toast.success("Kamera gespeichert"); },
    onError: onErr,
  });
  const del = trpc.cameras.delete.useMutation({
    onSuccess: () => { utils.cameras.list.invalidate(); toast.success("Kamera gelöscht"); },
    onError: onErr,
  });
  const reorder = trpc.cameras.reorder.useMutation({
    onError: () => { setItems(cameras); toast.error("Reihenfolge konnte nicht gespeichert werden"); },
  });

  const [editing, setEditing] = useState<CameraType | null | "new">(null);

  return (
    <div className="admin-card">
      <div className="admin-list-header">
        <div className="admin-list-header-left">
          <span className="admin-list-header-icon" style={{ "--row-color": "#818cf8" } as React.CSSProperties}>
            <Camera size={16} />
          </span>
          <div>
            <div className="admin-card-title" style={{ margin: 0 }}>Kameras</div>
            <div className="admin-card-sub">{cameras.length} Kamera{cameras.length !== 1 ? "s" : ""} · Snapshot-basiertes Widget</div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary">
          <Plus size={14} />Hinzufügen
        </button>
      </div>

      {editing && (
        <CameraModal
          camera={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(d) => upsert.mutate({
            id: editing !== "new" ? editing.id : undefined,
            label: d.label,
            snapshotUrl: d.snapshotUrl,
            linkUrl: d.linkUrl ?? "",
            refreshSec: d.refreshSec,
            sortOrder: editing !== "new" ? editing.sortOrder : cameras.length,
            enabled: d.enabled,
          })}
          isPending={upsert.isPending}
        />
      )}

      {items.length === 0 && (
        <div className="int-empty">
          Keine Kameras konfiguriert — füge eine Kamera mit Snapshot-URL hinzu.<br />
          <span className="text-[var(--dim)] text-[11px]">Unterstützt alle Kameras mit HTTP-Snapshot (UniFi Protect, Frigate, Reolink, …)</span>
        </div>
      )}

      <SortableList
        items={items}
        onReorder={(next) => {
          setItems(next);
          reorder.mutate(next.map((c, i) => ({ id: c.id, sortOrder: i })));
        }}
        renderItem={(cam, handle) => (
          <>
            {handle}
            <span className="admin-list-row-icon" style={{ "--row-color": "#818cf8" } as React.CSSProperties}>
              <Camera size={14} />
            </span>
            <span className={`admin-list-row-dot ${cam.enabled ? "admin-list-row-dot-ok" : "admin-list-row-dot-off"}`} title={cam.enabled ? "Aktiv" : "Deaktiviert"} />
            <div className="admin-list-row-body">
              <span className="admin-list-row-name">{cam.label}</span>
              <span className="admin-list-row-sub">{cam.snapshotUrl} · alle {cam.refreshSec}s</span>
            </div>
            <span className="admin-list-row-badge" style={{ "--badge-color": "#818cf8" } as React.CSSProperties}>snapshot</span>
            <button type="button" title="Bearbeiten" className="icon-btn" onClick={() => setEditing(cam)}><Pencil size={13} /></button>
            <button type="button" title="Löschen" className="icon-btn icon-btn-danger"
              onClick={() => { if (confirm(`"${cam.label}" wirklich löschen?`)) del.mutate({ id: cam.id }); }}>
              <Trash2 size={13} />
            </button>
          </>
        )}
      />

      {items.length > 0 && (
        <div className="admin-list-hint">
          Tipp: Das Kamera-Widget lädt Snapshots über einen Server-Proxy — CORS und HTTP-Auth werden dabei transparent behandelt.
        </div>
      )}
    </div>
  );
}

function CameraModal({ camera, onClose, onSubmit, isPending }: {
  camera: CameraType | null;
  onClose: () => void;
  onSubmit: (data: Form) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(FormSchema),
    defaultValues: camera
      ? {
          label: camera.label,
          snapshotUrl: camera.snapshotUrl,
          linkUrl: camera.linkUrl ?? "",
          refreshSec: camera.refreshSec,
          enabled: camera.enabled,
        }
      : { label: "", snapshotUrl: "", linkUrl: "", refreshSec: 10, enabled: true },
  });

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader
        title={camera ? "Kamera bearbeiten" : "Kamera hinzufügen"}
        subtitle={camera ? camera.label : "Neue Kamera"}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
        <ModalBody>
          <div className="form-stack">
            <Field label="Name" error={errors.label?.message}>
              <input {...register("label")} className="admin-input" placeholder="Haustür" />
            </Field>
            <Field label="Snapshot-URL" error={errors.snapshotUrl?.message}>
              <input {...register("snapshotUrl")} className="admin-input" placeholder="http://192.168.1.100/snap.jpeg" />
              <span className="admin-hint">
                HTTP/HTTPS-URL die ein JPEG/PNG-Bild liefert. Wird server-seitig gepullt — Basic-Auth in der URL ist möglich (http://user:pass@host/snap.jpg).
              </span>
            </Field>
            <Field label="Link-URL (bei Klick auf Kamera-Bild)" error={errors.linkUrl?.message}>
              <input {...register("linkUrl")} className="admin-input" placeholder="http://192.168.1.100" />
              <span className="admin-hint">Leer lassen = kein Klick-Link.</span>
            </Field>
            <Field label="Refresh-Intervall (Sekunden)" error={errors.refreshSec?.message}>
              <input {...register("refreshSec", { valueAsNumber: true })} type="number" min={2} max={3600} className="admin-input" />
            </Field>
            <label className="checkbox-row">
              <input type="checkbox" {...register("enabled")} />
              <span>Kamera aktiviert</span>
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
