import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { router, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";

const UnraidInstanceSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  /** Accept "socket", "unix:...", or http(s)://host[:port] */
  endpoint: z.string().min(1),
  apiKey: z.string().min(1),
});

const HaSchema = z.object({
  baseUrl: z.string().optional(),
  token: z.string().optional(),
  /** v6: optional group entity for ESPHome widget MVP */
  esphomeGroupEntity: z.string().optional(),
  /** v6: optional group entity for Z2M widget MVP */
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
  username: z.string().optional(),
  password: z.string().optional(),
  authMode: z.enum(["apiKey", "session"]).optional(),
  siteId: z.string().default("default"),
  verifyTls: z.boolean().default(false),
  showWan: z.boolean().optional(),
  showClients: z.boolean().optional(),
  showDevices: z.boolean().optional(),
  showSwitchPorts: z.boolean().optional(),
});

const GlancesHostSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  baseUrl: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
  verifyTls: z.boolean().default(false),
});

const PortainerInstanceSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  endpointId: z.number().int().default(1),
  verifyTls: z.boolean().default(false),
});

const UptimeKumaSchema = z.object({
  baseUrl: z.string().optional(),
  statusPageSlug: z.string().optional(),
});

const PiholeInstanceSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  baseUrl: z.string().optional(),
  apiToken: z.string().optional(),
});

const SpeedtestInstanceSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  baseUrl: z.string().optional(),
  bearerToken: z.string().optional(),
});

const WeatherSchema = z.object({
  // Default `true` so users only need to enter Lat/Lon — the checkbox is opt-out, not opt-in.
  enabled: z.boolean().default(true),
  latitude: z.number().min(-90).max(90).default(0),
  longitude: z.number().min(-180).max(180).default(0),
  locationName: z.string().default(""),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  refreshIntervalMin: z.number().int().min(5).max(360).default(15),
});

const Zigbee2MqttSchema = z.object({
  enabled: z.boolean().default(false),
  source: z.enum(["auto", "ha", "mqtt"]).default("auto"),
  haGroupEntity: z.string().optional(),
  mqttUrl: z.string().optional(),
  mqttUsername: z.string().optional(),
  mqttPassword: z.string().optional(),
  mqttTopicPrefix: z.string().default("zigbee2mqtt"),
});

const FrigateInstanceSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
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
  allowedHosts: z.array(z.string()).default([]),
});

