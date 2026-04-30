"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Save, Search, ChevronDown, ChevronUp, Check, Server, Home, Shield, Network, Gauge, Box, Activity, Zap, ShieldCheck, X, Sun, Radio, Video, Eye, Code, Cpu } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { APP_CATALOG, CATEGORY_LABELS, type AppCatalogEntry } from "@/lib/app-catalog";
import type { Config } from "@/server/config/schema";

/* ── Schemas ─────────────────────────────────────────────────────────────── */
const UnraidSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Name erforderlich"),
  connectionType: z.enum(["socket", "remote"]).default("socket"),
  remoteUrl: z.string().optional(),
  apiKey: z.string().min(1, "API-Key erforderlich"),
}).superRefine((data, ctx) => {
  if (data.connectionType === "remote") {
    const url = (data.remoteUrl ?? "").trim();
    if (!url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remoteUrl"], message: "URL erforderlich" });
    } else if (!/^https?:\/\/.+/.test(url)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remoteUrl"], message: "Erwartet: http://… oder https://…" });
    }
  }
});

const HaSchema = z.object({
  baseUrl: z.string().optional(),
  token: z.string().optional(),
  esphomeGroupEntity: z.string().optional(),
  zigbee2mqttGroupEntity: z.string().optional(),
});

const AdguardSchema = z.object({
  baseUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

const UnifiSchema = z.object({
  controllerUrl: z.string().optional(),
  apiKey: z.string().optional(),
  siteId: z.string().default("default"),
  verifyTls: z.boolean().default(false),
});

const GlancesHostSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Name erforderlich"),
  baseUrl: z.string().url("Gültige URL erforderlich"),
  username: z.string().optional(),
  password: z.string().optional(),
  verifyTls: z.boolean().default(false),
});

const PortainerInstanceSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Name erforderlich"),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  endpointId: z.coerce.number().int().default(1),
  verifyTls: z.boolean().default(false),
});

const UptimeKumaSchema = z.object({
  baseUrl: z.string().optional(),
  statusPageSlug: z.string().optional(),
});

const PiholeInstanceSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Name erforderlich"),
  baseUrl: z.string().optional(),
  apiToken: z.string().optional(),
});

const SpeedtestInstanceSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Name erforderlich"),
  baseUrl: z.string().optional(),
  bearerToken: z.string().optional(),
});

const WeatherSchema = z.object({
  enabled: z.boolean().default(false),
  latitude: z.coerce.number().min(-90).max(90).default(0),
  longitude: z.coerce.number().min(-180).max(180).default(0),
  locationName: z.string().default(""),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  refreshIntervalMin: z.coerce.number().int().min(5).max(360).default(15),
});

const Z2mSchema = z.object({
  enabled: z.boolean().default(false),
  source: z.enum(["auto", "ha", "mqtt"]).default("auto"),
  haGroupEntity: z.string().optional(),
  mqttUrl: z.string().optional(),
  mqttUsername: z.string().optional(),
  mqttPassword: z.string().optional(),
  mqttTopicPrefix: z.string().default("zigbee2mqtt"),
});

const FrigateInstanceSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Name erforderlich"),
  baseUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  authMode: z.enum(["none", "jwt"]).default("none"),
});

const UnifiProtectSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  verifyTls: z.boolean().default(false),
});

const CustomRestSchema = z.object({
  allowPrivateNetworks: z.boolean().default(true),
  allowedHosts: z.string().default(""), // comma-separated, will be split on save
});

const EsphomeInstanceSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Name erforderlich"),
  baseUrl: z.string().min(1, "URL erforderlich"),
  password: z.string().optional(),
  enabled: z.boolean().default(true),
});

type UnraidForm = z.infer<typeof UnraidSchema>;
type HaForm = z.infer<typeof HaSchema>;
type AdguardForm = z.infer<typeof AdguardSchema>;
type UnifiForm = z.infer<typeof UnifiSchema>;
type GlancesHostForm = z.infer<typeof GlancesHostSchema>;
type PortainerInstanceForm = z.infer<typeof PortainerInstanceSchema>;
type UptimeKumaForm = z.infer<typeof UptimeKumaSchema>;
type PiholeInstanceForm = z.infer<typeof PiholeInstanceSchema>;
type SpeedtestInstanceForm = z.infer<typeof SpeedtestInstanceSchema>;
type WeatherForm = z.infer<typeof WeatherSchema>;
type Z2mForm = z.infer<typeof Z2mSchema>;
type FrigateInstanceForm = z.infer<typeof FrigateInstanceSchema>;
type UnifiProtectForm = z.infer<typeof UnifiProtectSchema>;
type CustomRestForm = z.infer<typeof CustomRestSchema>;
type EsphomeInstanceForm = z.infer<typeof EsphomeInstanceSchema>;

/* ── App-Icon (logo or lucide fallback) ──────────────────────────────────── */
const LUCIDE_FALLBACK: Record<AppCatalogEntry["configKind"], React.ReactNode> = {
  unraid: <Server size={22} />,
  homeassistant: <Home size={22} />,
  adguard: <Shield size={22} />,
  unifi: <Network size={22} />,
  glances: <Gauge size={22} />,
  portainer: <Box size={22} />,
  uptimekuma: <Activity size={22} />,
  pihole: <ShieldCheck size={22} />,
  speedtest: <Zap size={22} />,
  weather: <Sun size={22} />,
  zigbee2mqtt: <Radio size={22} />,
  frigate: <Eye size={22} />,
  unifiprotect: <Video size={22} />,
  customrest: <Code size={22} />,
  esphome: <Cpu size={22} />,
};

function AppIcon({ app, size = 36 }: { app: AppCatalogEntry; size?: number }) {
  return (
    <div className="int-app-logo-wrap" data-size={size > 36 ? "lg" : "sm"}>
      <img
        src={app.iconUrl}
        alt={app.name}
        width={size}
        height={size}
        className="int-app-logo-img"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
          (e.currentTarget.nextSibling as HTMLElement | null)?.removeAttribute("hidden");
        }}
      />
      <span hidden className="int-app-logo-fallback">
        {LUCIDE_FALLBACK[app.configKind]}
      </span>
    </div>
  );
}

/* ── Configured count helper ─────────────────────────────────────────────── */
type IntegrationsData = Config["integrations"];

