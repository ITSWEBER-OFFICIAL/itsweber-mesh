"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useEditMode } from "./EditModeContext";
import { useCurrentBoardId } from "./useCurrentBoardId";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { WidgetModal } from "@/components/widgets/WidgetModal";
import { getWidgetDefinition } from "@/components/widgets/registry";

export function EditModeBar() {
  const { active, exit, pending, hasPending, pendingLayouts } = useEditMode();
  const toast = useToast();
  const utils = trpc.useUtils();
  const currentBoardId = useCurrentBoardId();

  const [addOpen, setAddOpen] = useState(false);

  const reorderServices = trpc.services.reorder.useMutation({
    onError: () => toast.error("Fehler", "Service-Reihenfolge konnte nicht gespeichert werden"),
  });
  const updateLayout = trpc.settings.updateLayout.useMutation({
    onError: () => toast.error("Fehler", "Abschnitt-Reihenfolge konnte nicht gespeichert werden"),
  });
  const reorderInfra = trpc.infraNodes.reorder.useMutation({
    onError: () => toast.error("Fehler", "Server-Karten-Reihenfolge konnte nicht gespeichert werden"),
  });
  const reorderCameras = trpc.cameras.reorder.useMutation({
    onError: () => toast.error("Fehler", "Kamera-Reihenfolge konnte nicht gespeichert werden"),
  });
  const reorderWidgets = trpc.widgets.reorder.useMutation({
    onError: () => toast.error("Fehler", "Widget-Reihenfolge konnte nicht gespeichert werden"),
  });
  const updateWidgetLayouts = trpc.widgets.updateLayouts.useMutation({
    onError: () => toast.error("Fehler", "Widget-Layout konnte nicht gespeichert werden"),
  });
  const reorderQuickLinks = trpc.quickLinks.reorder.useMutation({
    onError: () => toast.error("Fehler", "Quick-Link-Reihenfolge konnte nicht gespeichert werden"),
  });
  const upsertWidget = trpc.widgets.upsert.useMutation({
    onSuccess: () => {
      utils.widgets.list.invalidate();
      setAddOpen(false);
      toast.success("Widget hinzugefügt");
    },
    onError: (e) => toast.error("Fehler", e.message),
  });

  if (!active) return null;

  async function handleSave() {
    /* Each mutation triggers patchConfig() which serializes via proper-lockfile.
       Parallel mutations could exhaust the 5×50ms retry budget and collide on
       read-modify-write race conditions, so the saves are sequenced. The widget
       layouts go in one bulk call to keep the round-trip count down. */
    const layoutEntries = Array.from(pendingLayouts, ([id, gridLayout]) => ({ id, gridLayout }));
    const hasAnything =
      pending.serviceOrder !== null ||
      pending.infraNodeOrder !== null ||
      pending.cameraOrder !== null ||
      pending.widgetOrder !== null ||
      pending.quickLinkOrder !== null ||
      layoutEntries.length > 0;

    if (!hasAnything) {
      exit();
      return;
    }

    try {
      if (pending.serviceOrder) await reorderServices.mutateAsync(pending.serviceOrder);
      if (pending.infraNodeOrder) await reorderInfra.mutateAsync(pending.infraNodeOrder);
      if (pending.cameraOrder) await reorderCameras.mutateAsync(pending.cameraOrder);
      if (pending.widgetOrder) await reorderWidgets.mutateAsync(pending.widgetOrder);
      if (pending.quickLinkOrder) await reorderQuickLinks.mutateAsync(pending.quickLinkOrder);
      if (layoutEntries.length > 0) await updateWidgetLayouts.mutateAsync(layoutEntries);

      await Promise.all([
        utils.services.list.invalidate(),
        utils.settings.get.invalidate(),
        utils.infraNodes.list.invalidate(),
        utils.cameras.list.invalidate(),
        utils.widgets.list.invalidate(),
        utils.quickLinks.list.invalidate(),
      ]);
      toast.success("Anordnung gespeichert");
    } catch {
      /* individual mutation error handlers already showed a toast */
    }
    exit();
  }

  const isSaving =
    reorderServices.isPending ||
    updateLayout.isPending ||
    reorderInfra.isPending ||
    reorderCameras.isPending ||
    reorderWidgets.isPending ||
    reorderQuickLinks.isPending ||
    updateWidgetLayouts.isPending;

  return (
    <>
      <div className="edit-mode-bar">
        <span className="edit-mode-bar-label">
          Anordnungs-Modus — Kacheln, Karten, Widgets, Kameras und Abschnitte verschieben.
          {" "}
          <span className="edit-mode-bar-hint">
            Tipp: Widgets größer ziehen schaltet meist erweiterte Ansichten frei (mehr Sensoren, Detail-KPIs, breitere Charts).
          </span>
        </span>
        <div className="edit-mode-bar-actions">
          <button
            type="button"
            className="edit-mode-add-widget"
            onClick={() => setAddOpen(true)}
            disabled={isSaving}
            title="Widget hinzufügen"
          >
            <Plus size={13} />
            Widget
          </button>
          <button
            type="button"
            className="edit-mode-cancel"
            onClick={exit}
            disabled={isSaving}
          >
            <X size={13} />
            Abbrechen
          </button>
          <button
            type="button"
            className="edit-mode-save"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasPending}
          >
            <Check size={13} />
            {isSaving ? "Speichern…" : "Übernehmen"}
          </button>
        </div>
      </div>

      {addOpen && (
        <WidgetModal
          widget={null}
          onClose={() => setAddOpen(false)}
          onSubmit={(data) =>
            {
              const def = getWidgetDefinition(data.kind);
              upsertWidget.mutate({
              kind: data.kind,
              label: data.label,
              enabled: data.enabled,
              refreshSec: data.refreshSec,
              sortOrder: 9999,
              settings: data.settings,
              linkUrl: data.linkUrl ?? "",
              gridLayout: {
                x: 0,
                y: 9999,
                w: def.defaultSize.w,
                h: def.defaultSize.h,
                minW: def.minSize.w,
                minH: def.minSize.h,
                maxW: def.maxSize.w,
                maxH: def.maxSize.h,
              },
              ...(currentBoardId ? { boardId: currentBoardId } : {}),
            });
            }
          }
          isPending={upsertWidget.isPending}
        />
      )}
    </>
  );
}
