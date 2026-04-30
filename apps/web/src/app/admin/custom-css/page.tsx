"use client";

import { useState, useEffect } from "react";
import { Save, AlertTriangle, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";

const TEMPLATE = `/* Beispiele:
:root {
  --bg: #0a1a26;
  --brand: #ff6b35;
}

.app-header {
  border-bottom-color: var(--brand);
}

.svc-card:hover {
  transform: translateY(-4px) scale(1.01);
}
*/`;

export default function AdminCustomCssPage() {
  const { data: settings } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const update = trpc.settings.updateTheme.useMutation({
    onSuccess: () => { utils.settings.get.invalidate(); toast.success("Custom CSS gespeichert", "Reload für vollständige Anwendung."); },
    onError: (e) => toast.error("Speichern fehlgeschlagen", e.message),
  });

  const [css, setCss] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings?.theme.customCss !== undefined && !dirty) {
      setCss(settings.theme.customCss);
    }
  }, [settings?.theme.customCss, dirty]);

  return (
    <div className="admin-card">
      <div className="admin-card-title" style={{ marginBottom: 4 }}>Custom CSS</div>
      <div className="admin-card-sub">
        Füge eigene CSS-Regeln hinzu — wird im &lt;head&gt; aller Seiten injiziert
      </div>

      <div className="custom-css-warning">
        <AlertTriangle size={14} />
        <span>
          Hinweis: CSS wird unverändert eingebettet. Vermeide externe URLs in <code>url(…)</code> ohne TLS und kein <code>@import</code> auf nicht-vertrauenswürdige Quellen.
          Reload nötig nach Speichern.
        </span>
      </div>

      <textarea
        value={css}
        onChange={(e) => { setCss(e.target.value); setDirty(true); }}
        className="admin-input custom-css-editor"
        spellCheck={false}
        placeholder={TEMPLATE}
      />

      <div className="admin-divider" />

      <div className="flex flex-wrap gap-[10px]">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => { setCss(settings?.theme.customCss ?? ""); setDirty(false); }}
        >
          Verwerfen
        </button>
        <button
          type="button"
          disabled={update.isPending}
          className="btn-ghost"
          title="Setzt Custom CSS auf leer und speichert sofort — verwende dies, falls eine eigene Regel das Dashboard unbedienbar gemacht hat."
          onClick={() => {
            if (!confirm("Custom CSS komplett zurücksetzen?\n\nLeert das Feld und speichert sofort. Nutze dies, wenn eigene Regeln das UI unbedienbar gemacht haben.")) return;
            update.mutate({ customCss: "" }, {
              onSuccess: () => { setCss(""); setDirty(false); },
            });
          }}
        >
          <RotateCcw size={13} />Zurücksetzen
        </button>
        <button
          type="button"
          disabled={update.isPending || !dirty}
          className="btn-primary"
          onClick={() => update.mutate({ customCss: css }, { onSuccess: () => setDirty(false) })}
        >
          <Save size={13} />{update.isPending ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