function getConfiguredCount(kind: AppCatalogEntry["configKind"], integrations: IntegrationsData | undefined): number {
  if (!integrations) return 0;
  switch (kind) {
    case "unraid": return integrations.unraid?.length ?? 0;
    case "glances": return integrations.glances?.length ?? 0;
    case "homeassistant": return integrations.homeAssistant?.baseUrl ? 1 : 0;
    case "adguard": return integrations.adguard?.baseUrl ? 1 : 0;
    case "unifi": return integrations.unifi?.controllerUrl ? 1 : 0;
    case "portainer": return integrations.portainer?.length ?? 0;
    case "uptimekuma": return integrations.uptimeKuma?.baseUrl ? 1 : 0;
    case "pihole": return integrations.pihole?.length ?? 0;
    case "speedtest": return integrations.speedtest?.length ?? 0;
    case "weather": return integrations.weather?.enabled ? 1 : 0;
    case "zigbee2mqtt": return integrations.zigbee2mqtt?.enabled ? 1 : 0;
    case "frigate": return integrations.frigate?.length ?? 0;
    case "unifiprotect": return integrations.unifiProtect?.enabled ? 1 : 0;
    case "customrest": return integrations.customRest?.allowedHosts && integrations.customRest.allowedHosts.length > 0 ? 1 : 0;
    case "esphome": return integrations.esphome?.length ?? 0;
  }
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function AdminIntegrationsPage() {
  const { data: integrations } = trpc.integrations.get.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [configuredOpen, setConfiguredOpen] = useState(true);
  const [activeModal, setActiveModal] = useState<AppCatalogEntry["configKind"] | null>(null);
  const [editingUnraidEntry, setEditingUnraidEntry] = useState<UnraidForm | null | "new">(null);
  const [editingGlancesEntry, setEditingGlancesEntry] = useState<GlancesHostForm | null | "new">(null);
  const [editingPortainerEntry, setEditingPortainerEntry] = useState<PortainerInstanceForm | null | "new">(null);
  const [editingPiholeEntry, setEditingPiholeEntry] = useState<PiholeInstanceForm | null | "new">(null);
  const [editingSpeedtestEntry, setEditingSpeedtestEntry] = useState<SpeedtestInstanceForm | null | "new">(null);
  const [editingFrigateEntry, setEditingFrigateEntry] = useState<FrigateInstanceForm | null | "new">(null);
  const [editingEsphomeEntry, setEditingEsphomeEntry] = useState<EsphomeInstanceForm | null | "new">(null);

  const onErr = (e: { message?: string }) => toast.error("Speichern fehlgeschlagen", e?.message);

  const upsertUnraid = trpc.integrations.upsertUnraid.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setEditingUnraidEntry(null); toast.success("Unraid-Integration gespeichert"); },
    onError: onErr,
  });
  const deleteUnraid = trpc.integrations.deleteUnraid.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); toast.success("Unraid-Integration gelöscht"); },
    onError: onErr,
  });
  const updateHa = trpc.integrations.updateHomeAssistant.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setActiveModal(null); toast.success("Home Assistant gespeichert"); },
    onError: onErr,
  });
  const updateAdguard = trpc.integrations.updateAdguard.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setActiveModal(null); toast.success("AdGuard gespeichert"); },
    onError: onErr,
  });
  const updateUnifi = trpc.integrations.updateUnifi.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setActiveModal(null); toast.success("UniFi gespeichert"); },
    onError: onErr,
  });
  const upsertGlances = trpc.integrations.upsertGlances.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setEditingGlancesEntry(null); toast.success("Glances-Host gespeichert"); },
    onError: onErr,
  });
  const deleteGlances = trpc.integrations.deleteGlances.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); toast.success("Glances-Host gelöscht"); },
    onError: onErr,
  });
  const upsertPortainer = trpc.integrations.upsertPortainer.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setEditingPortainerEntry(null); toast.success("Portainer gespeichert"); },
    onError: onErr,
  });
  const deletePortainer = trpc.integrations.deletePortainer.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); toast.success("Portainer gelöscht"); },
    onError: onErr,
  });
  const updateUptimeKuma = trpc.integrations.updateUptimeKuma.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setActiveModal(null); toast.success("Uptime Kuma gespeichert"); },
    onError: onErr,
  });
  const upsertPihole = trpc.integrations.upsertPihole.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setEditingPiholeEntry(null); toast.success("Pi-hole gespeichert"); },
    onError: onErr,
  });
  const deletePihole = trpc.integrations.deletePihole.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); toast.success("Pi-hole gelöscht"); },
    onError: onErr,
  });
  const upsertSpeedtest = trpc.integrations.upsertSpeedtest.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setEditingSpeedtestEntry(null); toast.success("Speedtest gespeichert"); },
    onError: onErr,
  });
  const deleteSpeedtest = trpc.integrations.deleteSpeedtest.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); toast.success("Speedtest gelöscht"); },
    onError: onErr,
  });
  const updateWeather = trpc.integrations.updateWeather.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setActiveModal(null); toast.success("Wetter gespeichert"); },
    onError: onErr,
  });
  const updateZ2m = trpc.integrations.updateZigbee2mqtt.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setActiveModal(null); toast.success("Zigbee2MQTT gespeichert"); },
    onError: onErr,
  });
  const upsertFrigate = trpc.integrations.upsertFrigate.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setEditingFrigateEntry(null); toast.success("Frigate gespeichert"); },
    onError: onErr,
  });
  const deleteFrigate = trpc.integrations.deleteFrigate.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); toast.success("Frigate gelöscht"); },
    onError: onErr,
  });
  const updateUnifiProtect = trpc.integrations.updateUnifiProtect.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setActiveModal(null); toast.success("UniFi Protect gespeichert"); },
    onError: onErr,
  });
  const updateCustomRest = trpc.integrations.updateCustomRest.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setActiveModal(null); toast.success("Custom REST gespeichert"); },
    onError: onErr,
  });
  const upsertEsphome = trpc.integrations.upsertEsphome.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); setEditingEsphomeEntry(null); toast.success("ESPHome-Gerät gespeichert"); },
    onError: onErr,
  });
  const deleteEsphome = trpc.integrations.deleteEsphome.useMutation({
    onSuccess: () => { utils.integrations.get.invalidate(); toast.success("ESPHome-Gerät gelöscht"); },
    onError: onErr,
  });

  const configuredApps = useMemo(
    () => APP_CATALOG.filter((a) => getConfiguredCount(a.configKind, integrations) > 0),
    [integrations]
  );

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return APP_CATALOG;
    return APP_CATALOG.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        CATEGORY_LABELS[a.category].toLowerCase().includes(q)
    );
  }, [search]);

  const openModal = (kind: AppCatalogEntry["configKind"]) => {
    setActiveModal(kind);
  };

  return (
    <div className="flex flex-col gap-[28px]">

      {/* ── Konfigurierte Integrationen ─────────────────────────────────── */}
      {configuredApps.length > 0 && (
        <div className="admin-card">
          <button
            type="button"
            className="int-collapse-header"
            onClick={() => setConfiguredOpen((v) => !v)}
          >
            <span className="int-collapse-title">
              <Check size={15} className="int-collapse-check" />
              Konfigurierte Integrationen
              <span className="int-collapse-badge">{configuredApps.length}</span>
            </span>
            {configuredOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {configuredOpen && (
            <div className="int-configured-list">
              {configuredApps.map((app) => {
                const count = getConfiguredCount(app.configKind, integrations);
                return (
                  <div key={app.id} className="int-configured-row">
                    <AppIcon app={app} size={28} />
                    <div className="int-configured-info">
                      <span className="int-configured-name">{app.name}</span>
                      <span className="int-configured-cat">{CATEGORY_LABELS[app.category]}</span>
                    </div>
                    {app.multi && (
                      <span className="int-configured-count">{count}x</span>
                    )}
                    <button
                      type="button"
                      className="btn-ghost int-configured-edit"
                      onClick={() => openModal(app.configKind)}
                    >
                      <Pencil size={13} />
                      Bearbeiten
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Suchfeld ─────────────────────────────────────────────────────── */}
      <div className="int-search-wrap">
        <Search size={15} className="int-search-icon" />
        <input
          className="int-search-input"
          placeholder="Integration suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button type="button" className="int-search-clear" title="Suche leeren" onClick={() => setSearch("")}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── App-Grid ─────────────────────────────────────────────────────── */}
      {filteredCatalog.length === 0 ? (
        <div className="int-empty">Keine Integrationen gefunden für „{search}"</div>
      ) : (
        <div className="int-app-grid">
          {filteredCatalog.map((app) => {
            const count = getConfiguredCount(app.configKind, integrations);
            const isConfigured = count > 0;
            return (
              <button
                key={app.id}
                type="button"
                className={`int-app-card ${isConfigured ? "int-app-card-active" : ""}`}
                onClick={() => openModal(app.configKind)}
              >
                <div className="int-app-card-icon-wrap">
                  <AppIcon app={app} size={44} />
                  {isConfigured && (
                    <span className="int-app-card-check">
                      <Check size={9} />
                    </span>
                  )}
                </div>
                <div className="int-app-card-body">
                  <div className="int-app-card-name">{app.name}</div>
                  <div className="int-app-card-cat">{CATEGORY_LABELS[app.category]}</div>
                  <div className="int-app-card-desc">{app.description}</div>
                </div>
                {app.multi && isConfigured && (
                  <span className="int-app-card-multi">{count} Instanz{count !== 1 ? "en" : ""}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}

      {/* Unraid — multi-instance list modal */}
      {(editingUnraidEntry !== null || activeModal === "unraid") && (
        editingUnraidEntry ? (
          <UnraidEntryModal
            initial={editingUnraidEntry === "new" ? undefined : editingUnraidEntry}
            onClose={() => setEditingUnraidEntry(null)}
            onSubmit={(data) => {
              const endpoint = data.connectionType === "socket" ? "socket" : (data.remoteUrl ?? "").trim();
              upsertUnraid.mutate({
                ...(data.id ? { id: data.id } : {}),
                label: data.label,
                endpoint,
                apiKey: data.apiKey,
              });
            }}
            isPending={upsertUnraid.isPending}
          />
        ) : (
          <UnraidListModal
            integrations={integrations}
            onClose={() => setActiveModal(null)}
            onAdd={() => { setActiveModal(null); setEditingUnraidEntry("new"); }}
            onEdit={(entry) => { setActiveModal(null); setEditingUnraidEntry(entry); }}
            onDelete={(id, label) => { if (confirm(`"${label}" wirklich löschen?`)) deleteUnraid.mutate({ id }); }}
          />
        )
      )}

      {/* Glances — multi-instance list modal */}
      {(editingGlancesEntry !== null || activeModal === "glances") && (
        editingGlancesEntry ? (
          <GlancesEntryModal
            initial={editingGlancesEntry === "new" ? undefined : editingGlancesEntry}
            onClose={() => setEditingGlancesEntry(null)}
            onSubmit={(data) => upsertGlances.mutate(data)}
            isPending={upsertGlances.isPending}
          />
        ) : (
          <GlancesListModal
            integrations={integrations}
            onClose={() => setActiveModal(null)}
            onAdd={() => { setActiveModal(null); setEditingGlancesEntry("new"); }}
            onEdit={(entry) => { setActiveModal(null); setEditingGlancesEntry(entry); }}
            onDelete={(id, label) => { if (confirm(`"${label}" wirklich löschen?`)) deleteGlances.mutate({ id }); }}
          />
        )
      )}

      {/* Single-instance modals */}
      {activeModal === "homeassistant" && (
        <SingleModal title="Home Assistant" subtitle="Long-Lived Access Token" onClose={() => setActiveModal(null)}>
          <HaFormInner
            initial={integrations?.homeAssistant ?? undefined}
            onSubmit={(d) => updateHa.mutate(d)}
            isPending={updateHa.isPending}
            onClose={() => setActiveModal(null)}
          />
        </SingleModal>
      )}

      {activeModal === "adguard" && (
        <SingleModal title="AdGuard Home" subtitle="DNS-Filter Statistiken" onClose={() => setActiveModal(null)}>
          <AdguardFormInner
            initial={integrations?.adguard ?? undefined}
            onSubmit={(d) => updateAdguard.mutate(d)}
            isPending={updateAdguard.isPending}
            onClose={() => setActiveModal(null)}
          />
        </SingleModal>
      )}

      {activeModal === "unifi" && (
        <SingleModal title="UniFi Controller" subtitle="Netzwerk-Statistiken" onClose={() => setActiveModal(null)}>
          <UnifiFormInner
            initial={integrations?.unifi ?? undefined}
            onSubmit={(d) => updateUnifi.mutate(d)}
            isPending={updateUnifi.isPending}
            onClose={() => setActiveModal(null)}
          />
        </SingleModal>
      )}

      {(editingPortainerEntry !== null || activeModal === "portainer") && (
        editingPortainerEntry ? (
          <SimpleInstanceEntryModal
            title="Portainer-Instanz"
            schema={PortainerInstanceSchema}
            initial={editingPortainerEntry === "new" ? undefined : editingPortainerEntry}
            onClose={() => setEditingPortainerEntry(null)}
            onSubmit={(d) => upsertPortainer.mutate(d as PortainerInstanceForm)}
            isPending={upsertPortainer.isPending}
            fields={[
              { name: "label", label: "Name", placeholder: "Portainer Prod" },
              { name: "baseUrl", label: "Base URL", placeholder: "https://portainer.example.com" },
              { name: "apiKey", label: "API Key", placeholder: "ptr_…", type: "password" },
              { name: "endpointId", label: "Endpoint ID", placeholder: "1", type: "number" },
            ]}
          />
        ) : (
          <SimpleInstanceListModal
            title="Portainer"
            subtitle="Docker-Container-Management"
            items={(integrations?.portainer ?? []).map((p) => ({ id: p.id, label: p.label, sub: p.baseUrl ?? "" }))}
            onClose={() => setActiveModal(null)}
            onAdd={() => { setActiveModal(null); setEditingPortainerEntry("new"); }}
            onEdit={(id) => { const e = integrations?.portainer.find((p) => p.id === id); if (e) { setActiveModal(null); setEditingPortainerEntry({ id: e.id, label: e.label, baseUrl: e.baseUrl ?? "", apiKey: e.apiKey ?? "", endpointId: e.endpointId, verifyTls: e.verifyTls }); } }}
            onDelete={(id, label) => { if (confirm(`"${label}" wirklich löschen?`)) deletePortainer.mutate({ id }); }}
          />
        )
      )}

      {activeModal === "uptimekuma" && (
        <SingleModal title="Uptime Kuma" subtitle="Service-Uptime via Status-Page" onClose={() => setActiveModal(null)}>
          <UptimeKumaFormInner
            initial={integrations?.uptimeKuma ?? undefined}
            onSubmit={(d) => updateUptimeKuma.mutate(d)}
            isPending={updateUptimeKuma.isPending}
            onClose={() => setActiveModal(null)}
          />
        </SingleModal>
      )}

      {(editingPiholeEntry !== null || activeModal === "pihole") && (
        editingPiholeEntry ? (
          <SimpleInstanceEntryModal
            title="Pi-hole-Instanz"
            schema={PiholeInstanceSchema}
            initial={editingPiholeEntry === "new" ? undefined : editingPiholeEntry}
            onClose={() => setEditingPiholeEntry(null)}
            onSubmit={(d) => upsertPihole.mutate(d as PiholeInstanceForm)}
            isPending={upsertPihole.isPending}
            fields={[
              { name: "label", label: "Name", placeholder: "Pi-hole Home" },
              { name: "baseUrl", label: "Base URL", placeholder: "http://192.168.1.100/admin" },
              { name: "apiToken", label: "API Token", placeholder: "…", type: "password" },
            ]}
          />
        ) : (
          <SimpleInstanceListModal
            title="Pi-hole"
            subtitle="DNS-Filter Statistiken"
            items={(integrations?.pihole ?? []).map((p) => ({ id: p.id, label: p.label, sub: p.baseUrl ?? "" }))}
            onClose={() => setActiveModal(null)}
            onAdd={() => { setActiveModal(null); setEditingPiholeEntry("new"); }}
            onEdit={(id) => { const e = integrations?.pihole.find((p) => p.id === id); if (e) { setActiveModal(null); setEditingPiholeEntry({ id: e.id, label: e.label, baseUrl: e.baseUrl ?? "", apiToken: e.apiToken ?? "" }); } }}
            onDelete={(id, label) => { if (confirm(`"${label}" wirklich löschen?`)) deletePihole.mutate({ id }); }}
          />
        )
      )}

      {(editingSpeedtestEntry !== null || activeModal === "speedtest") && (
        editingSpeedtestEntry ? (
          <SimpleInstanceEntryModal
            title="Speedtest-Instanz"
            schema={SpeedtestInstanceSchema}
            initial={editingSpeedtestEntry === "new" ? undefined : editingSpeedtestEntry}
            onClose={() => setEditingSpeedtestEntry(null)}
            onSubmit={(d) => upsertSpeedtest.mutate(d as SpeedtestInstanceForm)}
            isPending={upsertSpeedtest.isPending}
            fields={[
              { name: "label", label: "Name", placeholder: "Speedtest Tracker" },
              { name: "baseUrl", label: "Base URL", placeholder: "http://192.168.1.100:8765" },
              { name: "bearerToken", label: "Bearer Token", placeholder: "…", type: "password" },
            ]}
          />
        ) : (
          <SimpleInstanceListModal
            title="Speedtest Tracker"
            subtitle="Internet-Speed-History"
            items={(integrations?.speedtest ?? []).map((s) => ({ id: s.id, label: s.label, sub: s.baseUrl ?? "" }))}
            onClose={() => setActiveModal(null)}
            onAdd={() => { setActiveModal(null); setEditingSpeedtestEntry("new"); }}
            onEdit={(id) => { const e = integrations?.speedtest.find((s) => s.id === id); if (e) { setActiveModal(null); setEditingSpeedtestEntry({ id: e.id, label: e.label, baseUrl: e.baseUrl ?? "", bearerToken: e.bearerToken ?? "" }); } }}
            onDelete={(id, label) => { if (confirm(`"${label}" wirklich löschen?`)) deleteSpeedtest.mutate({ id }); }}
          />
        )
      )}

      {activeModal === "weather" && (
        <SingleModal title="Wetter (Open-Meteo)" subtitle="Aktuelle Wetterdaten + 7-Tage-Forecast" onClose={() => setActiveModal(null)}>
          <WeatherFormInner
            initial={integrations?.weather}
            onSubmit={(d) => updateWeather.mutate(d)}
            isPending={updateWeather.isPending}
            onClose={() => setActiveModal(null)}
          />
        </SingleModal>
      )}

      {activeModal === "zigbee2mqtt" && (
        <SingleModal title="Zigbee2MQTT" subtitle="Z2M-Geräte via Home Assistant Group" onClose={() => setActiveModal(null)}>
          <Z2mFormInner
            initial={integrations?.zigbee2mqtt}
            onSubmit={(d) => updateZ2m.mutate(d)}
            isPending={updateZ2m.isPending}
            onClose={() => setActiveModal(null)}
          />
        </SingleModal>
      )}

      {(editingFrigateEntry !== null || activeModal === "frigate") && (
        editingFrigateEntry ? (
          <SimpleInstanceEntryModal
            title="Frigate-Instanz"
            schema={FrigateInstanceSchema}
            initial={editingFrigateEntry === "new" ? undefined : editingFrigateEntry}
            onClose={() => setEditingFrigateEntry(null)}
            onSubmit={(d) => upsertFrigate.mutate(d as FrigateInstanceForm)}
            isPending={upsertFrigate.isPending}
            fields={[
              { name: "label", label: "Name", placeholder: "Frigate NVR" },
              { name: "baseUrl", label: "Base URL", placeholder: "http://192.168.1.100:5000" },
              { name: "username", label: "Username (JWT)", placeholder: "admin" },
              { name: "password", label: "Passwort (JWT)", placeholder: "…", type: "password" },
            ]}
          />
        ) : (
          <SimpleInstanceListModal
            title="Frigate NVR"
            subtitle="Object-Detection Events"
            items={(integrations?.frigate ?? []).map((f) => ({ id: f.id, label: f.label, sub: f.baseUrl ?? "" }))}
            onClose={() => setActiveModal(null)}
            onAdd={() => { setActiveModal(null); setEditingFrigateEntry("new"); }}
            onEdit={(id) => { const e = integrations?.frigate.find((f) => f.id === id); if (e) { setActiveModal(null); setEditingFrigateEntry({ id: e.id, label: e.label, baseUrl: e.baseUrl ?? "", username: e.username ?? "", password: e.password ?? "", authMode: e.authMode }); } }}
            onDelete={(id, label) => { if (confirm(`"${label}" wirklich löschen?`)) deleteFrigate.mutate({ id }); }}
          />
        )
      )}

      {activeModal === "unifiprotect" && (
        <SingleModal title="UniFi Protect" subtitle="Kameras + Motion-Events" onClose={() => setActiveModal(null)}>
          <UnifiProtectFormInner
            initial={integrations?.unifiProtect}
            onSubmit={(d) => updateUnifiProtect.mutate(d)}
            isPending={updateUnifiProtect.isPending}
            onClose={() => setActiveModal(null)}
          />
        </SingleModal>
      )}

      {activeModal === "customrest" && (
        <SingleModal title="Custom REST" subtitle="Generischer JSON-Endpoint mit JSONPath" onClose={() => setActiveModal(null)}>
          <CustomRestFormInner
            initial={integrations?.customRest}
            onSubmit={(d) => updateCustomRest.mutate({
              allowPrivateNetworks: d.allowPrivateNetworks,
              allowedHosts: d.allowedHosts.split(",").map((h) => h.trim()).filter(Boolean),
            })}
            isPending={updateCustomRest.isPending}
            onClose={() => setActiveModal(null)}
          />
        </SingleModal>
      )}

      {(editingEsphomeEntry !== null || activeModal === "esphome") && (
        editingEsphomeEntry ? (
          <SimpleInstanceEntryModal
            title="ESPHome-Gerät"
            schema={EsphomeInstanceSchema}
            initial={editingEsphomeEntry === "new" ? undefined : editingEsphomeEntry}
            onClose={() => setEditingEsphomeEntry(null)}
            onSubmit={(d) => upsertEsphome.mutate(d as EsphomeInstanceForm)}
            isPending={upsertEsphome.isPending}
            fields={[
              { name: "label", label: "Name", placeholder: "Temperatur-Sensor Wohnzimmer" },
              { name: "baseUrl", label: "URL (http://ip-oder-hostname)", placeholder: "http://192.168.1.50" },
              { name: "password", label: "Passwort (optional)", placeholder: "••••••••", type: "password" },
            ]}
          />
        ) : (
          <SimpleInstanceListModal
            title="ESPHome"
            subtitle="Direkte REST-API · Sensoren & Gerätestatus"
            items={(integrations?.esphome ?? []).map((e) => ({ id: e.id, label: e.label, sub: e.baseUrl }))}
            onClose={() => setActiveModal(null)}
            onAdd={() => { setActiveModal(null); setEditingEsphomeEntry("new"); }}
            onEdit={(id) => {
              const e = integrations?.esphome.find((x) => x.id === id);
              if (e) { setActiveModal(null); setEditingEsphomeEntry({ id: e.id, label: e.label, baseUrl: e.baseUrl, password: e.password ?? "", enabled: e.enabled }); }
            }}
            onDelete={(id, label) => { if (confirm(`"${label}" wirklich löschen?`)) deleteEsphome.mutate({ id }); }}
          />
        )
      )}
    </div>
  );
}

/* ── Single Modal Wrapper ────────────────────────────────────────────────── */
function SingleModal({ title, subtitle, onClose, children }: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader title={title} subtitle={subtitle} onClose={onClose} />
      {children}
    </Modal>
  );
}

/* ── Unraid List Modal ───────────────────────────────────────────────────── */
function UnraidListModal({ integrations, onClose, onAdd, onEdit, onDelete }: {
  integrations: IntegrationsData | undefined;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (entry: UnraidForm) => void;
  onDelete: (id: string, label: string) => void;
}) {
  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader title="Unraid Instanzen" subtitle="Verbindungen zu Unraid-Servern" onClose={onClose} />
      <ModalBody>
        <div className="flex flex-col gap-[8px]">
          {(integrations?.unraid ?? []).length === 0 && (
            <div className="int-empty">Noch keine Unraid-Instanz konfiguriert</div>
          )}
          {(integrations?.unraid ?? []).map((u) => (
            <div key={u.id} className="svc-list-row">
              <Server size={14} style={{ color: "var(--brand)", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--fg)]">{u.label}</div>
                <div className="font-mono text-[10px] text-[var(--dim)] truncate">{u.endpoint}</div>
              </div>
              <span className="svc-cat-badge">unraid</span>
              <button
                type="button"
                className="icon-btn"
                title="Bearbeiten"
                onClick={() => {
                  const isSocket = u.endpoint === "socket"
                    || u.endpoint.startsWith("unix:")
                    || u.endpoint.startsWith("socket://")
                    || /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(u.endpoint);
                  onEdit({
                    id: u.id,
                    label: u.label,
                    connectionType: isSocket ? "socket" : "remote",
                    remoteUrl: isSocket ? "" : u.endpoint,
                    apiKey: u.apiKey,
                  });
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                title="Löschen"
                onClick={() => onDelete(u.id, u.label)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Schließen</button>
        <button type="button" className="btn-primary" onClick={onAdd}>
          <Plus size={14} />Hinzufügen
        </button>
      </ModalFooter>
    </Modal>
  );
}

/* ── Unraid Entry Modal ──────────────────────────────────────────────────── */
function UnraidEntryModal({ initial, onClose, onSubmit, isPending }: {
  initial: UnraidForm | undefined;
  onClose: () => void;
  onSubmit: (data: UnraidForm) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<UnraidForm>({
    resolver: zodResolver(UnraidSchema),
    defaultValues: initial ?? { label: "", connectionType: "socket", remoteUrl: "", apiKey: "" },
  });

  const connType = watch("connectionType");

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={initial?.id ? "Unraid-Instanz bearbeiten" : "Unraid-Instanz hinzufügen"}
        subtitle={initial?.label ?? "GraphQL-Endpoint + API-Key"}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
        <ModalBody>
          <div className="form-stack">
            <div className="admin-field">
              <label className="admin-label">Name</label>
              <input {...register("label")} className="admin-input" placeholder="ITSWEBER-CORE" />
              {errors.label && <span className="field-error">{errors.label.message}</span>}
            </div>

            <div className="admin-field">
              <label className="admin-label">Verbindung</label>
              <div className="conn-type-grid">
                <label className={`conn-type-card ${connType === "socket" ? "conn-type-card-active" : ""}`}>
                  <input type="radio" value="socket" {...register("connectionType")} />
                  <div className="conn-type-title">Lokaler Unix-Socket</div>
                  <div className="conn-type-desc">
                    Container läuft auf demselben Unraid-Host. Nutzt <code>/var/run/unraid-api.sock</code>.
                    <strong> Empfohlen für CORE.</strong>
                  </div>
                </label>
                <label className={`conn-type-card ${connType === "remote" ? "conn-type-card-active" : ""}`}>
                  <input type="radio" value="remote" {...register("connectionType")} />
                  <div className="conn-type-title">Remote-URL</div>
                  <div className="conn-type-desc">
                    Anderer Unraid-Host (z.B. NODE). Nutze die <strong>WebGUI-URL inkl. Port</strong>
                    {" "}— GraphQL ist dort automatisch verfügbar. Funktioniert ab Unraid 7.x.
                  </div>
                </label>
              </div>
            </div>

            {connType === "remote" && (
              <div className="admin-field">
                <label className="admin-label">Remote-URL</label>
                <input
                  {...register("remoteUrl")}
                  className="admin-input"
                  placeholder="http://192.168.1.101:1580   |   https://node.example.com"
                />
                <span className="admin-hint">
                  WebGUI-URL der Unraid-Instanz (mit Port). Container kann <strong>keine *.local-Hostnames</strong> auflösen — bitte IP oder echte Domain nutzen.
                  HTTPS-Zertifikate werden auch wenn selbst-signiert akzeptiert.
                </span>
                {errors.remoteUrl && <span className="field-error">{errors.remoteUrl.message}</span>}
              </div>
            )}

            <div className="admin-field">
              <label className="admin-label">API Key</label>
              <input {...register("apiKey")} className="admin-input font-mono" placeholder="••••••••••••••••" type="password" />
              {errors.apiKey && <span className="field-error">{errors.apiKey.message}</span>}
            </div>
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

/* ── Glances List Modal ──────────────────────────────────────────────────── */
function GlancesListModal({ integrations, onClose, onAdd, onEdit, onDelete }: {
  integrations: IntegrationsData | undefined;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (entry: GlancesHostForm) => void;
  onDelete: (id: string, label: string) => void;
}) {
  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader title="Glances Hosts" subtitle="Live CPU/RAM/Disk via Glances-API" onClose={onClose} />
      <ModalBody>
        <div className="flex flex-col gap-[8px]">
          {(integrations?.glances ?? []).length === 0 && (
            <div className="int-empty">
              Noch kein Glances-Host konfiguriert.
              <br />
              <span className="font-mono text-[10px]">Glances-Container z.B.: <code>nicolargo/glances:latest-full -w</code> auf Port 61208</span>
            </div>
          )}
          {(integrations?.glances ?? []).map((g) => (
            <div key={g.id} className="svc-list-row">
              <Gauge size={14} style={{ color: "var(--brand)", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--fg)]">{g.label}</div>
                <div className="font-mono text-[10px] text-[var(--dim)] truncate">{g.baseUrl}</div>
              </div>
              <span className="svc-cat-badge">glances</span>
              <button
                type="button"
                className="icon-btn"
                title="Bearbeiten"
                onClick={() => onEdit({ id: g.id, label: g.label, baseUrl: g.baseUrl, username: g.username ?? "", password: g.password ?? "", verifyTls: g.verifyTls })}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                title="Löschen"
                onClick={() => onDelete(g.id, g.label)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Schließen</button>
        <button type="button" className="btn-primary" onClick={onAdd}>
          <Plus size={14} />Hinzufügen
        </button>
      </ModalFooter>
    </Modal>
  );
}

/* ── Glances Entry Modal ─────────────────────────────────────────────────── */
function GlancesEntryModal({ initial, onClose, onSubmit, isPending }: {
  initial: GlancesHostForm | undefined;
  onClose: () => void;
  onSubmit: (data: GlancesHostForm) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<GlancesHostForm>({
    resolver: zodResolver(GlancesHostSchema),
    defaultValues: initial ?? { label: "", baseUrl: "", username: "", password: "", verifyTls: false },
  });

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={initial?.id ? "Glances-Host bearbeiten" : "Glances-Host hinzufügen"}
        subtitle="Live System-Stats"
        onClose={onClose}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
        <ModalBody>
          <div className="form-stack">
            <div className="admin-grid-2">
              <div className="admin-field">
                <label className="admin-label">Name</label>
                <input {...register("label")} className="admin-input" placeholder="ITSWEBER-Node" />
                {errors.label && <span className="field-error">{errors.label.message}</span>}
              </div>
              <div className="admin-field">
                <label className="admin-label">Base URL</label>
                <input {...register("baseUrl")} className="admin-input" placeholder="http://192.168.1.100:61208" />
                {errors.baseUrl && <span className="field-error">{errors.baseUrl.message}</span>}
              </div>
            </div>
            <div className="admin-grid-2">
              <div className="admin-field">
                <label className="admin-label">Benutzername (optional)</label>
                <input {...register("username")} className="admin-input" />
              </div>
              <div className="admin-field">
                <label className="admin-label">Passwort (optional)</label>
                <input {...register("password")} className="admin-input font-mono" type="password" />
              </div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" {...register("verifyTls")} />
              <span>TLS-Zertifikat prüfen</span>
            </label>
            <span className="admin-hint">
              Glances-Container starten: <code>docker run -d --name=glances --net=host --pid=host -e GLANCES_OPT=&quot;-w&quot; nicolargo/glances:latest-full</code>
              {" "}— Web-UI/API auf Port 61208.
            </span>
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

/* ── Inline Form Components ──────────────────────────────────────────────── */
function HaFormInner({ initial, onSubmit, isPending, onClose }: { initial: HaForm | undefined; onSubmit: (d: HaForm) => void; isPending: boolean; onClose: () => void }) {
  const { register, handleSubmit } = useForm<HaForm>({
    resolver: zodResolver(HaSchema),
    defaultValues: {
      baseUrl: initial?.baseUrl ?? "",
      token: initial?.token ?? "",
      esphomeGroupEntity: initial?.esphomeGroupEntity ?? "",
      zigbee2mqttGroupEntity: initial?.zigbee2mqttGroupEntity ?? "",
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
      <ModalBody>
        <div className="form-stack">
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Base URL</label>
              <input {...register("baseUrl")} className="admin-input" placeholder="https://home.example.com" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Long-Lived Token</label>
              <input {...register("token")} className="admin-input font-mono" type="password" placeholder="••••••••" />
            </div>
          </div>
          <details className="admin-collapse">
            <summary className="admin-collapse-summary">
              Legacy: HA-Group-Felder (nur für ESPHome HA-Mode + Z2M-MVP)
            </summary>
            <div className="admin-grid-2 admin-collapse-body">
              <div className="admin-field">
                <label className="admin-label">ESPHome HA-Group (Legacy)</label>
                <input {...register("esphomeGroupEntity")} className="admin-input font-mono" placeholder="group.esphome_devices" />
                <span className="admin-hint">
                  Nur für ESPHome-Widget im <strong>HA-Mode</strong>. Bei <strong>Direct-Mode</strong> (empfohlen) leer lassen.
                </span>
              </div>
              <div className="admin-field">
                <label className="admin-label">Z2M HA-Group</label>
                <input {...register("zigbee2mqttGroupEntity")} className="admin-input font-mono" placeholder="group.zigbee_devices" />
                <span className="admin-hint">
                  Lege in HA per <em>Settings → Devices &amp; Services → Helpers → Group</em> eine Gruppe mit deinen Zigbee-Sensoren an und trage die Entity-ID hier ein.
                </span>
              </div>
            </div>
          </details>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
        </button>
      </ModalFooter>
    </form>
  );
}

function AdguardFormInner({ initial, onSubmit, isPending, onClose }: { initial: AdguardForm | undefined; onSubmit: (d: AdguardForm) => void; isPending: boolean; onClose: () => void }) {
  const { register, handleSubmit } = useForm<AdguardForm>({
    resolver: zodResolver(AdguardSchema),
    defaultValues: { baseUrl: initial?.baseUrl ?? "", username: initial?.username ?? "", password: initial?.password ?? "" },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
      <ModalBody>
        <div className="form-stack">
          <div className="admin-field">
            <label className="admin-label">Base URL</label>
            <input {...register("baseUrl")} className="admin-input" placeholder="http://192.168.1.3:3000" />
          </div>
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Benutzername</label>
              <input {...register("username")} className="admin-input" placeholder="admin" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Passwort</label>
              <input {...register("password")} className="admin-input" type="password" placeholder="••••••••" />
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
        </button>
      </ModalFooter>
    </form>
  );
}

function UnifiFormInner({ initial, onSubmit, isPending, onClose }: { initial: UnifiForm | undefined; onSubmit: (d: UnifiForm) => void; isPending: boolean; onClose: () => void }) {
  const { register, handleSubmit } = useForm<UnifiForm>({
    resolver: zodResolver(UnifiSchema),
    defaultValues: {
      controllerUrl: initial?.controllerUrl ?? "",
      apiKey: initial?.apiKey ?? "",
      siteId: initial?.siteId ?? "default",
      verifyTls: initial?.verifyTls ?? false,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
      <ModalBody>
        <div className="form-stack">
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Controller URL</label>
              <input {...register("controllerUrl")} className="admin-input" placeholder="https://192.168.1.1" />
              <span className="admin-hint">UDM Pro: <code>/proxy/network/...</code> wird automatisch angehängt</span>
            </div>
            <div className="admin-field">
              <label className="admin-label">API Key</label>
              <input {...register("apiKey")} className="admin-input font-mono" type="password" placeholder="••••••••" />
            </div>
          </div>
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Site ID</label>
              <input {...register("siteId")} className="admin-input" placeholder="default" />
            </div>
            <label className="flex items-center gap-[10px] cursor-pointer select-none mt-[20px]">
              <input type="checkbox" {...register("verifyTls")} className="w-[16px] h-[16px] accent-[var(--brand)]" />
              <span className="text-[13px] text-[var(--muted)]">TLS-Zertifikat prüfen (für UDM lokal: aus)</span>
            </label>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
        </button>
      </ModalFooter>
    </form>
  );
}


/* ── Generic multi-instance helpers ──────────────────────────────────────── */
type SimpleField = { name: string; label: string; placeholder?: string; type?: "text" | "password" | "number" };

function SimpleInstanceListModal({
  title, subtitle, items, onClose, onAdd, onEdit, onDelete,
}: {
  title: string; subtitle: string;
  items: { id: string; label: string; sub: string }[];
  onClose: () => void; onAdd: () => void;
  onEdit: (id: string) => void; onDelete: (id: string, label: string) => void;
}) {
  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader title={title} subtitle={subtitle} onClose={onClose} />
      <ModalBody>
        {items.length === 0 && (
          <div className="int-empty">Noch keine Instanz konfiguriert.</div>
        )}
        <div className="flex flex-col gap-[6px]">
          {items.map((item) => (
            <div key={item.id} className="admin-list-row">
              <div className="admin-list-row-body">
                <span className="admin-list-row-name">{item.label}</span>
                <span className="admin-list-row-sub">{item.sub}</span>
              </div>
              <button type="button" title="Bearbeiten" className="icon-btn" onClick={() => onEdit(item.id)}><Pencil size={13} /></button>
              <button type="button" title="Löschen" className="icon-btn icon-btn-danger" onClick={() => onDelete(item.id, item.label)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Schließen</button>
        <button type="button" className="btn-primary" onClick={onAdd}><Plus size={13} />Hinzufügen</button>
      </ModalFooter>
    </Modal>
  );
}

function SimpleInstanceEntryModal<T extends Record<string, unknown>>({
  title, schema, initial, fields, onClose, onSubmit, isPending,
}: {
  title: string; schema: z.ZodType<T>;
  initial: T | undefined; fields: SimpleField[];
  onClose: () => void; onSubmit: (d: T) => void; isPending: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, formState: { errors } } = useForm<T>({ resolver: zodResolver(schema), defaultValues: initial as any });
  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader title={title} subtitle={initial?.id ? "Bearbeiten" : "Neu anlegen"} onClose={onClose} />
      <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
        <ModalBody>
          <div className="form-stack">
            {fields.map((f) => (
              <div key={f.name} className="admin-field">
                <label className="admin-label">{f.label}</label>
                <input
                  {...register(f.name as Parameters<typeof register>[0])}
                  className="admin-input"
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                />
                {errors[f.name] && (
                  <span className="admin-error">{String((errors[f.name] as { message?: string })?.message ?? "")}</span>
                )}
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" disabled={isPending} className="btn-primary">
            <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function UptimeKumaFormInner({ initial, onSubmit, isPending, onClose }: { initial: UptimeKumaForm | undefined; onSubmit: (d: UptimeKumaForm) => void; isPending: boolean; onClose: () => void }) {
  const { register, handleSubmit } = useForm<UptimeKumaForm>({
    resolver: zodResolver(UptimeKumaSchema),
    defaultValues: { baseUrl: initial?.baseUrl ?? "", statusPageSlug: initial?.statusPageSlug ?? "" },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
      <ModalBody>
        <div className="form-stack">
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Base URL</label>
              <input {...register("baseUrl")} className="admin-input" placeholder="https://uptime.example.com" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Status-Page Slug</label>
              <input {...register("statusPageSlug")} className="admin-input" placeholder="default" />
            </div>
          </div>
          <span className="admin-hint">Tipp: Erstelle in Uptime Kuma eine öffentliche Status-Seite. Wir lesen <code>/api/status-page/{`{slug}`}</code>.</span>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
        </button>
      </ModalFooter>
    </form>
  );
}


function WeatherFormInner({ initial, onSubmit, isPending, onClose }: { initial: WeatherForm | undefined; onSubmit: (d: WeatherForm) => void; isPending: boolean; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<WeatherForm>({
    resolver: zodResolver(WeatherSchema),
    defaultValues: {
      enabled: initial?.enabled ?? true,
      latitude: initial?.latitude ?? 51.1657,
      longitude: initial?.longitude ?? 10.4515,
      locationName: initial?.locationName ?? "",
      unit: initial?.unit ?? "celsius",
      refreshIntervalMin: initial?.refreshIntervalMin ?? 15,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
      <ModalBody>
        <div className="form-stack">
          <label className="checkbox-row">
            <input type="checkbox" {...register("enabled")} />
            <span>Wetter-Widget aktivieren <strong>(muss an sein, sonst zeigt das Widget &quot;nicht konfiguriert&quot;)</strong></span>
          </label>
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Breitengrad (Latitude)</label>
              <input type="number" step="any" {...register("latitude")} className="admin-input font-mono" placeholder="51.1657" />
              {errors.latitude && <span className="field-error">{errors.latitude.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">Längengrad (Longitude)</label>
              <input type="number" step="any" {...register("longitude")} className="admin-input font-mono" placeholder="10.4515" />
              {errors.longitude && <span className="field-error">{errors.longitude.message}</span>}
            </div>
          </div>
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Standort-Name (Anzeige)</label>
              <input {...register("locationName")} className="admin-input" placeholder="Berlin" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Einheit</label>
              <select {...register("unit")} className="admin-input">
                <option value="celsius">Celsius (°C)</option>
                <option value="fahrenheit">Fahrenheit (°F)</option>
              </select>
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Refresh-Intervall (Minuten)</label>
            <input type="number" min={5} max={360} {...register("refreshIntervalMin")} className="admin-input" />
            <span className="admin-hint">
              Open-Meteo Free-Tier: 600 req/min, 10k/Tag — 15 Minuten ist ein vernünftiger Default. Cache greift server-seitig.
            </span>
          </div>
          <span className="admin-hint">
            Tipp: Lat/Lon kannst du auf <code>https://www.openstreetmap.org</code> für deinen Standort ablesen.
            Kein API-Key nötig — Open-Meteo ist komplett kostenlos für Self-Hosted.
          </span>
          <div
            className="admin-hint"
            style={{
              padding: 10,
              background: "color-mix(in srgb, var(--brand) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--brand) 25%, transparent)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <strong>Wichtig:</strong> Diese Integration speichert nur die Verbindung. Damit das Wetter im Dashboard erscheint,
            musst du unter <a href="/admin/widgets" style={{ color: "var(--brand)", textDecoration: "underline" }}>Admin → Widgets</a>
            {" "}ein neues Widget anlegen — Typ <code>Wetter</code>, Slot deiner Wahl (z.B. <code>sidebar-right</code> oder <code>full-width-top</code>).
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
        </button>
      </ModalFooter>
    </form>
  );
}

function Z2mFormInner({ initial, onSubmit, isPending, onClose }: { initial: Z2mForm | undefined; onSubmit: (d: Z2mForm) => void; isPending: boolean; onClose: () => void }) {
  const { register, handleSubmit, watch } = useForm<Z2mForm>({
    resolver: zodResolver(Z2mSchema),
    defaultValues: {
      enabled: initial?.enabled ?? false,
      source: initial?.source ?? "auto",
      haGroupEntity: initial?.haGroupEntity ?? "",
      mqttUrl: initial?.mqttUrl ?? "",
      mqttUsername: initial?.mqttUsername ?? "",
      mqttPassword: initial?.mqttPassword ?? "",
      mqttTopicPrefix: initial?.mqttTopicPrefix ?? "zigbee2mqtt",
    },
  });
  const source = watch("source");
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
      <ModalBody>
        <div className="form-stack">
          <label className="checkbox-row">
            <input type="checkbox" {...register("enabled")} />
            <span>Z2M-Widget aktivieren</span>
          </label>
          <div className="admin-field">
            <label className="admin-label">Daten-Quelle</label>
            <select {...register("source")} className="admin-input">
              <option value="auto">Auto-Discovery via HA (empfohlen)</option>
              <option value="ha">Legacy: HA-Group manuell pflegen</option>
              <option value="mqtt" disabled>MQTT direkt (kommt in v1.5)</option>
            </select>
            <span className="admin-hint">
              <strong>Auto:</strong> findet alle Z2M-Geräte automatisch in HA via Template-API — kein Setup nötig.{" "}
              <strong>Legacy:</strong> nutzt eine manuell gepflegte HA-Group.
            </span>
          </div>
          {source === "ha" && (
            <div className="admin-field">
              <label className="admin-label">HA Group-Entity (Legacy)</label>
              <input {...register("haGroupEntity")} className="admin-input font-mono" placeholder="group.zigbee_devices" />
              <span className="admin-hint">
                Pflege in Home Assistant eine Group mit allen Zigbee-Sensoren. Akku-Stand wird automatisch aus zugehörigen <code>*_battery</code>-Sensoren gelesen.
              </span>
            </div>
          )}
          {source === "auto" && (
            <div className="admin-hint">
              Das Widget enumeriert beim Aufruf alle HA-Geräte mit Identifier <code>zigbee2mqtt</code> via Template-API. Online-/Offline-Status, Akku-Stand und Raum-Zuordnung kommen aus dem HA-Device-Registry.
            </div>
          )}
          {source === "mqtt" && (
            <>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">MQTT URL</label>
                  <input {...register("mqttUrl")} className="admin-input" placeholder="mqtt://192.168.1.100:1883" />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Topic-Prefix</label>
                  <input {...register("mqttTopicPrefix")} className="admin-input font-mono" placeholder="zigbee2mqtt" />
                </div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Username</label>
                  <input {...register("mqttUsername")} className="admin-input" />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Passwort</label>
                  <input {...register("mqttPassword")} className="admin-input" type="password" />
                </div>
              </div>
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
        </button>
      </ModalFooter>
    </form>
  );
}


function UnifiProtectFormInner({ initial, onSubmit, isPending, onClose }: { initial: UnifiProtectForm | undefined; onSubmit: (d: UnifiProtectForm) => void; isPending: boolean; onClose: () => void }) {
  const { register, handleSubmit } = useForm<UnifiProtectForm>({
    resolver: zodResolver(UnifiProtectSchema),
    defaultValues: {
      enabled: initial?.enabled ?? false,
      baseUrl: initial?.baseUrl ?? "",
      apiKey: initial?.apiKey ?? "",
      verifyTls: initial?.verifyTls ?? false,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
      <ModalBody>
        <div className="form-stack">
          <label className="checkbox-row">
            <input type="checkbox" {...register("enabled")} />
            <span>UniFi Protect-Widget aktivieren</span>
          </label>
          <div className="admin-field">
            <label className="admin-label">Base URL</label>
            <input {...register("baseUrl")} className="admin-input" placeholder="https://192.168.1.1" />
            <span className="admin-hint">
              UDM-Hostname/IP. Wir nutzen <code>/proxy/protect/integration/v1/...</code>.
            </span>
          </div>
          <div className="admin-field">
            <label className="admin-label">API Key (X-API-KEY)</label>
            <input {...register("apiKey")} className="admin-input font-mono" type="password" placeholder="••••••••" />
            <span className="admin-hint">
              UniFi OS → Settings → Control Plane → Integrations → &quot;Create API Key&quot;.
            </span>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" {...register("verifyTls")} />
            <span>TLS-Zertifikat prüfen (für UDM lokal aus, für Reverse-Proxy mit echtem Cert an)</span>
          </label>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
        </button>
      </ModalFooter>
    </form>
  );
}

function CustomRestFormInner({
  initial,
  onSubmit,
  isPending,
  onClose,
}: {
  initial: { allowPrivateNetworks: boolean; allowedHosts: string[] } | undefined;
  onSubmit: (d: CustomRestForm) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const { register, handleSubmit } = useForm<CustomRestForm>({
    resolver: zodResolver(CustomRestSchema),
    defaultValues: {
      allowPrivateNetworks: initial?.allowPrivateNetworks ?? true,
      allowedHosts: (initial?.allowedHosts ?? []).join(", "),
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="modal-form-shell">
      <ModalBody>
        <div className="form-stack">
          <span className="admin-hint">
            Globale Sicherheits-Einstellungen für das Custom-REST-Widget (Widget-UI kommt in v0.4.5).
            Pro-Widget-Konfiguration (URL, Headers, JSONPath) erfolgt direkt im Widget-Modal.
          </span>
          <label className="checkbox-row">
            <input type="checkbox" {...register("allowPrivateNetworks")} />
            <span>Private Netze erlauben (10.x, 192.168.x, 172.16-31.x)</span>
          </label>
          <span className="admin-hint">
            <strong>Empfohlen für Self-Hosted:</strong> aktiviert.
            Cloud-Metadata-Endpoints (169.254.169.254 etc.) werden immer geblockt — egal welche Einstellung.
          </span>
          <div className="admin-field">
            <label className="admin-label">Hostname-Allowlist (optional, kommagetrennt)</label>
            <input {...register("allowedHosts")} className="admin-input font-mono" placeholder="api.github.com, sensor.example.com" />
            <span className="admin-hint">
              Wenn gesetzt: Custom-REST darf NUR Hosts aus dieser Liste aufrufen.
              Leer = jeder Host erlaubt (empfohlen für Heim-Setup).
            </span>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          <Save size={13} />{isPending ? "Speichern…" : "Speichern"}
        </button>
      </ModalFooter>
    </form>
  );
}