export const integrationsRouter = router({
  get: adminProcedure.query(() => {
    const cfg = readConfig();
    return cfg.integrations;
  }),

  upsertUnraid: adminProcedure
    .input(UnraidInstanceSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const existing = cfg.integrations.unraid;
      const id = input.id ?? uuidv4();
      const idx = existing.findIndex((u) => u.id === id);
      const entry = { id, label: input.label, endpoint: input.endpoint, apiKey: input.apiKey };
      if (idx >= 0) existing[idx] = entry;
      else existing.push(entry);
      await patchConfig({ integrations: { ...cfg.integrations, unraid: existing } });
      return entry;
    }),

  deleteUnraid: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const updated = cfg.integrations.unraid.filter((u) => u.id !== input.id);
      await patchConfig({ integrations: { ...cfg.integrations, unraid: updated } });
    }),

  updateHomeAssistant: adminProcedure
    .input(HaSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ integrations: { ...cfg.integrations, homeAssistant: input } });
      return input;
    }),

  updateAdguard: adminProcedure
    .input(AdguardSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ integrations: { ...cfg.integrations, adguard: input } });
      return input;
    }),

  updateUnifi: adminProcedure
    .input(UnifiSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      // Merge with existing — keeps v6 fields (authMode, showWan, etc.) when frontend
      // hasn't been updated to send them yet.
      const merged: typeof cfg.integrations.unifi = {
        ...cfg.integrations.unifi,
        ...(input.controllerUrl !== undefined ? { controllerUrl: input.controllerUrl } : {}),
        ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.password !== undefined ? { password: input.password } : {}),
        ...(input.authMode !== undefined ? { authMode: input.authMode } : {}),
        siteId: input.siteId,
        verifyTls: input.verifyTls,
        ...(input.showWan !== undefined ? { showWan: input.showWan } : {}),
        ...(input.showClients !== undefined ? { showClients: input.showClients } : {}),
        ...(input.showDevices !== undefined ? { showDevices: input.showDevices } : {}),
        ...(input.showSwitchPorts !== undefined ? { showSwitchPorts: input.showSwitchPorts } : {}),
      };
      await patchConfig({ integrations: { ...cfg.integrations, unifi: merged } });
      return merged;
    }),

  upsertGlances: adminProcedure
    .input(GlancesHostSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.integrations.glances];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((g) => g.id === id);
      const entry = {
        id,
        label: input.label,
        baseUrl: input.baseUrl,
        username: input.username ?? "",
        password: input.password ?? "",
        verifyTls: input.verifyTls,
      };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ integrations: { ...cfg.integrations, glances: list } });
      return entry;
    }),

  deleteGlances: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.integrations.glances.filter((g) => g.id !== input.id);
      await patchConfig({ integrations: { ...cfg.integrations, glances: list } });
    }),

  upsertPortainer: adminProcedure
    .input(PortainerInstanceSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.integrations.portainer];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((p) => p.id === id);
      const entry = { id, label: input.label, endpointId: input.endpointId, verifyTls: input.verifyTls, ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}), ...(input.apiKey ? { apiKey: input.apiKey } : {}) };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ integrations: { ...cfg.integrations, portainer: list } });
      return entry;
    }),

  deletePortainer: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.integrations.portainer.filter((p) => p.id !== input.id);
      await patchConfig({ integrations: { ...cfg.integrations, portainer: list } });
    }),

  updateUptimeKuma: adminProcedure
    .input(UptimeKumaSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ integrations: { ...cfg.integrations, uptimeKuma: input } });
      return input;
    }),

  upsertPihole: adminProcedure
    .input(PiholeInstanceSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.integrations.pihole];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((p) => p.id === id);
      const entry = { id, label: input.label, ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}), ...(input.apiToken ? { apiToken: input.apiToken } : {}) };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ integrations: { ...cfg.integrations, pihole: list } });
      return entry;
    }),

  deletePihole: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.integrations.pihole.filter((p) => p.id !== input.id);
      await patchConfig({ integrations: { ...cfg.integrations, pihole: list } });
    }),

  upsertSpeedtest: adminProcedure
    .input(SpeedtestInstanceSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.integrations.speedtest];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((s) => s.id === id);
      const entry = { id, label: input.label, ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}), ...(input.bearerToken ? { bearerToken: input.bearerToken } : {}) };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ integrations: { ...cfg.integrations, speedtest: list } });
      return entry;
    }),

  deleteSpeedtest: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.integrations.speedtest.filter((s) => s.id !== input.id);
      await patchConfig({ integrations: { ...cfg.integrations, speedtest: list } });
    }),

  updateWeather: adminProcedure
    .input(WeatherSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ integrations: { ...cfg.integrations, weather: input } });
      return input;
    }),

  updateZigbee2mqtt: adminProcedure
    .input(Zigbee2MqttSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ integrations: { ...cfg.integrations, zigbee2mqtt: input } });
      return input;
    }),

  upsertFrigate: adminProcedure
    .input(FrigateInstanceSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.integrations.frigate];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((f) => f.id === id);
      const entry = { id, label: input.label, authMode: input.authMode, ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}), ...(input.username ? { username: input.username } : {}), ...(input.password ? { password: input.password } : {}) };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ integrations: { ...cfg.integrations, frigate: list } });
      return entry;
    }),

  deleteFrigate: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.integrations.frigate.filter((f) => f.id !== input.id);
      await patchConfig({ integrations: { ...cfg.integrations, frigate: list } });
    }),

  updateUnifiProtect: adminProcedure
    .input(UnifiProtectSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ integrations: { ...cfg.integrations, unifiProtect: input } });
      return input;
    }),

  updateCustomRest: adminProcedure
    .input(CustomRestSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ integrations: { ...cfg.integrations, customRest: input } });
      return input;
    }),

  upsertEsphome: adminProcedure
    .input(z.object({
      id: z.string().uuid().optional(),
      label: z.string().min(1),
      baseUrl: z.string().min(1),
      password: z.string().optional(),
      enabled: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.integrations.esphome];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((e) => e.id === id);
      const entry: (typeof list)[number] = { id, label: input.label, baseUrl: input.baseUrl, enabled: input.enabled };
      if (input.password) entry.password = input.password;
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ integrations: { ...cfg.integrations, esphome: list } });
      return entry;
    }),

  deleteEsphome: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.integrations.esphome.filter((e) => e.id !== input.id);
      await patchConfig({ integrations: { ...cfg.integrations, esphome: list } });
    }),
});
