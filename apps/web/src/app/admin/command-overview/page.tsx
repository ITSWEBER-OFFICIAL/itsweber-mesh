"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, LayoutDashboard } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import type { QuickAction } from "@/server/config/schema";

const ActionFormSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  iconEmoji: z.string().optional(),
  target: z.enum(["_blank", "_self"]).default("_blank"),
});
type ActionForm = z.infer<typeof ActionFormSchema>;

export default function AdminCommandOverviewPage() {
  const { data: settings } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const updateMeta = trpc.settings.updateMeta.useMutation({
    onSuccess: () => { utils.settings.get.invalidate(); toast.success("Gespeichert"); },
    onError: onErr,
  });
  const updateLayout = trpc.settings.updateLayout.useMutation({
    onSuccess: () => { utils.settings.get.invalidate(); toast.success("Gespeichert"); },
    onError: onErr,
  });

  const [show, setShow] = useState(true);
  const [domain, setDomain] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [editing, setEditing] = useState<QuickAction | null | "new">(null);

  useEffect(() => {
    if (!settings) return;
    setShow(settings.layout.showCommandOverview);
    setDomain(settings.meta.domain ?? "");
    setSubtitle(settings.meta.commandOverviewSubtitle ?? "");
    setActions((settings.meta.quickActions ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
  }, [settings]);

  async function saveAll() {
    /* Sequentially: patchConfig serializes via lockfile but parallel calls
       could read the same snapshot and the later write would clobber the
       earlier one. Awaiting one before the next ensures a clean read/write. */
    try {
      await updateLayout.mutateAsync({ showCommandOverview: show });
      await updateMeta.mutateAsync({
        domain,
        commandOverviewSubtitle: subtitle,
        quickActions: actions.map((a, i) => ({ ...a, sortOrder: i })),
      });
    } catch {
      /* errors are surfaced via the per-mutation onError → toast.error */
    }
  }

  function upsertAction(data: ActionForm) {
    if (editing && editing !== "new") {
      const next = actions.map((a) =>
        a.id === editing.id
          ? { ...a, label: data.label, url: data.url, iconEmoji: data.iconEmoji, target: data.target }
          : a,
      );
      setActions(next);
    } else {
      setActions([
        ...actions,
        {
          id: uuidv4(),
          label: data.label,
          url: data.url,
          iconEmoji: data.iconEmoji,
          target: data.target,
          sortOrder: actions.length,
        },
      ]);
    }
    setEditing(null);
  }

  function deleteAction(id: string) {
    setActions(actions.filter((a) => a.id !== id));
  }

  return (
    <div className="admin-card">
      <div className="admin-list-header">
        <div className="admin-list-header-left">
          <span className="admin-list-header-icon"><LayoutDashboard size={16} /></span>
          <div>
            <div className="admin-card-title" style={{ margin: 0 }}>Command Overview</div>
            <div className="admin-card-sub">KPI-Banner über dem Dashboard mit Schnellzugriffen</div>
          </div>
        </div>
        <button type="button" onClick={saveAll} className="btn-primary">
          <Save size={13} />Speichern
        </button>
      </div>

      <div className="form-stack" style={{ marginTop: 16 }}>
        <label className="checkbox-row">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <span>Command Overview anzeigen</span>
        </label>

        <div className="admin-field">
          <label className="admin-label">Domain</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="admin-input"
            placeholder="z. B. mesh.itsweber.net (leer = window.location.hostname)"
          />
          <span className="admin-hint">
            Wird im Header neben der Uhrzeit angezeigt. Leer lassen, um die aktuelle URL zu verwenden.
          </span>
        </div>

        <div className="admin-field">
          <label className="admin-label">Untertitel</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="admin-input"
            placeholder="Optionale Beschreibung (leer = ausgeblendet)"
          />
        </div>
      </div>

      <div className="admin-list-header" style={{ marginTop: 24 }}>
        <div className="admin-list-header-left">
          <span className="admin-list-header-icon"><LayoutDashboard size={16} /></span>
          <div>
            <div className="admin-card-title" style={{ margin: 0 }}>Schnellzugriffe</div>
            <div className="admin-card-sub">
              {actions.length} Action{actions.length === 1 ? "" : "s"} · erscheinen rechts oben im Banner
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary">
          <Plus size={14} />Hinzufügen
        </button>
      </div>

      {editing && (
        <ActionModal
          action={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={upsertAction}
        />
      )}

      {actions.length === 0 && (
        <div className="int-empty">Noch keine Schnellzugriffe konfiguriert.</div>
      )}

      <div className="admin-list" style={{ marginTop: 8 }}>
        {actions.map((a) => (
          <div key={a.id} className="admin-list-row">
            {a.iconEmoji ? (
              <span className="admin-list-row-icon admin-list-row-icon-emoji">{a.iconEmoji}</span>
            ) : (
              <span className="admin-list-row-icon admin-list-row-icon-emoji">·</span>
            )}
            <div className="admin-list-row-body">
              <span className="admin-list-row-name">{a.label}</span>
              <span className="admin-list-row-sub">{a.url}</span>
            </div>
            <span
              className="admin-list-row-badge"
              style={{ "--badge-color": a.target === "_blank" ? "var(--brand)" : "var(--muted)" } as React.CSSProperties}
            >
              {a.target === "_blank" ? "Neuer Tab" : "Gleicher Tab"}
            </span>
            <button type="button" title="Bearbeiten" className="icon-btn" onClick={() => setEditing(a)}>
              <Pencil size={13} />
            </button>
            <button
              type="button"
              title="Löschen"
              className="icon-btn icon-btn-danger"
              onClick={() => { if (confirm(`"${a.label}" wirklich entfernen?`)) deleteAction(a.id); }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <p className="admin-hint" style={{ marginTop: 16 }}>
        Änderungen an Schnellzugriffen werden erst mit "Speichern" oben übernommen.
      </p>
    </div>
  );
}

function ActionModal({
  action,
  onClose,
  onSubmit,
}: {
  action: QuickAction | null;
  onClose: () => void;
  onSubmit: (data: ActionForm) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ActionForm>({
    resolver: zodResolver(ActionFormSchema),
    defaultValues: action
      ? { label: action.label, url: action.url, iconEmoji: action.iconEmoji, target: action.target }
      : { target: "_blank" },
  });

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader
        title={action ? "Schnellzugriff bearbeiten" : "Schnellzugriff hinzufügen"}
        subtitle={action ? action.label : "Neue Action im Banner"}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
        <ModalBody>
          <div className="form-stack">
            <Field label="Label" error={errors.label?.message}>
              <input {...register("label")} className="admin-input" placeholder="Unraid CORE" />
            </Field>
            <Field label="URL" error={errors.url?.message}>
              <input {...register("url")} className="admin-input" placeholder="https://… oder /admin" />
            </Field>
            <Field label="Icon-Emoji (optional)" error={errors.iconEmoji?.message}>
              <input {...register("iconEmoji")} className="admin-input" placeholder="⚡" />
            </Field>
            <Field label="Ziel" error={errors.target?.message}>
              <select {...register("target")} className="admin-input">
                <option value="_blank">Neuer Tab</option>
                <option value="_self">Gleicher Tab</option>
              </select>
            </Field>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-ghost">Abbrechen</button>
          <button type="submit" className="btn-primary">
            <Save size={13} />Übernehmen
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-field">
      <label className="admin-label">{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
