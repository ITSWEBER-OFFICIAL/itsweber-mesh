"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, LayoutGrid, Tv, Home, Wrench, Globe, Server, Search, Upload, X, Wand2 } from "lucide-react";
import type { IconSuggestion } from "@/app/api/icons/suggest/route";
import { SortableList } from "@/components/ui/SortableList";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm, useFormContext, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { SERVICE_CATALOG, type ServiceCatalogEntry } from "@/lib/service-catalog";
import type { Service } from "@/server/config/schema";

const ServiceFormSchema = z.object({
  name: z.string().min(1, "Name erforderlich"),
  url: z.string().url("Gültige URL erforderlich"),
  description: z.string().optional(),
  category: z.enum(["infrastructure", "media", "smart-home", "tools", "external"]),
  icon: z.string().default("globe"),
  color: z.string().optional(),
  enabled: z.boolean().default(true),
  /** v17: Service-Card erscheint dann zusätzlich in der "Häufig genutzt"-Section auf der Home-Route. */
  pinnedToHome: z.boolean().default(false),
  pingKind: z.enum(["http", "tcp", "none"]),
  pingUrl: z.string().optional(),
  pingTimeoutMs: z.number().int().min(500).max(30000).default(3000),
});
type ServiceForm = z.infer<typeof ServiceFormSchema>;

const CATEGORIES: { value: Service["category"]; label: string }[] = [
  { value: "infrastructure", label: "Infrastructure" },
  { value: "media",          label: "Media" },
  { value: "smart-home",     label: "Smart Home" },
  { value: "tools",          label: "Tools" },
  { value: "external",       label: "External" },
];

const CATEGORY_META: Record<Service["category"], { icon: React.ReactNode; color: string; label: string }> = {
  infrastructure: { icon: <Server size={14} />,  color: "var(--cat-infrastructure)", label: "Infrastructure" },
  media:          { icon: <Tv size={14} />,       color: "var(--cat-media)",          label: "Media" },
  "smart-home":   { icon: <Home size={14} />,     color: "var(--cat-smart-home)",     label: "Smart Home" },
  tools:          { icon: <Wrench size={14} />,   color: "var(--cat-tools)",          label: "Tools" },
  external:       { icon: <Globe size={14} />,    color: "var(--cat-external)",       label: "External" },
};

export default function AdminServicesPage() {
  const { data: services = [] } = trpc.services.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [items, setItems] = useState(services);
  useEffect(() => { setItems(services); }, [services]);

  const upsert = trpc.services.upsert.useMutation({
    onSuccess: () => { utils.services.list.invalidate(); setEditing(null); toast.success("Service gespeichert"); },
    onError: onErr,
  });
  const del = trpc.services.delete.useMutation({
    onSuccess: () => { utils.services.list.invalidate(); toast.success("Service gelöscht"); },
    onError: onErr,
  });
  const reorder = trpc.services.reorder.useMutation({
    onError: () => { setItems(services); toast.error("Reihenfolge konnte nicht gespeichert werden"); },
  });

  const [editing, setEditing] = useState<Service | null | "new">(null);

  return (
    <div className="admin-card">
      <div className="admin-list-header">
        <div className="admin-list-header-left">
          <span className="admin-list-header-icon"><LayoutGrid size={16} /></span>
          <div>
            <div className="admin-card-title" style={{ margin: 0 }}>Services</div>
            <div className="admin-card-sub">{items.length} Einträge konfiguriert</div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary">
          <Plus size={14} />Hinzufügen
        </button>
      </div>

      {editing && (
        <ServiceFormModal
          service={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) =>
            upsert.mutate({
              id: editing !== "new" ? editing.id : undefined,
              name: data.name,
              url: data.url,
              description: data.description,
              category: data.category,
              icon: data.icon,
              color: data.color,
              enabled: data.enabled,
              pinnedToHome: data.pinnedToHome,
              pingTarget: {
                kind: data.pingKind,
                url: data.pingUrl ?? data.url,
                expectStatus: [200, 204, 301, 302, 401],
                timeoutMs: data.pingTimeoutMs,
              },
            })
          }
          isPending={upsert.isPending}
        />
      )}

      {items.length === 0 && (
        <div className="int-empty">Noch keine Services konfiguriert.</div>
      )}

      <SortableList
        items={items}
        onReorder={(next) => {
          setItems(next);
          reorder.mutate(next.map((s) => s.id));
        }}
        renderItem={(svc, handle) => {
          const meta = CATEGORY_META[svc.category];
          const isImg = svc.icon.startsWith("http") || svc.icon.startsWith("/") || svc.icon.startsWith("data:");
          return (
            <>
              {handle}
              <span
                className="admin-list-row-icon"
                style={{ "--row-color": svc.color ?? meta.color } as React.CSSProperties}
              >
                {isImg
                  ? <img src={svc.icon} alt={svc.name} className="admin-list-row-app-icon" />
                  : meta.icon}
              </span>
              <span className={`admin-list-row-dot ${svc.enabled ? "admin-list-row-dot-ok" : "admin-list-row-dot-off"}`} title={svc.enabled ? "Aktiv" : "Deaktiviert"} />
              <div className="admin-list-row-body">
                <span className="admin-list-row-name">{svc.name}</span>
                <span className="admin-list-row-sub">{svc.url}</span>
              </div>
              <span className="admin-list-row-badge" style={{ "--badge-color": svc.color ?? meta.color } as React.CSSProperties}>
                {meta.label}
              </span>
              <button type="button" title={`${svc.name} bearbeiten`} className="icon-btn" onClick={() => setEditing(svc)}>
                <Pencil size={13} />
              </button>
              <button type="button" title={`${svc.name} löschen`} className="icon-btn icon-btn-danger"
                onClick={() => { if (confirm(`"${svc.name}" wirklich löschen?`)) del.mutate({ id: svc.id }); }}>
                <Trash2 size={13} />
              </button>
            </>
          );
        }}
      />
    </div>
  );
}

