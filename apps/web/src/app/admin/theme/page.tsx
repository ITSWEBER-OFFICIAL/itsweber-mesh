"use client";

import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import type { ThemePreset } from "@/server/config/schema";

/* v18: Signal kennt nur Gerät, Hell und Dunkel. Akzent, Muster und Hintergrundbild der
   alten Themen wirken nicht mehr, ihre Werte bleiben aber in der Config erhalten. */
const PRESETS: { value: ThemePreset; label: string; bg: string; surface: string; accent: string; desc: string }[] = [
  { value: "system", label: "Gerät",  bg: "linear-gradient(90deg,#f4f2ec 50%,#0c151c 50%)", surface: "linear-gradient(90deg,#ffffff 50%,#121f28 50%)", accent: "#14b8a6", desc: "Folgt dem Gerät" },
  { value: "light",  label: "Hell",   bg: "#f4f2ec", surface: "#ffffff", accent: "#0f766e", desc: "Signal auf Papier" },
  { value: "dark",   label: "Dunkel", bg: "#0c151c", surface: "#121f28", accent: "#2dd4bf", desc: "Signal auf Petrol" },
];

export default function AdminThemePage() {
  const { data: settings } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const updateTheme = trpc.settings.updateTheme.useMutation({
    onSuccess: () => { utils.settings.get.invalidate(); toast.success("Thema übernommen"); },
    onError: (e) => toast.error("Speichern fehlgeschlagen", e.message),
  });
  const current = settings?.theme.preset;
  const legacy = settings?.theme.legacyPreset;

  return (
    <div className="admin-card" style={{ maxWidth: 640 }}>
      <div className="admin-card-title">Thema</div>
      <div className="admin-card-sub">Hell, dunkel oder wie das Gerät</div>

      <div className="grid gap-[12px] mt-[16px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={current === p.value}
            disabled={updateTheme.isPending}
            onClick={() => updateTheme.mutate({ preset: p.value })}
            className={`theme-preset-card ${current === p.value ? "theme-preset-card-active" : ""}`}
          >
            <div className="theme-preview-swatch" style={{ background: p.bg }}>
              <div style={{ position: "absolute", top: 8, left: 8, right: 8, height: 14, borderRadius: 3, background: p.surface, border: "1px solid rgba(128,128,128,0.2)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: p.accent }} />
            </div>
            <div className="text-center">
              <div className="text-[13px] font-bold text-[var(--fg)]">{p.label}</div>
              <div className="text-[12px] text-[var(--dim)] mt-[2px]">{p.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {legacy && (
        <p className="text-[12px] text-[var(--dim)] mt-[16px]">
          Vor Mesh 2.0 war das Thema „{legacy}“ gewählt. Akzent, Muster und Hintergrundbild von damals liegen weiter in der Config, werden aber nicht mehr angezeigt.
        </p>
      )}
    </div>
  );
}
