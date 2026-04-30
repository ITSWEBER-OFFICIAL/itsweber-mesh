"use client";

import { useMemo, useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { ServiceCard } from "./ServiceCard";
import { useEditMode } from "@/components/layout/EditModeContext";
import type { Service } from "@/server/config/schema";

const EMPTY_SERVICES: Service[] = [];

function SortableServiceCard({
  service,
  pingResult,
  index,
  editMode,
  showCategory,
}: {
  service: Service;
  pingResult: { status: "online" | "offline" | "unknown"; latencyMs: number | null; checkedAt: string } | null;
  index: number;
  editMode: boolean;
  showCategory: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service.id,
    disabled: !editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`edit-card-wrapper ${isDragging ? "edit-card-dragging" : ""} ${editMode ? "edit-card-active" : ""}`}
      {...(editMode ? { ...attributes, ...listeners } : {})}
      onClick={editMode ? (e) => e.preventDefault() : undefined}
    >
      {editMode && <div className="edit-card-grip-bar"><GripHorizontal size={14} /></div>}
      <ServiceCard service={service} pingResult={pingResult} index={index} editMode={editMode} showCategory={showCategory} />
    </div>
  );
}

export type ServiceCategory = Service["category"];
export type ServiceCategoryFilter = ServiceCategory | "all";

interface ServiceGridProps {
  boardId?: string | undefined;
  /** v17: only show services with pinnedToHome === true (used on the home dashboard). */
  pinnedOnly?: boolean;
  /** v17: filter by category, or "all" (default) for no filtering. */
  categoryFilter?: ServiceCategoryFilter;
  /** v17: search filter (case-insensitive substring on name and url). */
  searchQuery?: string;
  /** v17: show empty-state hint when no services match. Set to false to render nothing. */
  showEmptyHint?: boolean;
}

export function ServiceGrid({
  boardId,
  pinnedOnly = false,
  categoryFilter = "all",
  searchQuery = "",
  showEmptyHint = true,
}: ServiceGridProps) {
  const { active: editMode, setPendingServiceOrder } = useEditMode();

  const { data: services = EMPTY_SERVICES } = trpc.services.list.useQuery();
  const { data: settings } = trpc.settings.get.useQuery();
  const { data: statusMap = {} } = trpc.status.all.useQuery(undefined, {
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const showCategory = settings?.layout.serviceCardShowCategory ?? true;
  const columns = 5;

  const boardFiltered = useMemo(
    () => (boardId ? services.filter((s) => s.boardId === boardId) : services),
    [boardId, services],
  );
  const allEnabled = useMemo(
    () => boardFiltered.filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [boardFiltered],
  );

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const serverVisible = useMemo(
    () =>
      allEnabled.filter((s) => {
        if (pinnedOnly && !s.pinnedToHome) return false;
        if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
        if (trimmedSearch) {
          const haystack = `${s.name} ${s.url} ${s.description ?? ""}`.toLowerCase();
          if (!haystack.includes(trimmedSearch)) return false;
        }
        return true;
      }),
    [allEnabled, pinnedOnly, categoryFilter, trimmedSearch],
  );

  const [items, setItems] = useState(serverVisible);

  /* Drag-and-drop only relevant outside filter mode; sync visible-items to server
     state whenever it changes (and we're not currently dragging). */
  useEffect(() => {
    if (!editMode) setItems(serverVisible);
  }, [editMode, serverVisible]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    /* Build full order: reordered visible items first, then hidden items so the
       sortOrder remains globally consistent even when filters/pin-state hide rows. */
    const visibleIds = new Set(next.map((s) => s.id));
    const hidden = allEnabled.filter((s) => !visibleIds.has(s.id));
    setPendingServiceOrder([...next, ...hidden].map((s) => s.id));
  }

  if (items.length === 0) {
    if (!showEmptyHint) return null;
    return (
      <div className="service-empty">
        {pinnedOnly
          ? <>Keine Services als „häufig genutzt" markiert. Setze in <strong>Admin → Services</strong> bei den wichtigsten den Pin.</>
          : trimmedSearch || categoryFilter !== "all"
          ? "Keine Treffer für die aktuelle Filter-/Such-Auswahl."
          : <>Keine Services konfiguriert — füge welche unter <strong>Admin → Services</strong> hinzu.</>}
      </div>
    );
  }

  const gridStyle = { ["--svc-cols" as string]: columns } as React.CSSProperties;

  if (!editMode) {
    return (
      <div className="service-grid" style={gridStyle}>
        {items.map((service, i) => (
          <ServiceCard
            key={service.id}
            service={service}
            pingResult={statusMap[service.id] ?? null}
            index={i}
            showCategory={showCategory}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div className="service-grid edit-grid-active" style={gridStyle}>
          {items.map((service, i) => (
            <SortableServiceCard
              key={service.id}
              service={service}
              pingResult={statusMap[service.id] ?? null}
              index={i}
              editMode={editMode}
              showCategory={showCategory}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
