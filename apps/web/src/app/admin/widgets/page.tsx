"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { SortableList } from "@/components/ui/SortableList";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { WidgetModal, WIDGET_KINDS, WIDGET_KIND_COLOR } from "@/components/widgets/WidgetModal";
import { getWidgetDefinition } from "@/components/widgets/registry";
import type { WidgetInstance } from "@/server/config/schema";

export default function AdminWidgetsPage() {
  const { data: widgets = [] } = trpc.widgets.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [items, setItems] = useState(widgets);
  useEffect(() => { setItems(widgets); }, [widgets]);

  const upsert = trpc.widgets.upsert.useMutation({
    onSuccess: () => { utils.widgets.list.invalidate(); setEditing(null); toast.success("Widget gespeichert"); },
    onError: onErr,
  });
  const del = trpc.widgets.delete.useMutation({
    onSuccess: () => { utils.widgets.list.invalidate(); toast.success("Widget gelöscht"); },
    onError: onErr,
  });
  const reorder = trpc.widgets.reorder.useMutation({
    onError: () => { setItems(widgets); toast.error("Reihenfolge konnte nicht gespeichert werden"); },
  });

  const [editing, setEditing] = useState<WidgetInstance | null | "new">(null);

  return (
    <div className="admin-card">
      <div className="admin-list-header">
        <div className="admin-list-header-left">
          <span className="admin-list-header-icon"><Layers size={16} /></span>
          <div>
            <div className="admin-card-title" style={{ margin: 0 }}>Widgets</div>
            <div className="admin-card-sub">{items.length} Widget{items.length !== 1 ? "s" : ""} konfiguriert</div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary">
          <Plus size={14} />Hinzufügen
        </button>
      </div>

      {editing && (
        <WidgetModal
          widget={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            const def = getWidgetDefinition(data.kind);
            upsert.mutate({
              id: editing !== "new" ? editing.id : undefined,
              kind: data.kind,
              label: data.label,
              enabled: data.enabled,
              refreshSec: data.refreshSec,
              sortOrder: editing !== "new" ? editing.sortOrder : items.length,
              settings: data.settings,
              linkUrl: data.linkUrl ?? "",
              ...(editing === "new"
                ? {
                    gridLayout: {
                      x: 0,
                      y: items.length * 5,
                      w: def.defaultSize.w,
                      h: def.defaultSize.h,
                      minW: def.minSize.w,
                      minH: def.minSize.h,
                      maxW: def.maxSize.w,
                      maxH: def.maxSize.h,
                    },
                  }
                : {}),
            });
          }}
          isPending={upsert.isPending}
        />
      )}

      {items.length === 0 && (
        <div className="int-empty">Noch keine Widgets konfiguriert — füge dein erstes Widget hinzu.</div>
      )}

      <SortableList
        items={items}
        onReorder={(next) => {
          setItems(next);
          reorder.mutate(next.map((w, i) => ({ id: w.id, sortOrder: i })));
        }}
        renderItem={(w, handle) => {
          const kind = WIDGET_KINDS.find((k) => k.value === w.kind);
          const color = WIDGET_KIND_COLOR[w.kind];
          return (
            <>
              {handle}
              <span className="admin-list-row-icon" style={{ "--row-color": color } as React.CSSProperties}>
                {kind?.icon}
              </span>
              <span className={`admin-list-row-dot ${w.enabled ? "admin-list-row-dot-ok" : "admin-list-row-dot-off"}`} title={w.enabled ? "Aktiv" : "Deaktiviert"} />
              <div className="admin-list-row-body">
                <span className="admin-list-row-name">{w.label}</span>
                <span className="admin-list-row-sub">{kind?.desc} · alle {w.refreshSec}s · Grid {w.gridLayout.w}×{w.gridLayout.h}</span>
              </div>
              <span className="admin-list-row-badge" style={{ "--badge-color": color } as React.CSSProperties}>
                {kind?.label}
              </span>
              <button type="button" title="Bearbeiten" className="icon-btn" onClick={() => setEditing(w)}><Pencil size={13} /></button>
              <button type="button" title="Löschen" className="icon-btn icon-btn-danger"
                onClick={() => { if (confirm(`"${w.label}" wirklich löschen?`)) del.mutate({ id: w.id }); }}>
                <Trash2 size={13} />
              </button>
            </>
          );
        }}
      />

      {items.length > 0 && (
        <div className="admin-list-hint">
          Tipp: Widgets benötigen eine konfigurierte Integration unter <strong>Admin → Integrationen</strong>. Größe + Position per Drag &amp; Drop im Dashboard-Edit-Mode anpassen.
        </div>
      )}
    </div>
  );
}
