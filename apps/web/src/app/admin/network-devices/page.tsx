"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, Network } from "lucide-react";
import { SortableList } from "@/components/ui/SortableList";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import type { NetworkDevice } from "@/server/config/schema";

const FormSchema = z.object({
  label: z.string().min(1),
  sub: z.string().optional(),
  iconEmoji: z.string().default("🌐"),
  url: z.string().optional(),
  pingKind: z.enum(["http", "tcp", "none"]).default("http"),
  pingUrl: z.string().optional(),
  pingHost: z.string().optional(),
  pingPort: z.coerce.number().int().optional(),
  pingTimeoutMs: z.coerce.number().int().min(500).max(30000).default(3000),
  enabled: z.boolean().default(true),
});
type Form = z.infer<typeof FormSchema>;

const PING_COLOR: Record<string, string> = {
  http: "var(--brand)",
  tcp: "#f59e0b",
  none: "var(--dim)",
};

export default function AdminNetworkDevicesPage() {
  const { data: devices = [] } = trpc.networkDevices.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [items, setItems] = useState(devices);
  useEffect(() => { setItems(devices); }, [devices]);

  const upsert = trpc.networkDevices.upsert.useMutation({
    onSuccess: () => { utils.networkDevices.list.invalidate(); setEditing(null); toast.success("Gerät gespeichert"); },
    onError: onErr,
  });
  const del = trpc.networkDevices.delete.useMutation({
    onSuccess: () => { utils.networkDevices.list.invalidate(); toast.success("Gerät gelöscht"); },
    onError: onErr,
  });
  const reorder = trpc.networkDevices.reorder.useMutation({
    onError: () => { setItems(devices); toast.error("Reihenfolge konnte nicht gespeichert werden"); },
  });

  const [editing, setEditing] = useState<NetworkDevice | null | "new">(null);

  return (
    <div className="admin-card">
      <div className="admin-list-header">
        <div className="admin-list-header-left">
          <span className="admin-list-header-icon"><Network size={16} /></span>
          <div>
            <div className="admin-card-title" style={{ margin: 0 }}>Netzwerk-Geräte</div>
            <div className="admin-card-sub">{devices.length} Gerät{devices.length === 1 ? "" : "e"} · erscheinen im Netzwerk-Widget</div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary">
          <Plus size={14} />Hinzufügen
        </button>
      </div>

      {editing && (
        <DeviceModal
          device={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(d) => {
            upsert.mutate({
              id: editing !== "new" ? editing.id : undefined,
              label: d.label,
              sub: d.sub ?? "",
              iconEmoji: d.iconEmoji,
              url: d.url ?? "",
              healthCheck: {
                kind: d.pingKind,
                url: d.pingUrl ?? d.url ?? "",
                host: d.pingHost ?? "",
                port: d.pingPort,
                expectStatus: [200, 204, 301, 302, 401],
                timeoutMs: d.pingTimeoutMs,
              },
              sortOrder: editing !== "new" ? editing.sortOrder : devices.length,
              enabled: d.enabled,
            });
          }}
          isPending={upsert.isPending}
        />
      )}

      {items.length === 0 && (
        <div className="int-empty">Noch keine Geräte konfiguriert.</div>
      )}

      <SortableList
        items={items}
        onReorder={(next) => {
          setItems(next);
          reorder.mutate(next.map((d, i) => ({ id: d.id, sortOrder: i })));
        }}
        renderItem={(d, handle) => {
          const pingKind = d.healthCheck.kind;
          const color = PING_COLOR[pingKind] ?? "var(--dim)";
          return (
            <>
              {handle}
              <span className="admin-list-row-icon admin-list-row-icon-emoji" style={{ "--row-color": color } as React.CSSProperties}>
                {d.iconEmoji}
              </span>
              <span className={`admin-list-row-dot ${d.enabled ? "admin-list-row-dot-ok" : "admin-list-row-dot-off"}`} title={d.enabled ? "Aktiv" : "Deaktiviert"} />
              <div className="admin-list-row-body">
                <span className="admin-list-row-name">{d.label}</span>
                <span className="admin-list-row-sub">{d.sub || d.url || "—"}</span>
              </div>
              <span className="admin-list-row-badge" style={{ "--badge-color": color } as React.CSSProperties}>{pingKind}</span>
              <button type="button" title="Bearbeiten" className="icon-btn" onClick={() => setEditing(d)}><Pencil size={13} /></button>
              <button type="button" title="Löschen" className="icon-btn icon-btn-danger"
                onClick={() => { if (confirm(`"${d.label}" wirklich löschen?`)) del.mutate({ id: d.id }); }}>
                <Trash2 size={13} />
              </button>
            </>
          );
        }}
      />
    </div>
  );
}

function DeviceModal({ device, onClose, onSubmit, isPending }: {
  device: NetworkDevice | null;
  onClose: () => void;
  onSubmit: (data: Form) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(FormSchema),
    defaultValues: device
      ? {
          label: device.label,
          sub: device.sub ?? "",
          iconEmoji: device.iconEmoji,
          url: device.url ?? "",
          pingKind: device.healthCheck.kind,
          pingUrl: device.healthCheck.url ?? "",
          pingHost: device.healthCheck.host ?? "",
          pingPort: device.healthCheck.port,
          pingTimeoutMs: device.healthCheck.timeoutMs,
          enabled: device.enabled,
        }
      : { iconEmoji: "🌐", pingKind: "http", pingTimeoutMs: 3000, enabled: true },
  });

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={device ? "Gerät bearbeiten" : "Gerät hinzufügen"}
        subtitle={device ? device.label : "Neues Gerät"}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
        <ModalBody>
          <div className="form-stack">
            <div className="admin-grid-2">
              <Field label="Name" error={errors.label?.message}>
                <input {...register("label")} className="admin-input" placeholder="UDM Pro" />
              </Field>
              <Field label="Icon (Emoji)" error={errors.iconEmoji?.message}>
                <input {...register("iconEmoji")} className="admin-input" />
              </Field>
            </div>
            <Field label="Untertitel" error={errors.sub?.message}>
              <input {...register("sub")} className="admin-input" placeholder="192.168.1.1 · Router" />
            </Field>
            <Field label="URL (Link beim Klick)" error={errors.url?.message}>
              <input {...register("url")} className="admin-input" placeholder="https://192.168.1.1" />
            </Field>
            <div className="admin-grid-2">
              <Field label="Health-Check-Typ" error={errors.pingKind?.message}>
                <select {...register("pingKind")} className="admin-input">
                  <option value="http">HTTP</option>
                  <option value="tcp">TCP</option>
                  <option value="none">Kein Check</option>
                </select>
              </Field>
              <Field label="Timeout (ms)" error={errors.pingTimeoutMs?.message}>
                <input type="number" {...register("pingTimeoutMs")} className="admin-input" />
              </Field>
            </div>
            <Field label="HTTP-URL (optional, sonst URL oben)" error={errors.pingUrl?.message}>
              <input {...register("pingUrl")} className="admin-input" />
            </Field>
            <div className="admin-grid-2">
              <Field label="TCP-Host" error={errors.pingHost?.message}>
                <input {...register("pingHost")} className="admin-input" placeholder="192.168.1.1" />
              </Field>
              <Field label="TCP-Port" error={errors.pingPort?.message}>
                <input type="number" {...register("pingPort")} className="admin-input" placeholder="443" />
              </Field>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" {...register("enabled")} />
              <span>Gerät aktiviert</span>
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
