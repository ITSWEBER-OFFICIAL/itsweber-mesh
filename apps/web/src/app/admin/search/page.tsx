"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Star, ToggleLeft, ToggleRight } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import type { SearchEngine } from "@/server/config/schema";

const FormSchema = z.object({
  name: z.string().min(1).max(64),
  urlTemplate: z.string().min(1).includes("{q}", { message: "URL muss {q} enthalten" }),
  icon: z.string().optional(),
  hotkey: z.string().max(8).optional(),
});
type Form = z.infer<typeof FormSchema>;

export default function AdminSearchPage() {
  const { data: searchCfg, isLoading } = trpc.search.getConfig.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [editEngine, setEditEngine] = useState<SearchEngine | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const upsert = trpc.search.upsertEngine.useMutation({
    onSuccess: () => { utils.search.getConfig.invalidate(); toast.success("Suchmaschine gespeichert"); },
    onError: onErr,
  });

  const del = trpc.search.deleteEngine.useMutation({
    onSuccess: () => { utils.search.getConfig.invalidate(); toast.success("Suchmaschine gelöscht"); },
    onError: onErr,
  });

  const setDefault = trpc.search.setDefault.useMutation({
    onSuccess: () => { utils.search.getConfig.invalidate(); toast.success("Standard gesetzt"); },
    onError: onErr,
  });

  const updateSettings = trpc.search.updateSettings.useMutation({
    onSuccess: () => { utils.search.getConfig.invalidate(); },
    onError: onErr,
  });

  const engines = searchCfg?.engines ?? [];
  const defaultId = searchCfg?.defaultEngineId;
  const localFirst = searchCfg?.localFirst ?? true;

  if (isLoading) return null;

  return (
    <div className="admin-card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="admin-card-title">Suche</h1>
          <p className="admin-card-sub">Header-Suche & Suchmaschinen</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Neue Suchmaschine
        </button>
      </div>

      {/* Settings toggles */}
      <div className="flex flex-col gap-3 mb-6 pb-6 border-b border-[var(--border)]">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <span className="text-[13px] font-medium text-[var(--fg)]">Lokale Ergebnisse zuerst</span>
            <p className="text-[11px] text-[var(--dim)] mt-0.5">Services, Boards und Quick-Links erscheinen vor Web-Suchmaschinen</p>
          </div>
          <button
            type="button"
            onClick={() => updateSettings.mutate({ localFirst: !localFirst })}
            style={{ color: localFirst ? "var(--brand)" : "var(--dim)" }}
          >
            {localFirst ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </button>
        </label>
      </div>

      {/* Engine list */}
      <div className="flex flex-col gap-2">
        {engines.map((engine) => (
          <div key={engine.id} className="admin-list-row">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--fg)] truncate">{engine.name}</span>
                  {engine.id === defaultId && (
                    <span className="admin-badge admin-badge-brand"><Star size={9} /> Standard</span>
                  )}
                  {engine.hotkey && (
                    <span className="admin-badge font-mono">{engine.hotkey}</span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-[var(--dim)] truncate block max-w-[280px]">
                  {engine.urlTemplate}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {engine.id !== defaultId && (
                <button
                  className="btn-ghost btn-xs"
                  title="Als Standard setzen"
                  onClick={() => setDefault.mutate({ id: engine.id })}
                >
                  <Star size={13} />
                </button>
              )}
              <button className="btn-ghost btn-xs" onClick={() => setEditEngine(engine)}>
                <Pencil size={13} />
              </button>
              {engine.id !== defaultId && (
                <button
                  className="btn-ghost btn-xs btn-danger"
                  onClick={() => {
                    if (confirm(`Suchmaschine "${engine.name}" wirklich löschen?`)) {
                      del.mutate({ id: engine.id });
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
        {engines.length === 0 && (
          <p className="text-[var(--dim)] text-sm py-6 text-center">Keine Suchmaschinen konfiguriert.</p>
        )}
      </div>

      {createOpen && (
        <EngineModal
          onClose={() => setCreateOpen(false)}
          onSubmit={(data) => upsert.mutateAsync(data).then(() => setCreateOpen(false))}
        />
      )}
      {editEngine && (
        <EngineModal
          engine={editEngine}
          onClose={() => setEditEngine(null)}
          onSubmit={(data) =>
            upsert.mutateAsync({ ...data, id: editEngine.id }).then(() => setEditEngine(null))
          }
        />
      )}
    </div>
  );
}

function EngineModal({
  engine,
  onClose,
  onSubmit,
}: {
  engine?: SearchEngine;
  onClose: () => void;
  onSubmit: (data: Form) => Promise<void>;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(FormSchema),
    defaultValues: engine
      ? { name: engine.name, urlTemplate: engine.urlTemplate, icon: engine.icon ?? "", hotkey: engine.hotkey ?? "" }
      : { name: "", urlTemplate: "https://www.google.com/search?q={q}", icon: "", hotkey: "" },
  });

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader
        title={engine ? "Suchmaschine bearbeiten" : "Neue Suchmaschine"}
        onClose={onClose}
      />
      <form className="modal-form-shell" onSubmit={handleSubmit(onSubmit)}>
        <ModalBody>
          <div className="form-stack">
            <div className="admin-field">
              <label className="admin-label">Name</label>
              <input className="admin-input" {...register("name")} placeholder="Google" />
              {errors.name && <span className="admin-field-error">{errors.name.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">URL-Template</label>
              <input
                className="admin-input font-mono text-[12px]"
                {...register("urlTemplate")}
                placeholder="https://www.google.com/search?q={q}"
              />
              <span className="text-[11px] text-[var(--dim)]">
                Verwende <code className="font-mono bg-[var(--surface-raised)] px-1 rounded">{"{q}"}</code> als Platzhalter für den Suchbegriff
              </span>
              {errors.urlTemplate && <span className="admin-field-error">{errors.urlTemplate.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">Hotkey-Präfix (optional)</label>
              <input className="admin-input" {...register("hotkey")} placeholder="g" maxLength={8} />
              <span className="text-[11px] text-[var(--dim)]">
                Tippe diesen Präfix + Leertaste im Suchfeld, um direkt diese Maschine zu nutzen
              </span>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Speichere…" : "Speichern"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
