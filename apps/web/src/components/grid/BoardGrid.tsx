"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useEditMode } from "@/components/layout/EditModeContext";
import { widgetRegistry } from "@/components/widgets/registry";
import { WidgetErrorBoundary } from "@/components/widgets/WidgetErrorBoundary";
import type { GridItemData } from "./RglBoardGridInner";

const RglBoardGrid = dynamic(() => import("./RglBoardGridInner"), {
  ssr: false,
  loading: () => <div className="board-grid-loading" aria-hidden />,
});

interface BoardGridProps {
  /** Filter widgets to this board. Omit to show all widgets (home board behaviour). */
  boardId?: string | undefined;
}

/**
 * Renders all enabled widgets for a board on a 24-column react-grid-layout grid (v15).
 * Services, InfraNodes and Cameras are handled by their own legacy components.
 *
 * Layout changes during edit mode are kept in `pendingLayouts` only. Persistence
 * happens centrally in `EditModeBar.handleSave` — never per-drag — so Cancel
 * can fully revert without server round-trips.
 */
export function BoardGrid({ boardId }: BoardGridProps) {
  const { active: editMode, pendingLayouts, setPendingLayout } = useEditMode();

  const { data: allWidgets = [] } = trpc.widgets.list.useQuery(undefined, { staleTime: 30_000 });
  const widgets = useMemo(
    () => (boardId ? allWidgets.filter((w) => w.boardId === boardId) : allWidgets),
    [allWidgets, boardId],
  );

  const items: GridItemData[] = useMemo(
    () =>
      widgets
        .filter((w) => w.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((w) => {
          const def = widgetRegistry[w.kind];
          const Comp = def.Component;
          const stored = pendingLayouts.get(w.id) ?? w.gridLayout;
          /* Always read min/max from the registry so that older configs (with
             min:3-4 baked in from v8/v11 defaults) do not lock the user into a
             minimum size larger than the widget actually needs. */
          const layout = {
            ...stored,
            minW: def.minSize.w,
            minH: def.minSize.h,
            maxW: def.maxSize.w,
            maxH: def.maxSize.h,
          };
          const isWide = layout.w >= (def.wideThreshold ?? 16);
          return {
            id: w.id,
            layout,
            children: (
              <WidgetErrorBoundary widgetLabel={w.label} widgetKind={w.kind}>
                <Comp
                  instance={w}
                  compact={def.supportsCompact && !isWide}
                  layout={layout}
                  isWide={isWide}
                />
              </WidgetErrorBoundary>
            ),
          };
        }),
    [pendingLayouts, widgets],
  );

  if (items.length === 0) {
    return (
      <div className="board-grid-empty">
        <LayoutGrid size={28} className="board-grid-empty-icon" />
        <p className="board-grid-empty-title">Noch keine Widgets</p>
        <p className="board-grid-empty-hint">
          {editMode
            ? "Klicke auf + Widget um den ersten Block hinzuzufügen."
            : "Aktiviere den Bearbeitungsmodus um Widgets hinzuzufügen."}
        </p>
      </div>
    );
  }

  return (
    <RglBoardGrid
      items={items}
      editMode={editMode}
      pendingLayouts={pendingLayouts}
      onLayoutCommit={(id, layout) => setPendingLayout(id, layout)}
    />
  );
}
