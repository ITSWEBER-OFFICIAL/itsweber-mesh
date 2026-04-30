"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { WidgetSlot, GridLayout } from "@/server/config/schema";

export type SectionKey = "infra" | "services" | "cameras";

export type WidgetReorderItem = {
  id: string;
  sortOrder: number;
  /** Optional: also moves the widget into a different slot in one operation */
  slot?: WidgetSlot;
};

type PendingChanges = {
  serviceOrder: string[] | null;
  sectionOrder: SectionKey[] | null;
  infraOrder: string[] | null;
  cameraOrder: { id: string; sortOrder: number }[] | null;
  infraNodeOrder: { id: string; sortOrder: number }[] | null;
  /** Per-slot widget reorder + cross-slot moves */
  widgetOrder: WidgetReorderItem[] | null;
  quickLinkOrder: { id: string; sortOrder: number }[] | null;
};

type EditModeContextValue = {
  active: boolean;
  enter: () => void;
  exit: () => void;
  pending: PendingChanges;
  setPendingServiceOrder: (ids: string[]) => void;
  setPendingSectionOrder: (keys: SectionKey[]) => void;
  setPendingInfraOrder: (items: { id: string; sortOrder: number }[]) => void;
  setPendingCameraOrder: (items: { id: string; sortOrder: number }[]) => void;
  setPendingWidgetOrder: (items: WidgetReorderItem[]) => void;
  setPendingQuickLinkOrder: (items: { id: string; sortOrder: number }[]) => void;
  hasPending: boolean;
  /** Free-grid layout live-preview during drag/resize */
  pendingLayouts: Map<string, GridLayout>;
  setPendingLayout: (id: string, layout: GridLayout) => void;
  discardPendingLayouts: () => void;
};

const EditModeContext = createContext<EditModeContextValue | null>(null);

const EMPTY: PendingChanges = {
  serviceOrder: null,
  sectionOrder: null,
  infraOrder: null,
  cameraOrder: null,
  infraNodeOrder: null,
  widgetOrder: null,
  quickLinkOrder: null,
};

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState<PendingChanges>(EMPTY);
  const [pendingLayouts, setPendingLayouts] = useState<Map<string, GridLayout>>(new Map());

  const enter = useCallback(() => {
    setPending(EMPTY);
    setPendingLayouts(new Map());
    setActive(true);
  }, []);

  const exit = useCallback(() => {
    setPending(EMPTY);
    setPendingLayouts(new Map());
    setActive(false);
  }, []);

  const setPendingServiceOrder = useCallback((ids: string[]) => {
    setPending((prev) => ({ ...prev, serviceOrder: ids }));
  }, []);

  const setPendingSectionOrder = useCallback((keys: SectionKey[]) => {
    setPending((prev) => ({ ...prev, sectionOrder: keys }));
  }, []);

  const setPendingInfraOrder = useCallback((items: { id: string; sortOrder: number }[]) => {
    setPending((prev) => ({ ...prev, infraNodeOrder: items }));
  }, []);

  const setPendingCameraOrder = useCallback((items: { id: string; sortOrder: number }[]) => {
    setPending((prev) => ({ ...prev, cameraOrder: items }));
  }, []);

  const setPendingWidgetOrder = useCallback((items: WidgetReorderItem[]) => {
    setPending((prev) => ({ ...prev, widgetOrder: items }));
  }, []);

  const setPendingQuickLinkOrder = useCallback((items: { id: string; sortOrder: number }[]) => {
    setPending((prev) => ({ ...prev, quickLinkOrder: items }));
  }, []);

  const setPendingLayout = useCallback((id: string, layout: GridLayout) => {
    setPendingLayouts((prev) => new Map(prev).set(id, layout));
  }, []);

  const discardPendingLayouts = useCallback(() => {
    setPendingLayouts(new Map());
  }, []);

  const hasPending =
    pending.serviceOrder !== null ||
    pending.sectionOrder !== null ||
    pending.infraNodeOrder !== null ||
    pending.cameraOrder !== null ||
    pending.widgetOrder !== null ||
    pending.quickLinkOrder !== null ||
    pendingLayouts.size > 0;

  return (
    <EditModeContext.Provider
      value={{
        active,
        enter,
        exit,
        pending,
        setPendingServiceOrder,
        setPendingSectionOrder,
        setPendingInfraOrder,
        setPendingCameraOrder,
        setPendingWidgetOrder,
        setPendingQuickLinkOrder,
        hasPending,
        pendingLayouts,
        setPendingLayout,
        discardPendingLayouts,
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error("useEditMode must be used inside EditModeProvider");
  return ctx;
}
