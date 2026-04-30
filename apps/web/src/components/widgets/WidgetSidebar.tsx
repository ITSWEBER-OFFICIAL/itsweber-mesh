"use client";

import { trpc } from "@/lib/trpc-client";
import { SlotRenderer } from "./SlotRenderer";

/**
 * Backwards-compatible sidebar wrapper.
 * Internally just delegates to <SlotRenderer slot="sidebar-right" />.
 * Shows a placeholder if no widgets are configured for the sidebar.
 */
export function WidgetSidebar() {
  const { data: widgets = [] } = trpc.widgets.list.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const sidebarWidgets = widgets.filter((w) => w.enabled);

  if (sidebarWidgets.length === 0) {
    return (
      <div className="widget-card">
        <span className="widget-accent" />
        <div className="widget-header">
          <span className="text-[14px]">📦</span>
          <span className="widget-title">Widgets</span>
        </div>
        <div className="widget-hint">
          Keine Widgets in der rechten Sidebar — konfiguriere unter <strong>Admin → Widgets</strong>
        </div>
      </div>
    );
  }

  return <SlotRenderer />;
}
