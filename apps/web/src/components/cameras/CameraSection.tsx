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
import { ExternalLink, GripHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useEditMode } from "@/components/layout/EditModeContext";
import type { Camera } from "@/server/config/schema";

type CamEntry = Pick<Camera, "id" | "label" | "snapshotUrl" | "refreshSec" | "linkUrl">;
const EMPTY_CAMERAS: Camera[] = [];

function CameraCard({ id, label, refreshSec, linkUrl, editMode }: {
  id: string;
  label: string;
  refreshSec: number;
  linkUrl?: string;
  editMode?: boolean;
}) {
  const [ts, setTs] = useState(() => Date.now());
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    const interval = setInterval(() => {
      setTs(Date.now());
      setError(false);
    }, refreshSec * 1000);
    return () => clearInterval(interval);
  }, [refreshSec]);

  const src = `/api/widgets/cameras/snapshot?id=${id}&t=${ts}`;

  const inner = (
    <div className="cam-card">
      {error ? (
        <div className="cam-card-error">⚠ Snapshot nicht verfügbar</div>
      ) : (
        <img
          src={src}
          alt={label}
          className="cam-card-img"
          onError={() => setError(true)}
          onLoad={() => setError(false)}
        />
      )}
      <div className="cam-card-label-bar">
        <span className="cam-card-label">{label}</span>
        {linkUrl && <ExternalLink size={10} className="cam-ext-icon" />}
      </div>
    </div>
  );

  if (linkUrl && !editMode) {
    return (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="cam-card-link">
        {inner}
      </a>
    );
  }
  return inner;
}

function SortableCameraCard({ cam, editMode }: { cam: CamEntry; editMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cam.id,
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
      <CameraCard
        id={cam.id}
        label={cam.label}
        refreshSec={cam.refreshSec}
        editMode={editMode}
        {...(cam.linkUrl ? { linkUrl: cam.linkUrl } : {})}
      />
    </div>
  );
}

interface CameraSectionProps {
  boardId?: string | undefined;
}

export function CameraSection({ boardId }: CameraSectionProps) {
  const { active: editMode, setPendingCameraOrder } = useEditMode();

  const { data: allCameras = EMPTY_CAMERAS, isLoading } = trpc.cameras.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const serverCameras: CamEntry[] = useMemo(
    () =>
      (boardId ? allCameras.filter((c) => c.boardId === boardId) : allCameras)
        .filter((c) => c.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [allCameras, boardId],
  );
  const [items, setItems] = useState(serverCameras);

  useEffect(() => {
    if (!editMode) setItems(serverCameras);
  }, [editMode, serverCameras]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setPendingCameraOrder(next.map((c, i) => ({ id: c.id, sortOrder: i })));
  }

  if (!isLoading && items.length === 0) return null;

  return (
    <section>
      <div className="section-label">Kameras</div>
      {isLoading && <div className="cam-section-loading">Lade…</div>}
      {items.length > 0 && (
        editMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((c) => c.id)} strategy={rectSortingStrategy}>
              <div className="cam-section-grid edit-grid-active">
                {items.map((cam) => (
                  <SortableCameraCard key={cam.id} cam={cam} editMode={editMode} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="cam-section-grid">
            {items.map((cam) => (
              <CameraCard
                key={cam.id}
                id={cam.id}
                label={cam.label}
                refreshSec={cam.refreshSec}
                {...(cam.linkUrl ? { linkUrl: cam.linkUrl } : {})}
              />
            ))}
          </div>
        )
      )}
    </section>
  );
}
