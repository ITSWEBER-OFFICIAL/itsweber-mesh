"use client";

import { trpc } from "@/lib/trpc-client";
import { widgetRegistry } from "./registry";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";

/**
 * Legacy slot-renderer — kept for backwards compatibility.
 * In v1.1.0 the slot system was replaced by the free GridContainer.
 * This component now renders all enabled widgets in a single column
 * (no slot-filtering) and is only used by WidgetSidebar which is
 * itself no longer mounted on the main dashboard.
 */
export function SlotRenderer() {
  const { data: widgets = [] } = trpc.widgets.list.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const enabled = [...widgets]
    .filter((w) => w.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (enabled.length === 0) return null;

  return (
    <>
      {enabled.map((w) => {
        const def = widgetRegistry[w.kind];
        const Comp = def.Component;
        return (
          <div key={w.id} data-widget-kind={w.kind}>
            <WidgetErrorBoundary widgetLabel={w.label} widgetKind={w.kind}>
              <Comp instance={w} compact={false} layout={w.gridLayout} isWide />
            </WidgetErrorBoundary>
          </div>
        );
      })}
    </>
  );
}
