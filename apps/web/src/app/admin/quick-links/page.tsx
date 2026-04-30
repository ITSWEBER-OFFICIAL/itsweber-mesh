"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, Link2, ExternalLink } from "lucide-react";
import { SortableList } from "@/components/ui/SortableList";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import type { QuickLink } from "@/server/config/schema";

const FormSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  iconEmoji: z.string().default("🔗"),
  target: z.enum(["_blank", "_self"]).default("_blank"),
  enabled: z.boolean().default(true),
});
type Form = z.infer<typeof FormSchema>;

export default function AdminQuickLinksPage() {
  const { data: links = [] } = trpc.quickLinks.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [items, setItems] = useState(links);
  useEffect(() => { setItems(links); }, [links]);

  const upsert = trpc.quickLinks.upsert.useMutation({
    onSuccess: () => { utils.quickLinks.list.invalidate(); setEditing(null); toast.success("Quick-Link gespeichert"); },
    onError: onErr,
  });
  const del = trpc.quickLinks.delete.useMutation({
    onSuccess: () => { utils.quickLinks.list.invalidate(); toast.success("Quick-Link gelöscht"); },
    onError: onErr,
  });
  const reorder = trpc.quickLinks.reorder.useMutation({
    onError: () => { setItems(links); toast.error("Reihenfolge konnte nicht gespeichert werden"); },
  });

  const [editing, setEditing] = useState<QuickLink | null | "new">(null);

  return (
    <div className="admin-card">
      <div className="admin-list-header">
        <div className="admin-list-header-left">
          <span className="admin-list-header-icon"><Link2 size={16} /></span>
          <div>
            <div className="admin-card-title" style={{ margin: 0 }}>Quick-Access-Links</div>
            <div className="admin-card-sub">{links.length} Link{links.length === 1 ? "" : "s"} · erscheinen in der Footer-Leiste</div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary">
          <Plus size={14} />Hinzufügen
        </button>
      </div>

      {editing && (
        <LinkModal
          link={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(d) => {
            upsert.mutate({
              id: editing !== "new" ? editing.id : undefined,
              label: d.label,
              url: d.url,
              iconEmoji: d.iconEmoji,
              target: d.target,
              sortOrder: editing !== "new" ? editing.sortOrder : links.length,
              enabled: d.enabled,
            });
          }}
          isPending={upsert.isPending}
        />
      )}

      {items.length === 0 && (
        <div className="int-empty">Noch keine Quick-Links konfiguriert.</div>
      )}

      <SortableList
        items={items}
        onReorder={(next) => {
          setItems(next);
          reorder.mutate(next.map((l, i) => ({ id: l.id, sortOrder: i })));
        }}
        renderItem={(l, handle) => (
          <>
            {handle}
            <span className="admin-list-row-icon admin-list-row-icon-emoji" style={{ "--row-color": "var(--brand)" } as React.CSSProperties}>
              <DynamicIcon value={l.iconEmoji} size={18} />
            </span>
            <span className={`admin-list-row-dot ${l.enabled ? "admin-list-row-dot-ok" : "admin-list-row-dot-off"}`} title={l.enabled ? "Aktiv" : "Deaktiviert"} />
            <div className="admin-list-row-body">
              <span className="admin-list-row-name">{l.label}</span>
              <span className="admin-list-row-sub">{l.url}</span>
            </div>
            <span className="admin-list-row-badge" style={{ "--badge-color": l.target === "_blank" ? "var(--brand)" : "var(--muted)" } as React.CSSProperties}>
              {l.target === "_blank" ? <><ExternalLink size={9} /> Neuer Tab</> : "Gleicher Tab"}
            </span>
            <button type="button" title="Bearbeiten" className="icon-btn" onClick={() => setEditing(l)}><Pencil size={13} /></button>
            <button type="button" title="Löschen" className="icon-btn icon-btn-danger"
              onClick={() => { if (confirm(`"${l.label}" wirklich löschen?`)) del.mutate({ id: l.id }); }}>
              <Trash2 size={13} />
            </button>
          </>
        )}
      />
    </div>
  );
}

function LinkModal({ link, onClose, onSubmit, isPending }: {
  link: QuickLink | null;
  onClose: () => void;
  onSubmit: (data: Form) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(FormSchema),
    defaultValues: link
      ? { label: link.label, url: link.url, iconEmoji: link.iconEmoji, target: link.target, enabled: link.enabled }
      : { iconEmoji: "🔗", target: "_blank", enabled: true },
  });

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader
        title={link ? "Link bearbeiten" : "Link hinzufügen"}
        subtitle={link ? link.label : "Neuer Quick-Link"}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
        <ModalBody>
          <div className="form-stack">
            <div className="admin-grid-2">
              <Field label="Label" error={errors.label?.message}>
                <input {...register("label")} className="admin-input" placeholder="Unraid CORE" />
              </Field>
              <Field label="Icon (Emoji oder URL)" error={errors.iconEmoji?.message} hint="Emoji oder Icon-URL — z. B. https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/home-assistant.svg">
                <input {...register("iconEmoji")} className="admin-input" placeholder="⚡  oder  https://…/icon.svg" />
              </Field>
            </div>
            <Field label="URL" error={errors.url?.message}>
              <input {...register("url")} className="admin-input" placeholder="https://… oder /admin" />
            </Field>
            <Field label="Ziel" error={errors.target?.message}>
              <select {...register("target")} className="admin-input">
                <option value="_blank">Neuer Tab</option>
                <option value="_self">Gleicher Tab</option>
              </select>
            </Field>
            <label className="checkbox-row">
              <input type="checkbox" {...register("enabled")} />
              <span>Link aktiviert</span>
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

function Field({ label, error, hint, children }: { label: string; error?: string | undefined; hint?: string; children: React.ReactNode }) {
  return (
    <div className="admin-field">
      <label className="admin-label">{label}</label>
      {children}
      {hint && !error && <span className="admin-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
