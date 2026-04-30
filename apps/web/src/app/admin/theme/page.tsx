"use client";

import { trpc } from "@/lib/trpc-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, ImageOff, Upload, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

const ThemeSchema = z.object({
  preset: z.enum(["dark", "light", "terminal", "itsweber", "slate", "modern-light", "graphite-command"]),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, "Ungültiger Hex-Farbwert"),
  bgKind: z.enum(["solid", "image"]),
  bgSrc: z.string().optional(),
  bgPattern: z.enum(["none", "mesh", "dots", "stripes"]),
});

type ThemeForm = z.infer<typeof ThemeSchema>;

const PATTERNS: { value: ThemeForm["bgPattern"]; label: string; desc: string }[] = [
  { value: "none",    label: "Aus",      desc: "Kein Muster" },
  { value: "mesh",    label: "Mesh",     desc: "48px Raster" },
  { value: "dots",    label: "Dots",     desc: "18px Punkte" },
  { value: "stripes", label: "Stripes",  desc: "45° Streifen" },
];

const PRESETS: {
  value: ThemeForm["preset"];
  label: string;
  bg: string;
  surface: string;
  accent: string;
  desc: string;
}[] = [
  { value: "dark",          label: "Dark",          bg: "#0e1116", surface: "#161b22", accent: "#3ba7a7", desc: "Standard — Navy + Teal" },
  { value: "light",         label: "Light",         bg: "#f6f8fa", surface: "#ffffff", accent: "#0f766e", desc: "Hell — Weiß + Teal" },
  { value: "terminal",      label: "Terminal",      bg: "#0a0d0a", surface: "#0f130f", accent: "#3fb950", desc: "Hacker — Schwarz + Grün" },
  { value: "itsweber",      label: "ITSWEBER",      bg: "#16222e", surface: "#1c2a37", accent: "#15779b", desc: "Slate Petrol — Liquid Glass" },
  { value: "slate",         label: "Slate",         bg: "#1a1612", surface: "#241f1a", accent: "#d97706", desc: "Warm Dark — Amber + Braun" },
  { value: "modern-light",  label: "Modern Light",  bg: "#f8f9fa", surface: "#ffffff", accent: "#0f766e", desc: "Notion-Style — Hell + Teal" },
  { value: "graphite-command", label: "Graphite Command", bg: "#07090d", surface: "#10161f", accent: "#36d6c2", desc: "Command-Center — Graphit + Mint" },
];

