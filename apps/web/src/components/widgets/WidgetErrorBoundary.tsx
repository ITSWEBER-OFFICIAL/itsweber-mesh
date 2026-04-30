"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { ReactNode } from "react";

type Props = {
  widgetLabel: string;
  widgetKind: string;
  children: ReactNode;
};

export function WidgetErrorBoundary({ widgetLabel, widgetKind, children }: Props) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="widget-card widget-error-card">
          <div className="widget-header">
            <AlertTriangle size={14} className="widget-error-icon" />
            <span className="widget-title">{widgetLabel}</span>
            <span className="widget-badge widget-error-badge">Fehler</span>
          </div>
          <div className="widget-error-message">
            {error.message || "Unbekannter Render-Fehler"}
          </div>
          <div className="widget-error-meta">
            Widget-Typ: <code>{widgetKind}</code>
          </div>
          <button type="button" className="widget-error-retry" onClick={reset}>
            <RotateCcw size={12} />
            Neu laden
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
