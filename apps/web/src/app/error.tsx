"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="error-boundary-shell">
      <div className="error-boundary-card">
        <div className="error-boundary-icon">
          <AlertTriangle size={32} />
        </div>
        <h1 className="error-boundary-title">Unerwarteter Fehler</h1>
        <p className="error-boundary-desc">
          Ein Fehler ist aufgetreten. Du kannst die Seite neu laden oder zum Dashboard zurückkehren.
        </p>
        {error.digest && (
          <p className="error-boundary-digest">
            <code>{error.digest}</code>
          </p>
        )}
        <div className="error-boundary-actions">
          <button type="button" className="btn-primary" onClick={reset}>
            <RefreshCw size={14} /> Erneut versuchen
          </button>
          <a href="/admin" className="btn-ghost">
            <LayoutDashboard size={14} /> Zum Admin
          </a>
        </div>
      </div>
    </div>
  );
}
