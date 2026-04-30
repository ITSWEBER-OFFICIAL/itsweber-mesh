"use client";

import { useState, type ReactNode } from "react";
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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useEditMode, type SectionKey } from "./EditModeContext";

type Props = {
  infra: ReactNode;
  services: ReactNode;
  cameras: ReactNode;
};

const SECTION_LABELS: Record<SectionKey, string> = {
  infra: "Server Nodes",
  services: "Services",
  cameras: "Kameras",
};

function SortableSection({
  id,
  label,
  children,
  editMode,
}: {
  id: SectionKey;
  label: string;
  children: ReactNode;
  editMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-section={id}
      className={`edit-section-wrapper ${isDragging ? "edit-section-dragging" : ""}`}
    >
      {editMode && (
        <div className="edit-section-handle-bar" {...attributes} {...listeners}>
          <GripVertical size={14} />
          <span>{label}</span>
        </div>
      )}
      <div className={editMode ? "edit-section-content" : ""}>
        {children}
      </div>
    </div>
  );
}

const DEFAULT_SECTION_ORDER: SectionKey[] = ["infra", "services", "cameras"];

export function MainSections({ infra, services, cameras }: Props) {
  const { active: editMode, setPendingSectionOrder } = useEditMode();

  const [order, setOrder] = useState<SectionKey[]>(DEFAULT_SECTION_ORDER);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as SectionKey);
    const newIndex = order.indexOf(over.id as SectionKey);
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    setPendingSectionOrder(next);
  }

  const map: Record<SectionKey, ReactNode> = { infra, services, cameras };

  if (!editMode) {
    return (
      <>
        {order.map((key) => (
          <div key={key} data-section={key}>
            {map[key]}
          </div>
        ))}
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {order.map((key) => (
          <SortableSection key={key} id={key} label={SECTION_LABELS[key]} editMode={editMode}>
            {map[key]}
          </SortableSection>
        ))}
      </SortableContext>
    </DndContext>
  );
}
