"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripHorizontal } from "lucide-react";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc-client";
import { InfraNodeCard } from "./InfraNodeCard";
import { useEditMode } from "@/components/layout/EditModeContext";
import type { UnraidWidgetData } from "@/app/api/widgets/unraid/route";
import type { GlancesWidgetData } from "@/app/api/widgets/glances/route";
import type { InfraNode } from "@/server/config/schema";

const EMPTY_NODES: InfraNode[] = [];

function SortableInfraCard({
  node,
  unraid,
  glances,
  editMode,
}: {
  node: InfraNode;
  unraid: UnraidWidgetData | undefined;
  glances: GlancesWidgetData | undefined;
  editMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: !editMode,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`edit-card-wrapper ${isDragging ? "edit-card-dragging" : ""} ${editMode ? "edit-card-active" : ""}`}
      {...(editMode ? { ...attributes, ...listeners } : {})}
      onClick={editMode ? (e) => e.preventDefault() : undefined}
    >
      {editMode && <div className="edit-card-grip-bar"><GripHorizontal size={14} /></div>}
      <InfraNodeCard node={node} unraid={unraid} glances={glances} editMode={editMode} />
    </div>
  );
}

interface InfraNodeGridProps {
  boardId?: string | undefined;
}

export function InfraNodeGrid({ boardId }: InfraNodeGridProps) {
  const { data: allNodes = EMPTY_NODES } = trpc.infraNodes.list.useQuery();
  const nodes = useMemo(
    () => (boardId ? allNodes.filter((n) => n.boardId === boardId) : allNodes),
    [allNodes, boardId],
  );
  const { active: editMode, setPendingInfraOrder } = useEditMode();

  const { data: unraidData } = useQuery<UnraidWidgetData>({
    queryKey: ["widget-unraid"],
    queryFn: () => fetch("/api/widgets/unraid").then((r) => r.json()),
    refetchInterval: 15_000,
    staleTime: 12_000,
  });

  const { data: glancesData } = useQuery<GlancesWidgetData>({
    queryKey: ["widget-glances"],
    queryFn: () => fetch("/api/widgets/glances").then((r) => r.json()),
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

  const serverEnabled = useMemo(
    () => nodes.filter((n) => n.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [nodes],
  );
  const [items, setItems] = useState(serverEnabled);

  useEffect(() => {
    if (!editMode) setItems(serverEnabled);
  }, [editMode, serverEnabled]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((n) => n.id === active.id);
    const newIndex = items.findIndex((n) => n.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setPendingInfraOrder(next.map((n, i) => ({ id: n.id, sortOrder: i })));
  }

  if (items.length === 0) return null;

  if (!editMode) {
    return (
      <section>
        <div className="section-label">Server Nodes</div>
        <div className="infra-grid">
          {items.map((node) => (
            <InfraNodeCard key={node.id} node={node} unraid={unraidData} glances={glancesData} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="section-label">Server Nodes</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((n) => n.id)} strategy={rectSortingStrategy}>
          <div className="infra-grid edit-grid-active">
            {items.map((node) => (
              <SortableInfraCard
                key={node.id}
                node={node}
                unraid={unraidData}
                glances={glancesData}
                editMode={editMode}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
