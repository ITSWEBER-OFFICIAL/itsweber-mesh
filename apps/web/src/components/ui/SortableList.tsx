"use client";

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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState, type ReactNode } from "react";

/* ── Types ─────────────────────────────────────────────────────────────── */
export type SortableItem = { id: string };

type Props<T extends SortableItem> = {
  items: T[];
  onReorder: (newItems: T[]) => void;
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  disabled?: boolean;
};

/* ── SortableList ───────────────────────────────────────────────────────── */
export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  disabled = false,
}: Props<T>) {
  const [active, setActive] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    setActive(null);
    if (!over || a.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === a.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onReorder(arrayMove(items, oldIdx, newIdx));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActive(e.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="admin-list">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              id={item.id}
              isActive={active === item.id}
              disabled={disabled}
            >
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/* ── SortableRow ────────────────────────────────────────────────────────── */
function SortableRow({
  id,
  isActive,
  disabled,
  children,
}: {
  id: string;
  isActive: boolean;
  disabled: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const handle = disabled ? null : (
    <span
      className="dnd-handle"
      {...attributes}
      {...listeners}
      title="Ziehen zum Verschieben"
    >
      <GripVertical size={14} />
    </span>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`admin-list-row ${isDragging ? "admin-list-row-dragging" : ""} ${isActive ? "admin-list-row-lifting" : ""}`}
    >
      {children(handle)}
    </div>
  );
}
