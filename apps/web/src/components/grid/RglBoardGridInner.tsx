"use client";

import { useMemo, useState, type ReactNode } from "react";
import { GripHorizontal } from "lucide-react";
import {
  Responsive,
  WidthProvider,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { GridLayout } from "@/server/config/schema";

const ResponsiveGridLayout = WidthProvider(Responsive);

export type GridItemData = {
  id: string;
  layout: GridLayout;
  children: ReactNode;
};

type Props = {
  items: GridItemData[];
  editMode: boolean;
  pendingLayouts: Map<string, GridLayout>;
  onLayoutCommit: (id: string, layout: GridLayout) => void;
};

function toRglLayoutItem(id: string, current: GridLayout): LayoutItem {
  const out: LayoutItem = {
    i: id,
    x: current.x,
    y: current.y,
    w: current.w,
    h: current.h,
    minW: current.minW ?? 1,
    minH: current.minH ?? 1,
  };
  if (current.maxW !== undefined) out.maxW = current.maxW;
  if (current.maxH !== undefined) out.maxH = current.maxH;
  return out;
}

function mergeRglIntoSchema(l: LayoutItem, base: GridLayout): GridLayout {
  return { ...base, x: l.x, y: l.y, w: l.w, h: l.h };
}

function gridLayoutsEqual(a: GridLayout, b: GridLayout): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export default function RglBoardGridInner({ items, editMode, pendingLayouts, onLayoutCommit }: Props) {
  const [breakpoint, setBreakpoint] = useState("lg");
  const layouts: ResponsiveLayouts<string> = useMemo(() => {
    return {
      lg: items.map((item) => toRglLayoutItem(item.id, pendingLayouts.get(item.id) ?? item.layout)),
    };
  }, [items, pendingLayouts]);

  const handleLayoutChange = (current: readonly LayoutItem[]) => {
    if (!editMode) return;
    if (breakpoint !== "lg" && breakpoint !== "md") return;
    for (const l of current) {
      const item = items.find((i) => i.id === l.i);
      if (!item) continue;
      const previous = pendingLayouts.get(item.id) ?? item.layout;
      const next = mergeRglIntoSchema(l, item.layout);
      if (!gridLayoutsEqual(previous, next)) {
        onLayoutCommit(item.id, next);
      }
    }
  };

  return (
    <ResponsiveGridLayout
      className={`rgl-board ${editMode ? "rgl-board-edit" : ""}`}
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 24, md: 24, sm: 16, xs: 8, xxs: 4 }}
      rowHeight={20}
      margin={[8, 8]}
      containerPadding={[0, 0]}
      compactType="vertical"
      preventCollision={false}
      isDraggable={editMode}
      isResizable={editMode}
      draggableHandle=".rgl-drag-handle"
      resizeHandles={["e", "w", "s", "se", "sw"]}
      useCSSTransforms
      onBreakpointChange={setBreakpoint}
      onDragStop={handleLayoutChange}
      onResizeStop={handleLayoutChange}
    >
      {items.map((item) => (
        <div key={item.id} className="rgl-tile">
          {editMode && (
            <button
              type="button"
              className="rgl-drag-handle"
              aria-label="Kachel verschieben"
              tabIndex={-1}
            >
              <GripHorizontal size={12} />
            </button>
          )}
          {item.children}
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
