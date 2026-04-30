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
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc-client";
import { useEditMode } from "./EditModeContext";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import type { QuickLink } from "@/server/config/schema";

const VERSION = process.env["NEXT_PUBLIC_VERSION"] ?? "0.1.0";
const EMPTY_LINKS: QuickLink[] = [];

function SortableQuickLink({ link, editMode }: { link: QuickLink; editMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    disabled: !editMode,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  if (editMode) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`qlink qlink-draggable ${isDragging ? "qlink-dragging" : ""}`}
        {...attributes}
        {...listeners}
      >
        <DynamicIcon value={link.iconEmoji} size={14} className="qlink-icon" />
        {link.label}
      </div>
    );
  }

  return (
    <a
      ref={setNodeRef}
      style={style}
      href={link.url}
      target={link.target}
      rel={link.target === "_blank" ? "noopener noreferrer" : undefined}
      className="qlink"
    >
      <DynamicIcon value={link.iconEmoji} size={14} className="qlink-icon" />
      {link.label}
    </a>
  );
}

export function DashboardFooter() {
  const { data: settings } = trpc.settings.get.useQuery(undefined, { staleTime: 60_000 });
  const { data: links = EMPTY_LINKS } = trpc.quickLinks.list.useQuery();
  const { active: editMode, setPendingQuickLinkOrder } = useEditMode();

  const showQuickAccess = settings?.layout.showQuickAccess ?? true;

  const serverEnabled = useMemo(
    () => links.filter((l) => l.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [links],
  );
  const [items, setItems] = useState<QuickLink[]>(serverEnabled);

  useEffect(() => {
    if (!editMode) setItems(serverEnabled);
  }, [editMode, serverEnabled]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((l) => l.id === active.id);
    const newIndex = items.findIndex((l) => l.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setPendingQuickLinkOrder(next.map((l, i) => ({ id: l.id, sortOrder: i })));
  }

  if (!showQuickAccess) return null;

  return (
    <footer className={`app-footer ${editMode ? "app-footer-edit" : ""}`}>
      <span className="footer-label">Quick Access</span>

      {editMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
            {items.map((link) => (
              <SortableQuickLink key={link.id} link={link} editMode={editMode} />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        items.map((link) => (
          <SortableQuickLink key={link.id} link={link} editMode={false} />
        ))
      )}

      <span className="footer-version">
        ITSWEBER Mesh v{VERSION} · Made with ♥
      </span>
    </footer>
  );
}