export default function AdminThemePage() {
  const { data: settings } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const updateTheme = trpc.settings.updateTheme.useMutation({
    onSuccess: () => { utils.settings.get.invalidate(); toast.success("Theme übernommen"); },
    onError: (e) => toast.error("Speichern fehlgeschlagen", e.message),
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ThemeForm>({
    resolver: zodResolver(ThemeSchema),
    ...(settings?.theme
      ? {
          values: {
            preset: settings.theme.preset,
            accent: settings.theme.accent,
            bgKind: settings.theme.background.kind === "image" ? "image" : "solid",
            bgSrc: settings.theme.background.kind === "image" ? settings.theme.background.src : "",
            bgPattern: settings.theme.backgroundPattern,
          },
        }
      : {}),
  });

  const currentPreset = watch("preset");
  const currentAccent = watch("accent") ?? "#3ba7a7";
  const currentBgKind = watch("bgKind");
  const currentBgSrc = watch("bgSrc") ?? "";
  const currentPattern = watch("bgPattern") ?? "mesh";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload fehlgeschlagen");
      setValue("bgSrc", json.url);
      setValue("bgKind", "image");
    } catch (err) {
      toast.error("Upload fehlgeschlagen", err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="admin-card" style={{ maxWidth: 640 }}>
      <div className="admin-card-title">Theme</div>
      <div className="admin-card-sub">Aussehen des Dashboards anpassen</div>

      <form
        onSubmit={handleSubmit((data) => {
          const background = data.bgKind === "image" && data.bgSrc?.trim()
            ? { kind: "image" as const, src: data.bgSrc.trim() }
            : { kind: "solid" as const };
          updateTheme.mutate({
            preset: data.preset,
            accent: data.accent,
            background,
            backgroundPattern: data.bgPattern,
          });
        })}
        className="flex flex-col gap-[28px]"
      >
        {/* Preset Kacheln */}
        <div className="admin-field">
          <label className="admin-label">Design-Preset</label>
          <div className="grid gap-[12px] mt-[4px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setValue("preset", p.value)}
                className={`theme-preset-card ${currentPreset === p.value ? "theme-preset-card-active" : ""}`}
              >
                {/* Mini-Dashboard-Preview */}
                <div
                  className="theme-preview-swatch"
                  style={{ background: p.bg }}
                >
                  {/* Surface stripe */}
                  <div style={{
                    position: "absolute", top: 8, left: 8, right: 8,
                    height: 14, borderRadius: 3,
                    background: p.surface,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }} />
                  {/* Accent bar */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: 5,
                    background: p.accent,
                    opacity: 0.9,
                  }} />
                </div>

                <div className="text-center">
                  <div className="text-[12px] font-bold text-[var(--fg)]">{p.label}</div>
                  <div className="font-mono text-[9px] text-[var(--dim)] mt-[2px] tracking-[0.5px]">{p.desc}</div>
                </div>

                {currentPreset === p.value && (
                  <span
                    className="font-mono text-[8px] tracking-[1.5px] uppercase px-[6px] py-[2px] rounded-[4px]"
                    style={{
                      background: "color-mix(in srgb, var(--brand) 15%, transparent)",
                      color: "var(--brand-hover)",
                    }}
                  >
                    Aktiv
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-divider" />

        {/* Hintergrund-Muster */}
        <div className="admin-field">
          <label className="admin-label">Hintergrund-Muster</label>
          <div className="grid gap-[10px] mt-[4px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
            {PATTERNS.map((p) => {
              const active = currentPattern === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setValue("bgPattern", p.value)}
                  className={`theme-pattern-card ${active ? "theme-pattern-card-active" : ""}`}
                  data-pattern={p.value}
                >
                  <span className="theme-pattern-preview" data-pattern={p.value} aria-hidden="true" />
                  <span className="text-[12px] font-bold text-[var(--fg)]">{p.label}</span>
                  <span className="font-mono text-[9px] text-[var(--dim)] tracking-[0.5px]">{p.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="font-mono text-[9px] text-[var(--dim)] tracking-[0.5px] mt-[6px]">
            Wirkt sich auf die ganzseitige Hintergrund-Textur aus. „Aus" lässt nur den Akzent-Glow stehen.
          </p>
        </div>

        <div className="admin-divider" />

        {/* Akzentfarbe */}
        <div className="admin-field">
          <label className="admin-label">Akzentfarbe</label>
          <div className="flex items-center gap-[12px] mt-[4px]">
            <input
              type="color"
              aria-label="Akzentfarbe Farbwähler"
              value={currentAccent}
              onChange={(e) => setValue("accent", e.target.value)}
              className="w-[44px] h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] cursor-pointer bg-transparent flex-shrink-0"
              style={{ padding: 2 }}
            />
            <div className="flex-1">
              <input
                {...register("accent")}
                className="admin-input font-mono"
                placeholder="#3ba7a7"
              />
              {errors.accent && (
                <span className="text-[11px] text-[var(--status-error)] mt-[4px] block">
                  {errors.accent.message}
                </span>
              )}
            </div>
            {/* Live-Vorschau Swatch */}
            <div
              className="w-[44px] h-[44px] rounded-[var(--radius-sm)] flex-shrink-0 border border-[var(--border)]"
              style={{ background: currentAccent, boxShadow: `0 0 16px ${currentAccent}55` }}
            />
          </div>
          <p className="font-mono text-[9px] text-[var(--dim)] tracking-[0.5px] mt-[6px]">
            Wirkt sich auf Akzent-Highlights, Hover-Effekte und Status-Farben aus.
          </p>
        </div>

        <div className="admin-divider" />

        {/* Hintergrundbild */}
        <div className="admin-field">
          <label className="admin-label">Hintergrundbild</label>
          <p className="font-mono text-[9px] text-[var(--dim)] tracking-[0.5px] mb-[10px]">
            JPG, PNG, WebP oder GIF — max. 10 MB. Wird als Vollbild-Hintergrund angezeigt.
          </p>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Hintergrundbild hochladen"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={handleFileChange}
          />

          {currentBgSrc ? (
            /* Vorschau mit Overlay-Buttons */
            <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)]" style={{ height: 160 }}>
              <img
                src={currentBgSrc}
                alt="Hintergrund-Vorschau"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-[8px]" style={{ background: "rgba(0,0,0,0.6)" }}>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-[6px] px-[14px] py-[7px] rounded-[var(--radius-sm)] text-[12px] font-medium text-white border border-white/30 hover:bg-white/20 transition-colors"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Anderes Bild
                </button>
                <button
                  type="button"
                  onClick={() => { setValue("bgSrc", ""); setValue("bgKind", "solid"); }}
                  className="flex items-center gap-[6px] px-[14px] py-[7px] rounded-[var(--radius-sm)] text-[12px] font-medium text-white border border-white/30 hover:bg-white/20 transition-colors"
                >
                  <ImageOff size={13} />
                  Entfernen
                </button>
              </div>
            </div>
          ) : (
            /* Upload-Drop-Zone */
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-[8px] rounded-[var(--radius-md)] border border-dashed border-[var(--border)] text-[var(--dim)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors"
              style={{ minHeight: 100 }}
            >
              {uploading
                ? <Loader2 size={22} className="animate-spin text-[var(--brand)]" />
                : <Upload size={22} />}
              <span className="text-[12px]">{uploading ? "Wird hochgeladen…" : "Bild hochladen"}</span>
            </button>
          )}
        </div>

        <div className="admin-divider" />

        <div>
          <button type="submit" disabled={updateTheme.isPending} className="btn-primary">
            <Save size={14} />
            {updateTheme.isPending ? "Wird übernommen…" : "Theme übernehmen"}
          </button>
        </div>
      </form>
    </div>
  );
}
