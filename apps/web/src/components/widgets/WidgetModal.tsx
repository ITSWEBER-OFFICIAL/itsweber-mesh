"use client";

import { useState } from "react";
import {
  Plus, Save, Server, Home, Shield, Network, HardDrive, Activity,
  Box, Gauge, Zap, ShieldCheck, Camera, Sun, Cpu, Radio, Video, Eye, Code, X,
} from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import type { WidgetInstance, WidgetKind } from "@/server/config/schema";

/* ── Widget kinds catalog (single source of truth) ───────────────────────── */
export const WIDGET_KINDS: {
  value: WidgetKind;
  label: string;
  icon: React.ReactNode;
  desc: string;
}[] = [
  { value: "unraid",        label: "Unraid",         icon: <Server size={14} />,      desc: "CPU, RAM, Array-Status" },
  { value: "glances",       label: "Glances",        icon: <Gauge size={14} />,       desc: "Live CPU/RAM/Disk pro Host" },
  { value: "homeassistant", label: "Home Assistant", icon: <Home size={14} />,        desc: "Entitäten, Temperaturen" },
  { value: "smartHome",     label: "Smart Home",     icon: <Home size={14} />,        desc: "HA Statistik (2x2 Grid)" },
  { value: "adguard",       label: "AdGuard Home",   icon: <Shield size={14} />,      desc: "DNS-Anfragen, Blockrate" },
  { value: "pihole",        label: "Pi-hole",        icon: <ShieldCheck size={14} />, desc: "DNS-Filter" },
  { value: "unifi",         label: "UniFi",          icon: <Network size={14} />,     desc: "Clients, Netzwerk-Stats" },
  { value: "network",       label: "Netzwerk",       icon: <Activity size={14} />,    desc: "Geräteliste mit Health" },
  { value: "storage",       label: "Speicher",       icon: <HardDrive size={14} />,   desc: "Array-Belegung pro Node" },
  { value: "portainer",     label: "Portainer",      icon: <Box size={14} />,         desc: "Docker-Container" },
  { value: "uptimeKuma",    label: "Uptime Kuma",    icon: <Activity size={14} />,    desc: "Service-Uptime" },
  { value: "speedtest",     label: "Speedtest",      icon: <Zap size={14} />,         desc: "Internet-Speed" },
  { value: "cameras",       label: "Kameras",        icon: <Camera size={14} />,      desc: "Snapshot-Kamera-Widget" },
  { value: "weather",       label: "Wetter",         icon: <Sun size={14} />,         desc: "Open-Meteo" },
  { value: "esphome",       label: "ESPHome",        icon: <Cpu size={14} />,         desc: "ESPHome via HA" },
  { value: "zigbee2mqtt",   label: "Zigbee2MQTT",    icon: <Radio size={14} />,       desc: "Z2M via HA-Bridge" },
  { value: "unifiProtect",  label: "UniFi Protect",  icon: <Video size={14} />,       desc: "Kameras + Events" },
  { value: "frigate",       label: "Frigate",        icon: <Eye size={14} />,         desc: "Frigate-Events" },
  { value: "customRest",    label: "Custom REST",    icon: <Code size={14} />,        desc: "Generischer JSON-Endpoint" },
];

export const WIDGET_KIND_COLOR: Record<WidgetKind, string> = {
  unraid:        "var(--brand)",
  glances:       "var(--brand)",
  homeassistant: "#fb923c",
  smartHome:     "#fb923c",
  adguard:       "#60a5fa",
  pihole:        "#dc2626",
  unifi:         "#a78bfa",
  network:       "var(--status-ok)",
  storage:       "var(--brand)",
  portainer:     "#13bef9",
  uptimeKuma:    "#5cdd8b",
  speedtest:     "#f59e0b",
  cameras:       "#818cf8",
  weather:       "#fbbf24",
  esphome:       "#22d3ee",
  zigbee2mqtt:   "#84cc16",
  unifiProtect:  "#a78bfa",
  frigate:       "#a855f7",
  customRest:    "var(--muted)",
};