/* ── Icon-Picker Field (inline, no overlay) ─────────────────────────────── */
function IconPickerField() {
  const methods = useFormContext<ServiceForm>();
  const { setValue, watch } = methods;
  const icon = watch("icon");
  const url = watch("url");
  const [showCatalog, setShowCatalog] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<IconSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const isImg = icon && (icon.startsWith("http") || icon.startsWith("/") || icon.startsWith("data:"));

  const filtered = q.trim()
    ? SERVICE_CATALOG.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
    : SERVICE_CATALOG;

  const fetchSuggestions = useCallback(async () => {
    if (!url) return;
    setLoadingSuggestions(true);
    setShowSuggestions(true);
    setShowCatalog(false);
    try {
      const res = await fetch(`/api/icons/suggest?url=${encodeURIComponent(url)}`);
      const data = await res.json() as { suggestions: IconSuggestion[] };
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [url]);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") setValue("icon", result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleAppSelect(entry: ServiceCatalogEntry) {
    setValue("icon", entry.iconUrl);
    setValue("color", entry.color);
    if (!methods.getValues("name")) setValue("name", entry.name);
    setValue("category", entry.category);
    setShowCatalog(false);
    setQ("");
  }

  return (
    <div className="icon-picker-wrap">
      {/* Top row: preview + buttons */}
      <div className="icon-picker-row">
        <div className="icon-picker-preview">
          {isImg
            ? <img src={icon} alt="icon" className="icon-picker-preview-img" />
            : <Globe size={20} className="icon-picker-preview-fallback" />}
        </div>
        <button
          type="button"
          className={`btn-ghost icon-picker-btn ${showSuggestions ? "icon-picker-btn-active" : ""}`}
          onClick={fetchSuggestions}
          disabled={!url || loadingSuggestions}
          title="Icon automatisch erkennen"
        >
          <Wand2 size={13} />{loadingSuggestions ? "Suche…" : "Auto-Detect"}
        </button>
        <button
          type="button"
          className={`btn-ghost icon-picker-btn ${showCatalog ? "icon-picker-btn-active" : ""}`}
          onClick={() => { setShowCatalog((v) => !v); setShowSuggestions(false); setQ(""); }}
        >
          <Search size={13} />App-Katalog
        </button>
        <button type="button" className="btn-ghost icon-picker-btn" onClick={() => fileRef.current?.click()}>
          <Upload size={13} />Eigenes Bild
        </button>
        {isImg && (
          <button type="button" className="icon-btn icon-btn-danger" title="Icon entfernen" onClick={() => setValue("icon", "globe")}>
            <X size={13} />
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" aria-label="Eigenes Icon hochladen" className="hidden" onChange={handleUpload} />
      </div>

      {/* Auto-detect suggestions panel */}
      {showSuggestions && (
        <div className="app-catalog-panel">
          <div className="app-catalog-panel-header">
            <span className="app-catalog-panel-title">Icon-Vorschläge</span>
            <button type="button" className="icon-btn" onClick={() => setShowSuggestions(false)}>
              <X size={12} />
            </button>
          </div>
          {loadingSuggestions && (
            <div className="app-catalog-empty">Suche Icons…</div>
          )}
          {!loadingSuggestions && suggestions.length === 0 && (
            <div className="app-catalog-empty">Keine Vorschläge gefunden</div>
          )}
          <div className="app-catalog-grid">
            {suggestions.map((s, i) => (
              <SuggestionItem
                key={i}
                suggestion={s}
                onSelect={() => { setValue("icon", s.url); setShowSuggestions(false); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inline catalog panel */}
      {showCatalog && (
        <div className="app-catalog-panel">
          <div className="app-catalog-search-wrap">
            <Search size={12} className="app-catalog-search-icon" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="app-catalog-search"
              placeholder="App suchen…"
            />
            {q && (
              <button type="button" className="app-catalog-clear" title="Suche löschen" onClick={() => setQ("")}>
                <X size={11} />
              </button>
            )}
          </div>
          <div className="app-catalog-grid">
            {filtered.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="app-catalog-item"
                onClick={() => handleAppSelect(entry)}
                title={entry.name}
              >
                <div className="app-catalog-icon-wrap" style={{ "--app-color": entry.color } as React.CSSProperties}>
                  <img
                    src={entry.iconUrl}
                    alt={entry.name}
                    className="app-catalog-icon-img"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <span className="app-catalog-name">{entry.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="app-catalog-empty">Keine App gefunden</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionItem({ suggestion, onSelect }: { suggestion: IconSuggestion; onSelect: () => void }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <button
      type="button"
      className="app-catalog-item"
      onClick={onSelect}
      title={suggestion.label}
      aria-label={suggestion.label}
    >
      <div className="app-catalog-icon-wrap">
        <img
          src={suggestion.url}
          alt={suggestion.label}
          className="app-catalog-icon-img"
          loading="lazy"
          onError={() => setHidden(true)}
        />
      </div>
      <span className="app-catalog-name app-catalog-name-xs">{suggestion.source}</span>
    </button>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
function ServiceFormModal({ service, onClose, onSubmit, isPending }: {
  service: Service | null;
  onClose: () => void;
  onSubmit: (data: ServiceForm) => void;
  isPending: boolean;
}) {
  const methods = useForm<ServiceForm>({
    resolver: zodResolver(ServiceFormSchema),
    defaultValues: service
      ? {
          name: service.name,
          url: service.url,
          description: service.description,
          category: service.category,
          icon: service.icon,
          color: service.color ?? "",
          enabled: service.enabled,
          pinnedToHome: service.pinnedToHome,
          pingKind: service.pingTarget.kind,
          pingUrl: service.pingTarget.url ?? "",
          pingTimeoutMs: service.pingTarget.timeoutMs,
        }
      : { category: "tools", pingKind: "http", pingTimeoutMs: 3000, enabled: true, pinnedToHome: false, icon: "globe" },
  });
  const { register, handleSubmit, formState: { errors } } = methods;

  return (
    <FormProvider {...methods}>
      <Modal onClose={onClose} size="xl">
        <ModalHeader
          title={service ? "Service bearbeiten" : "Service hinzufügen"}
          subtitle={service ? service.name : "Neuer Eintrag"}
          onClose={onClose}
        />
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
          <ModalBody>
            <div className="form-stack">

              {/* Icon picker row */}
              <Field label="App / Icon">
                <IconPickerField />
              </Field>

              <div className="admin-grid-2">
                <Field label="Name" error={errors.name?.message}>
                  <input {...register("name")} className="admin-input" placeholder="Home Assistant" />
                </Field>
                <Field label="Kategorie" error={errors.category?.message}>
                  <select {...register("category")} className="admin-input">
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="URL" error={errors.url?.message}>
                <input {...register("url")} className="admin-input" placeholder="https://my-service.example.com" />
              </Field>

              <Field label="Beschreibung" error={errors.description?.message}>
                <input {...register("description")} className="admin-input" placeholder="Optional" />
              </Field>

              <div className="admin-grid-2">
                <Field label="Ping-Typ" error={errors.pingKind?.message}>
                  <select {...register("pingKind")} className="admin-input">
                    <option value="http">HTTP</option>
                    <option value="tcp">TCP</option>
                    <option value="none">Kein Ping</option>
                  </select>
                </Field>
                <Field label="Ping-URL (optional)" error={errors.pingUrl?.message}>
                  <input {...register("pingUrl")} className="admin-input" placeholder="leer = Service-URL" />
                  <span className="admin-hint">Ohne Schema → https:// wird ergänzt.</span>
                </Field>
              </div>

              <label className="checkbox-row">
                <input type="checkbox" {...register("enabled")} />
                <span>Service aktiviert</span>
              </label>

              <label className="checkbox-row">
                <input type="checkbox" {...register("pinnedToHome")} />
                <span>Auf Dashboard unter „Häufig genutzt" zeigen</span>
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
    </FormProvider>
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