const FormSchema = z.object({
  id: z.string().optional(),
  kind: z.enum([
    "unraid", "homeassistant", "adguard", "unifi",
    "smartHome", "network", "storage",
    "glances", "portainer", "uptimeKuma", "speedtest", "pihole", "cameras",
    "weather", "esphome", "zigbee2mqtt", "unifiProtect", "frigate", "customRest",
  ]),
  label: z.string().min(1, "Name erforderlich"),
  enabled: z.boolean().default(true),
  refreshSec: z.number().int().min(5).default(30),
  linkUrl: z.string().optional(),
});
export type WidgetForm = z.infer<typeof FormSchema>;

const MULTI_INSTANCE_KINDS: WidgetKind[] = [
  "portainer", "pihole", "speedtest", "frigate", "glances", "unraid", "esphome",
];

/* ── Custom REST settings state ──────────────────────────────────────────── */
type CRestTile = { label: string; path: string; unit: string };
type CRestHeader = { key: string; value: string };

function parseCRestSettings(s: Record<string, unknown>) {
  return {
    url: typeof s["url"] === "string" ? s["url"] : "",
    method: s["method"] === "POST" ? "POST" as const : "GET" as const,
    displayMode: (s["displayMode"] as "tiles" | "single" | "raw") ?? "tiles",
    headers: Array.isArray(s["headers"]) ? (s["headers"] as CRestHeader[]) : [],
    body: typeof s["body"] === "string" ? s["body"] : "",
    tiles: Array.isArray(s["tiles"]) ? (s["tiles"] as CRestTile[]) : [],
  };
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
export interface WidgetModalSubmitPayload extends WidgetForm {
  settings: Record<string, unknown>;
}

interface Props {
  /** Editing an existing widget; pass `null` for "new". */
  widget: WidgetInstance | null;
  onClose: () => void;
  onSubmit: (data: WidgetModalSubmitPayload) => void;
  isPending: boolean;
}

export function WidgetModal({ widget, onClose, onSubmit, isPending }: Props) {
  const { data: integrations } = trpc.integrations.get.useQuery();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<WidgetForm>({
    resolver: zodResolver(FormSchema),
    defaultValues: widget
      ? {
          id: widget.id,
          kind: widget.kind,
          label: widget.label,
          enabled: widget.enabled,
          refreshSec: widget.refreshSec,
          linkUrl: widget.linkUrl ?? "",
        }
      : { kind: "unraid", label: "", enabled: true, refreshSec: 30, linkUrl: "" },
  });

  const currentKind = watch("kind");

  const [integrationIds, setIntegrationIds] = useState<string[]>(() => {
    const s = widget?.settings;
    if (!s) return [];
    if (Array.isArray(s["integrationIds"])) return s["integrationIds"] as string[];
    if (typeof s["integrationId"] === "string" && s["integrationId"]) return [s["integrationId"] as string];
    return [];
  });

  const initCRest = parseCRestSettings(widget?.settings ?? {});
  const [esphomeMode, setEsphomeMode] = useState<"auto" | "direct" | "ha">(() => {
    const mode = widget?.settings?.["mode"];
    return mode === "direct" || mode === "ha" || mode === "auto" ? mode : "auto";
  });
  const [crestUrl, setCrestUrl] = useState(initCRest.url);
  const [crestMethod, setCrestMethod] = useState(initCRest.method);
  const [crestDisplayMode, setCrestDisplayMode] = useState(initCRest.displayMode);
  const [crestHeaders, setCrestHeaders] = useState<CRestHeader[]>(initCRest.headers);
  const [crestBody, setCrestBody] = useState(initCRest.body);
  const [crestTiles, setCrestTiles] = useState<CRestTile[]>(
    initCRest.tiles.length > 0 ? initCRest.tiles : [{ label: "", path: "$.", unit: "" }],
  );

  function buildSettings(): Record<string, unknown> {
    if (currentKind === "esphome") {
      const base = widget?.settings ?? {};
      const { integrationId: _old, integrationIds: _oldArr, mode: _oldMode, ...rest } = base as Record<string, unknown>;
      void _old; void _oldArr; void _oldMode;
      return {
        ...rest,
        mode: esphomeMode,
        ...(integrationIds.length > 0 ? { integrationIds } : {}),
      };
    }
    if (MULTI_INSTANCE_KINDS.includes(currentKind) && currentKind !== "customRest") {
      const base = widget?.settings ?? {};
      const { integrationId: _old, integrationIds: _oldArr, ...rest } = base as Record<string, unknown>;
      void _old; void _oldArr;
      return integrationIds.length > 0 ? { ...rest, integrationIds } : rest;
    }
    if (currentKind !== "customRest") return widget?.settings ?? {};
    return {
      url: crestUrl,
      method: crestMethod,
      displayMode: crestDisplayMode,
      headers: crestHeaders.filter((h) => h.key.trim()),
      body: crestBody,
      tiles: crestTiles.filter((t) => t.label.trim() || t.path.trim()),
    };
  }

  return (
    <Modal onClose={onClose} size="xl">
      <ModalHeader
        title={widget ? "Widget bearbeiten" : "Widget hinzufügen"}
        subtitle={widget ? widget.label : "Neues Widget"}
        onClose={onClose}
      />
      <form
        onSubmit={handleSubmit((data) => onSubmit({ ...data, settings: buildSettings() }))}
        className="modal-form-shell"
      >
        <ModalBody>
          <div className="form-stack">
            <div className="admin-field">
              <label className="admin-label">Widget-Typ</label>
              <div className="widget-kind-grid">
                {WIDGET_KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setValue("kind", k.value)}
                    className={`widget-kind-card ${currentKind === k.value ? "widget-kind-card-active" : ""}`}
                    style={currentKind === k.value ? { borderColor: WIDGET_KIND_COLOR[k.value] } : {}}
                  >
                    <span style={{ color: currentKind === k.value ? WIDGET_KIND_COLOR[k.value] : "var(--dim)" }}>{k.icon}</span>
                    <span className="text-[12px] font-semibold text-[var(--fg)]">{k.label}</span>
                    <span className="font-mono text-[9px] text-[var(--dim)] text-center">{k.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-grid-2">
              <div className="admin-field">
                <label className="admin-label">Anzeige-Name</label>
                <input {...register("label")} className="admin-input" placeholder="Mein Server" />
                {errors.label && <span className="field-error">{errors.label.message}</span>}
              </div>
              <div className="admin-field">
                <label className="admin-label">Refresh (Sekunden)</label>
                <input {...register("refreshSec", { valueAsNumber: true })} type="number" min={5} max={3600} className="admin-input" />
              </div>
            </div>

            <div className="admin-field">
              <label className="admin-label">Link-URL (bei Klick auf das Widget)</label>
              <input {...register("linkUrl")} className="admin-input" placeholder="https://my-service.example.com" />
              <span className="admin-hint">Leer lassen = kein Klick-Link. Größe + Position per Drag &amp; Drop im Dashboard-Edit-Mode.</span>
            </div>

            <label className="checkbox-row">
              <input type="checkbox" {...register("enabled")} />
              <span>Widget aktiviert</span>
            </label>

            {/* ── Integration-Instanz-Selector (Portainer, Pi-hole, Speedtest, Frigate, Glances, Unraid) ── */}
            {MULTI_INSTANCE_KINDS.includes(currentKind) && (() => {
              const opts: { id: string; label: string }[] = (() => {
                if (!integrations) return [];
                if (currentKind === "portainer") return integrations.portainer.map((i) => ({ id: i.id, label: i.label }));
                if (currentKind === "pihole")    return integrations.pihole.map((i) => ({ id: i.id, label: i.label }));
                if (currentKind === "speedtest") return integrations.speedtest.map((i) => ({ id: i.id, label: i.label }));
                if (currentKind === "frigate")   return integrations.frigate.map((i) => ({ id: i.id, label: i.label }));
                if (currentKind === "glances")   return integrations.glances.map((i) => ({ id: i.id, label: i.label }));
                if (currentKind === "unraid")    return integrations.unraid.map((i) => ({ id: i.id, label: i.label }));
                if (currentKind === "esphome")   return integrations.esphome.map((i) => ({ id: i.id, label: i.label }));
                return [];
              })();
              if (opts.length === 0) return (
                <div className="admin-hint" style={{ padding: 10, background: "color-mix(in srgb, var(--status-warn) 8%, transparent)", borderRadius: "var(--radius-sm)" }}>
                  ⚠ Keine {currentKind}-Integration konfiguriert — zuerst unter <strong>Admin → Integrationen</strong> anlegen.
                </div>
              );
              return (
                <div className="admin-field">
                  <label className="admin-label">Instanzen</label>
                  <div className="flex flex-col gap-[6px] mt-[4px]">
                    {opts.map((o) => {
                      const checked = integrationIds.includes(o.id);
                      return (
                        <label key={o.id} className="flex items-center gap-[8px] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="accent-[var(--brand)] w-[14px] h-[14px] cursor-pointer"
                            checked={checked}
                            onChange={() =>
                              setIntegrationIds((prev) =>
                                checked ? prev.filter((id) => id !== o.id) : [...prev, o.id],
                              )
                            }
                          />
                          <span className="text-[13px] text-[var(--fg)]">{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <span className="admin-hint">
                    {integrationIds.length === 0 ? "Keine Auswahl = alle Instanzen werden angezeigt." : `${integrationIds.length} von ${opts.length} ausgewählt.`}
                  </span>
                </div>
              );
            })()}

            {currentKind === "esphome" && (
              <>
                <div className="widget-divider" />
                <div className="admin-field">
                  <label className="admin-label">ESPHome-Datenquelle</label>
                  <select
                    value={esphomeMode}
                    onChange={(e) => setEsphomeMode(e.target.value as "auto" | "direct" | "ha")}
                    className="admin-input"
                    title="ESPHome-Datenquelle"
                  >
                    <option value="auto">Automatisch: Direct bevorzugen, sonst HA-Group</option>
                    <option value="direct">Direct: konfigurierte ESPHome-Geräte</option>
                    <option value="ha">Home Assistant: HA-Group-Entity</option>
                  </select>
                  <span className="admin-hint">
                    Direct zeigt genau die ausgewählten ESPHome-Instanzen. HA nutzt die Group-Entity aus der Home-Assistant-Integration.
                  </span>
                </div>
              </>
            )}

            {/* ── Custom REST extra config ───────────────────────────────── */}
            {currentKind === "customRest" && (
              <>
                <div className="widget-divider" />
                <div className="text-[11px] font-semibold text-[var(--fg)] uppercase tracking-wide">Custom REST Konfiguration</div>

                <div className="admin-grid-2">
                  <div className="admin-field">
                    <label className="admin-label">URL *</label>
                    <input
                      value={crestUrl}
                      onChange={(e) => setCrestUrl(e.target.value)}
                      className="admin-input"
                      placeholder="http://192.168.1.100:8080/api/v1/data"
                    />
                    <span className="admin-hint">HTTP/HTTPS — private IPs sind erlaubt (Homelab-Standard).</span>
                  </div>
                  <div className="admin-field">
                    <label className="admin-label">Methode</label>
                    <select value={crestMethod} onChange={(e) => setCrestMethod(e.target.value as "GET" | "POST")} className="admin-input" title="HTTP-Methode">
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                </div>

                <div className="admin-field">
                  <label className="admin-label">Darstellung</label>
                  <select value={crestDisplayMode} onChange={(e) => setCrestDisplayMode(e.target.value as "tiles" | "single" | "raw")} className="admin-input" title="Darstellungsmodus">
                    <option value="tiles">Tiles (JSONPath-Extraktion, 2-Spalten-Grid)</option>
                    <option value="single">Single Value (gesamte Antwort als Text)</option>
                    <option value="raw">Raw JSON (Scroll-Box)</option>
                  </select>
                </div>

                <div className="admin-field">
                  <label className="admin-label">HTTP-Header (optional)</label>
                  <div className="flex flex-col gap-[6px]">
                    {crestHeaders.map((h, i) => (
                      <div key={i} className="admin-grid-2" style={{ gap: 6 }}>
                        <input
                          value={h.key}
                          onChange={(e) => { const n = [...crestHeaders]; n[i] = { key: e.target.value, value: h.value }; setCrestHeaders(n); }}
                          className="admin-input"
                          placeholder="Authorization"
                        />
                        <div className="flex gap-[6px]">
                          <input
                            value={h.value}
                            onChange={(e) => { const n = [...crestHeaders]; n[i] = { key: h.key, value: e.target.value }; setCrestHeaders(n); }}
                            className="admin-input"
                            placeholder="Bearer token123"
                          />
                          <button type="button" title="Header entfernen" className="icon-btn icon-btn-danger flex-shrink-0" onClick={() => setCrestHeaders(crestHeaders.filter((_, j) => j !== i))}>
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="crest-tile-add" onClick={() => setCrestHeaders([...crestHeaders, { key: "", value: "" }])}>
                      <Plus size={12} /> Header hinzufügen
                    </button>
                  </div>
                </div>

                {crestMethod === "POST" && (
                  <div className="admin-field">
                    <label className="admin-label">Request Body (JSON)</label>
                    <textarea
                      value={crestBody}
                      onChange={(e) => setCrestBody(e.target.value)}
                      className="admin-input"
                      rows={3}
                      placeholder='{"query": "temperature"}'
                      style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11 }}
                    />
                  </div>
                )}

                {crestDisplayMode === "tiles" && (
                  <div className="admin-field">
                    <label className="admin-label">Tiles (JSONPath-Extraktion)</label>
                    <div className="crest-header-row">
                      <span className="admin-hint" style={{ margin: 0 }}>Label</span>
                      <span className="admin-hint" style={{ margin: 0 }}>JSONPath (z.B. $.data.temp)</span>
                      <span className="admin-hint" style={{ margin: 0 }}>Einheit</span>
                      <span />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      {crestTiles.map((t, i) => (
                        <div key={i} className="crest-tile-row">
                          <input
                            value={t.label}
                            onChange={(e) => { const n = [...crestTiles]; n[i] = { label: e.target.value, path: t.path, unit: t.unit }; setCrestTiles(n); }}
                            className="admin-input"
                            placeholder="Temperatur"
                          />
                          <input
                            value={t.path}
                            onChange={(e) => { const n = [...crestTiles]; n[i] = { label: t.label, path: e.target.value, unit: t.unit }; setCrestTiles(n); }}
                            className="admin-input"
                            placeholder="$.data.temperature"
                          />
                          <input
                            value={t.unit}
                            onChange={(e) => { const n = [...crestTiles]; n[i] = { label: t.label, path: t.path, unit: e.target.value }; setCrestTiles(n); }}
                            className="admin-input"
                            placeholder="°C"
                          />
                          <button type="button" title="Tile entfernen" className="icon-btn icon-btn-danger" onClick={() => setCrestTiles(crestTiles.filter((_, j) => j !== i))}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button type="button" className="crest-tile-add" onClick={() => setCrestTiles([...crestTiles, { label: "", path: "$.", unit: "" }])}>
                        <Plus size={12} /> Tile hinzufügen
                      </button>
                    </div>
                    <span className="admin-hint">JSONPath-Syntax: <code>$.key</code>, <code>$.a.b.c</code>, <code>$.arr[0].name</code></span>
                  </div>
                )}
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-ghost">Abbrechen</button>
          <button type="submit" disabled={isPending} className="btn-primary">
            <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
