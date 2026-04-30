import { v4 as uuidv4 } from "uuid";
import type { Config } from "./schema";

type Migration = {
  from: number;
  to: number;
  migrate: (cfg: Record<string, unknown>) => Record<string, unknown>;
};

/* ── v1 → v2 ─────────────────────────────────────────────────────────────── */
/* Adds: infraNodes, networkDevices, quickLinks, theme.customCss,
        layout.tabs, layout.rightSidebarOrder, layout.mainSectionOrder,
        meta.subtitle, integrations.unifi.{controllerUrl,siteId,verifyTls},
        widgetInstance.settings + new widget kinds (smartHome|network|storage). */

const DEFAULT_TABS = [
  { id: "overview", label: "Übersicht", enabled: true, sortOrder: 0 },
  { id: "services", label: "Services", enabled: true, sortOrder: 1 },
  { id: "network", label: "Netzwerk", enabled: true, sortOrder: 2, serviceCategoryFilter: "infrastructure" },
  { id: "smart-home", label: "Smart Home", enabled: true, sortOrder: 3, serviceCategoryFilter: "smart-home" },
  { id: "media", label: "Media", enabled: true, sortOrder: 4, serviceCategoryFilter: "media" },
];

const DEFAULT_QUICKLINKS_FALLBACK = [
  { iconEmoji: "⚡", label: "My Server",      url: "http://192.168.1.100:1080" },
  { iconEmoji: "🌐", label: "Router",         url: "https://192.168.1.1" },
  { iconEmoji: "🔀", label: "NPM",            url: "http://192.168.1.2:81" },
  { iconEmoji: "🛡️", label: "AdGuard",        url: "http://192.168.1.3:3000" },
  { iconEmoji: "🏠", label: "Home Assistant", url: "http://homeassistant.local:8123" },
];

function migrateV1ToV2(cfg: Record<string, unknown>): Record<string, unknown> {
  const next = { ...cfg };

  next["version"] = 2;

  const meta = (next["meta"] as Record<string, unknown> | undefined) ?? {};
  if (!meta["subtitle"]) meta["subtitle"] = "Home Infrastructure";
  next["meta"] = meta;

  const theme = (next["theme"] as Record<string, unknown> | undefined) ?? {};
  if (theme["customCss"] === undefined) theme["customCss"] = "";
  next["theme"] = theme;

  const integrations = (next["integrations"] as Record<string, unknown> | undefined) ?? {};
  const unifi = (integrations["unifi"] as Record<string, unknown> | undefined) ?? {};
  if (unifi["siteId"] === undefined) unifi["siteId"] = "default";
  if (unifi["verifyTls"] === undefined) unifi["verifyTls"] = false;
  integrations["unifi"] = unifi;
  if (!integrations["glances"]) integrations["glances"] = [];
  if (!integrations["portainer"]) integrations["portainer"] = { endpointId: 1, verifyTls: false };
  if (!integrations["uptimeKuma"]) integrations["uptimeKuma"] = {};
  if (!integrations["pihole"]) integrations["pihole"] = {};
  if (!integrations["speedtest"]) integrations["speedtest"] = {};
  next["integrations"] = integrations;

  const widgets = (next["widgetInstances"] as Record<string, unknown>[] | undefined) ?? [];
  next["widgetInstances"] = widgets.map((w) => ({ ...w, settings: w["settings"] ?? {} }));

  const layout = (next["layout"] as Record<string, unknown> | undefined) ?? {};
  if (!layout["tabs"]) layout["tabs"] = DEFAULT_TABS;
  if (!layout["rightSidebarOrder"]) {
    layout["rightSidebarOrder"] = (next["widgetInstances"] as { id: string }[]).map((w) => w.id);
  }
  if (!layout["mainSectionOrder"]) layout["mainSectionOrder"] = ["infra", "services"];
  if (layout["showQuickAccess"] === undefined) layout["showQuickAccess"] = true;
  if (layout["showSystemBadge"] === undefined) layout["showSystemBadge"] = true;
  next["layout"] = layout;

  if (!next["infraNodes"]) {
    const unraidIntegrations = (integrations["unraid"] as { id: string; label: string; endpoint: string }[] | undefined) ?? [];
    next["infraNodes"] = unraidIntegrations.map((u, idx) => {
      const ipMatch = /\/\/([^:/]+)/.exec(u.endpoint);
      return {
        id: uuidv4(),
        label: u.label,
        kind: "unraid",
        ip: ipMatch?.[1] ?? "",
        primary: idx === 0,
        badge: idx === 0 ? "PRIMARY" : "SECONDARY",
        chips: [],
        iconEmoji: idx === 0 ? "⚡" : "🔷",
        integrationRef: { kind: "unraid", id: u.id },
        sortOrder: idx,
        enabled: true,
      };
    });
  }

  const existingNetworkDevices = (next["networkDevices"] as unknown[] | undefined) ?? [];
  if (existingNetworkDevices.length === 0) {
    const services = (next["services"] as { name: string; url: string; category: string; icon: string }[] | undefined) ?? [];
    const candidates = services.filter((s) => s.category === "infrastructure").slice(0, 5);
    next["networkDevices"] = candidates.map((s, idx) => {
      const ipMatch = /\/\/([^:/]+)/.exec(s.url);
      const sub = ipMatch?.[1] ?? "";
      const emoji =
        s.icon.includes("shield") ? "🛡️" :
        s.icon === "network"     ? "🌐" :
        s.icon === "server"      ? "⚙️" : "🔀";
      return {
        id: uuidv4(),
        label: s.name,
        sub,
        iconEmoji: emoji,
        url: s.url,
        healthCheck: {
          kind: "http",
          url: s.url,
          expectStatus: [200, 204, 301, 302, 401],
          timeoutMs: 3000,
        },
        sortOrder: idx,
        enabled: true,
      };
    });
  }

  if (!next["quickLinks"]) {
    next["quickLinks"] = DEFAULT_QUICKLINKS_FALLBACK.map((q, idx) => ({
      id: uuidv4(),
      label: q.label,
      url: q.url,
      iconEmoji: q.iconEmoji,
      target: "_blank",
      sortOrder: idx,
      enabled: true,
    }));
  }

  return next;
}

/* ── v2 → v3 ─────────────────────────────────────────────────────────────── */
function migrateV2ToV3(cfg: Record<string, unknown>): Record<string, unknown> {
  return { ...cfg, version: 3 };
}

/* ── v3 → v4 ─────────────────────────────────────────────────────────────── */
function migrateV3ToV4(cfg: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cfg, version: 4 };
  if (!next["cameras"]) next["cameras"] = [];
  return next;
}

/* ── v4 → v5 ─────────────────────────────────────────────────────────────── */
function migrateV4ToV5(cfg: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cfg, version: 5 };
  const layout = (next["layout"] as Record<string, unknown> | undefined) ?? {};
  const order = (layout["mainSectionOrder"] as string[] | undefined) ?? ["infra", "services"];
  if (!order.includes("cameras")) layout["mainSectionOrder"] = [...order, "cameras"];
  next["layout"] = layout;
  return next;
}

/* ── v5 → v6 ─────────────────────────────────────────────────────────────── */
/* Adds:
   - WidgetInstance.slot ("sidebar-right" by default for all existing widgets)
   - WidgetInstance.display ("auto" default)
   - layout.slots (per-slot config)
   - layout.serviceCardShowCategory
   - auth (mode "open" for backwards compatibility — existing installs keep working)
   - integrations.unifiProtect, integrations.weather, integrations.frigate,
     integrations.zigbee2mqtt, integrations.customRest (all empty defaults)
   - integrations.unifi.{username,password,authMode,showWan,showClients,showDevices,showSwitchPorts}
   - integrations.homeAssistant.{esphomeGroupEntity,zigbee2mqttGroupEntity}
   sortOrder for widgets is preserved from layout.rightSidebarOrder if present.
   layout.rightSidebarOrder is dropped (Schema strip will remove it on next save). */
const SLOT_DEFAULTS = {
  "sidebar-right":     { enabled: true, maxItems: 0, columns: 1 },
  "full-width-top":    { enabled: true, maxItems: 0, columns: 4 },
  "below-infra":       { enabled: true, maxItems: 0, columns: 4 },
  "below-services":    { enabled: true, maxItems: 0, columns: 4 },
  "below-cameras":     { enabled: true, maxItems: 0, columns: 4 },
  "full-width-bottom": { enabled: true, maxItems: 0, columns: 4 },
};

function migrateV5ToV6(cfg: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cfg, version: 6 };

  const layout = { ...((next["layout"] as Record<string, unknown> | undefined) ?? {}) };
  const sidebarOrder = (layout["rightSidebarOrder"] as string[] | undefined) ?? [];
  const orderMap = new Map(sidebarOrder.map((id, idx) => [id, idx]));

  const widgets = ((next["widgetInstances"] as Record<string, unknown>[] | undefined) ?? []).map((w) => ({
    ...w,
    slot: (w["slot"] as string | undefined) ?? "sidebar-right",
    display: (w["display"] as string | undefined) ?? "auto",
    sortOrder: orderMap.has(w["id"] as string)
      ? orderMap.get(w["id"] as string)!
      : ((w["sortOrder"] as number | undefined) ?? 0),
  }));
  next["widgetInstances"] = widgets;

  if (!layout["slots"]) layout["slots"] = SLOT_DEFAULTS;
  if (layout["serviceCardShowCategory"] === undefined) layout["serviceCardShowCategory"] = true;
  // rightSidebarOrder is now derived from widget.slot + sortOrder — drop it.
  delete layout["rightSidebarOrder"];
  next["layout"] = layout;

  if (!next["auth"]) {
    next["auth"] = {
      mode: "open",
      users: [],
      oauth2: { scopes: ["openid", "profile", "email"], adminGroupValues: [] },
    };
  }

  const integrations = { ...((next["integrations"] as Record<string, unknown> | undefined) ?? {}) };
  const unifi = { ...((integrations["unifi"] as Record<string, unknown> | undefined) ?? {}) };
  if (unifi["authMode"] === undefined) unifi["authMode"] = "apiKey";
  if (unifi["showWan"] === undefined) unifi["showWan"] = true;
  if (unifi["showClients"] === undefined) unifi["showClients"] = true;
  if (unifi["showDevices"] === undefined) unifi["showDevices"] = true;
  if (unifi["showSwitchPorts"] === undefined) unifi["showSwitchPorts"] = false;
  integrations["unifi"] = unifi;

  if (!integrations["unifiProtect"]) integrations["unifiProtect"] = { enabled: false, verifyTls: false };
  if (!integrations["weather"]) {
    integrations["weather"] = {
      enabled: false, latitude: 0, longitude: 0, locationName: "",
      unit: "celsius", refreshIntervalMin: 15,
    };
  }
  if (!integrations["frigate"]) integrations["frigate"] = { enabled: false, authMode: "none" };
  if (!integrations["zigbee2mqtt"]) {
    integrations["zigbee2mqtt"] = { enabled: false, source: "ha", mqttTopicPrefix: "zigbee2mqtt" };
  }
  if (!integrations["customRest"]) {
    integrations["customRest"] = { allowPrivateNetworks: true, allowedHosts: [] };
  }
  next["integrations"] = integrations;

  return next;
}

/* ── v6 → v7 ─────────────────────────────────────────────────────────────── */
/* Converts portainer, pihole, speedtest, frigate from single-object to arrays.
   Existing configs are migrated: if a value was configured it becomes the first
   element of the array with a generated id and a sensible default label. */
function migrateV6ToV7(cfg: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cfg, version: 7 };
  const integrations = { ...((next["integrations"] as Record<string, unknown> | undefined) ?? {}) };

  // portainer
  const oldPortainer = integrations["portainer"] as Record<string, unknown> | undefined;
  if (oldPortainer && !Array.isArray(oldPortainer) && oldPortainer["baseUrl"]) {
    integrations["portainer"] = [{
      id: uuidv4(), label: "Portainer",
      baseUrl: oldPortainer["baseUrl"],
      apiKey: oldPortainer["apiKey"],
      endpointId: oldPortainer["endpointId"] ?? 1,
      verifyTls: oldPortainer["verifyTls"] ?? false,
    }];
  } else if (!Array.isArray(integrations["portainer"])) {
    integrations["portainer"] = [];
  }

  // pihole
  const oldPihole = integrations["pihole"] as Record<string, unknown> | undefined;
  if (oldPihole && !Array.isArray(oldPihole) && oldPihole["baseUrl"]) {
    integrations["pihole"] = [{
      id: uuidv4(), label: "Pi-hole",
      baseUrl: oldPihole["baseUrl"],
      apiToken: oldPihole["apiToken"],
    }];
  } else if (!Array.isArray(integrations["pihole"])) {
    integrations["pihole"] = [];
  }

  // speedtest
  const oldSpeedtest = integrations["speedtest"] as Record<string, unknown> | undefined;
  if (oldSpeedtest && !Array.isArray(oldSpeedtest) && oldSpeedtest["baseUrl"]) {
    integrations["speedtest"] = [{
      id: uuidv4(), label: "Speedtest Tracker",
      baseUrl: oldSpeedtest["baseUrl"],
      bearerToken: oldSpeedtest["bearerToken"],
    }];
  } else if (!Array.isArray(integrations["speedtest"])) {
    integrations["speedtest"] = [];
  }

  // frigate
  const oldFrigate = integrations["frigate"] as Record<string, unknown> | undefined;
  if (oldFrigate && !Array.isArray(oldFrigate) && oldFrigate["baseUrl"]) {
    integrations["frigate"] = [{
      id: uuidv4(), label: "Frigate",
      baseUrl: oldFrigate["baseUrl"],
      username: oldFrigate["username"],
      password: oldFrigate["password"],
      authMode: oldFrigate["authMode"] ?? "none",
    }];
  } else if (!Array.isArray(integrations["frigate"])) {
    integrations["frigate"] = [];
  }

  next["integrations"] = integrations;
  return next;
}

/* ── v7 → v8 ─────────────────────────────────────────────────────────────── */
/* Adds: boards[], sections[], boardId+gridLayout on services/widgets/infraNodes/cameras/networkDevices.
   A default "Home" board is created with a fixed deterministic ID.
   Initial gridLayout per item is derived from old slot+sortOrder. */

/** Fixed UUID for the default home board — same across fresh installs and migrations. */
export const HOME_BOARD_ID = "00000000-0000-0000-0000-000000000001";

function slotToGridLayout(slot: string, sortOrder: number): Record<string, unknown> {
  switch (slot) {
    case "full-width-top":    return { x: 0, y: sortOrder * 7,        w: 12, h: 6, minW: 4, minH: 3 };
    case "below-infra":       return { x: 0, y: 20 + sortOrder * 7,   w: 12, h: 6, minW: 4, minH: 3 };
    case "below-services":    return { x: 0, y: 50 + sortOrder * 7,   w: 12, h: 6, minW: 4, minH: 3 };
    case "below-cameras":     return { x: 0, y: 80 + sortOrder * 7,   w: 12, h: 6, minW: 4, minH: 3 };
    case "full-width-bottom": return { x: 0, y: 110 + sortOrder * 7,  w: 12, h: 6, minW: 4, minH: 3 };
    default: /* sidebar-right */ return { x: 9, y: sortOrder * 6, w: 3, h: 6, minW: 2, minH: 3 };
  }
}

function migrateV7ToV8(cfg: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cfg, version: 8 };

  if (!Array.isArray(next["boards"]) || (next["boards"] as unknown[]).length === 0) {
    next["boards"] = [{
      id: HOME_BOARD_ID, slug: "home", name: "Home",
      isHome: true, layout: "flat", sortOrder: 0,
    }];
  }
  if (!Array.isArray(next["sections"])) next["sections"] = [];

  const homeBoardId =
    ((next["boards"] as Record<string, unknown>[])[0]?.["id"] as string | undefined) ?? HOME_BOARD_ID;

  next["services"] = ((next["services"] as Record<string, unknown>[] | undefined) ?? []).map((s, i) => ({
    ...s,
    boardId: (s["boardId"] as string | undefined) ?? homeBoardId,
    gridLayout: (s["gridLayout"] as Record<string, unknown> | undefined) ?? {
      x: (i % 3) * 4, y: Math.floor(i / 3) * 5, w: 4, h: 4, minW: 2, minH: 2,
    },
  }));

  next["widgetInstances"] = ((next["widgetInstances"] as Record<string, unknown>[] | undefined) ?? []).map((w) => ({
    ...w,
    boardId: (w["boardId"] as string | undefined) ?? homeBoardId,
    gridLayout: (w["gridLayout"] as Record<string, unknown> | undefined) ??
      slotToGridLayout(
        (w["slot"] as string | undefined) ?? "sidebar-right",
        (w["sortOrder"] as number | undefined) ?? 0,
      ),
  }));

  next["infraNodes"] = ((next["infraNodes"] as Record<string, unknown>[] | undefined) ?? []).map((n, i) => ({
    ...n,
    boardId: (n["boardId"] as string | undefined) ?? homeBoardId,
    gridLayout: (n["gridLayout"] as Record<string, unknown> | undefined) ?? {
      x: 0, y: i * 6, w: 12, h: 5, minW: 4, minH: 3,
    },
  }));

  next["cameras"] = ((next["cameras"] as Record<string, unknown>[] | undefined) ?? []).map((c, i) => ({
    ...c,
    boardId: (c["boardId"] as string | undefined) ?? homeBoardId,
    gridLayout: (c["gridLayout"] as Record<string, unknown> | undefined) ?? {
      x: (i % 3) * 4, y: Math.floor(i / 3) * 5, w: 4, h: 5, minW: 2, minH: 3,
    },
  }));

  next["networkDevices"] = ((next["networkDevices"] as Record<string, unknown>[] | undefined) ?? []).map((d) => ({
    ...d,
    boardId: (d["boardId"] as string | undefined) ?? homeBoardId,
  }));

  return next;
}

/* ── v8 → v9 ─────────────────────────────────────────────────────────────── */
/* Adds: AuthUser.id (UUID), .email?, .createdAt; expands role to include "editor". */
function migrateV8ToV9(cfg: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cfg, version: 9 };
  const auth = { ...((next["auth"] as Record<string, unknown> | undefined) ?? {}) };
  auth["users"] = ((auth["users"] as Record<string, unknown>[] | undefined) ?? []).map((u) => ({
    ...u,
    id: (u["id"] as string | undefined) ?? uuidv4(),
    createdAt: (u["createdAt"] as string | undefined) ?? new Date().toISOString(),
  }));
  next["auth"] = auth;
  return next;
}

/* ── v9 → v10 ────────────────────────────────────────────────────────────── */
/* Adds: meta.firstRunCompleted, auth.oauth2 v10 fields, search config w/ default engines. */
const GOOGLE_ENGINE_ID  = "00000000-0000-0000-0000-000000000010";
const DDG_ENGINE_ID     = "00000000-0000-0000-0000-000000000011";
const BRAVE_ENGINE_ID   = "00000000-0000-0000-0000-000000000012";

function migrateV9ToV10(cfg: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cfg, version: 10 };

  const meta = { ...((next["meta"] as Record<string, unknown> | undefined) ?? {}) };
  if (meta["firstRunCompleted"] === undefined) meta["firstRunCompleted"] = false;
  next["meta"] = meta;

  const auth = { ...((next["auth"] as Record<string, unknown> | undefined) ?? {}) };
  const oauth2 = { ...((auth["oauth2"] as Record<string, unknown> | undefined) ?? {}) };
  if (oauth2["autoCreateUsers"] === undefined) oauth2["autoCreateUsers"] = false;
  if (!oauth2["userMapping"]) oauth2["userMapping"] = { emailClaim: "email", nameClaim: "name" };
  auth["oauth2"] = oauth2;
  next["auth"] = auth;

  if (!next["search"]) {
    next["search"] = {
      engines: [
        {
          id: GOOGLE_ENGINE_ID, name: "Google",
          urlTemplate: "https://www.google.com/search?q={q}",
          icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/google.png",
          hotkey: "g", sortOrder: 0,
        },
        {
          id: DDG_ENGINE_ID, name: "DuckDuckGo",
          urlTemplate: "https://duckduckgo.com/?q={q}",
          icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/duckduckgo.png",
          hotkey: "d", sortOrder: 1,
        },
        {
          id: BRAVE_ENGINE_ID, name: "Brave Search",
          urlTemplate: "https://search.brave.com/search?q={q}",
          icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/brave.png",
          hotkey: "b", sortOrder: 2,
        },
      ],
      defaultEngineId: GOOGLE_ENGINE_ID,
      localFirst: true,
    };
  }

  return next;
}

/* ── v10 → v11 ───────────────────────────────────────────────────────────── */
/* Drops deprecated slot-system fields from widgetInstances and layout.
   - widgetInstances: drops slot, display, minHeightPx
   - layout: drops slots, mainSectionOrder, serviceColumns */
function migrateV10ToV11(cfg: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cfg, version: 11 };

  next["widgetInstances"] = ((next["widgetInstances"] as Record<string, unknown>[] | undefined) ?? []).map((w) => {
    const { slot: _slot, display: _display, minHeightPx: _minH, ...rest } = w;
    void _slot; void _display; void _minH;
    return rest;
  });

  const layout = { ...((next["layout"] as Record<string, unknown> | undefined) ?? {}) };
  const { slots: _slots, mainSectionOrder: _mso, serviceColumns: _sc, ...layoutRest } = layout;
  void _slots; void _mso; void _sc;
  next["layout"] = layoutRest;

  return next;
}

function migrateV11ToV12(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, version: 12 };
  // Add esphome[] array to integrations if not present
  const integrations = (next["integrations"] as Record<string, unknown> | undefined) ?? {};
  if (!Array.isArray(integrations["esphome"])) {
    next["integrations"] = { ...integrations, esphome: [] };
  }
  return next;
}

/* ── v12 → v13 ──────────────────────────────────────────────────────────────
   v1.4.1: hardened OIDC support + theme backgroundPattern + editable helpItems.
   - auth.oauth2 gains editorGroupValues[] and fallbackRole; existing fields kept.
   - If auth.mode === "oauth2" but issuerUrl is empty → fall back to "open" mode
     to prevent lockout (the new strategy hard-blocks misconfigured oauth2).
     A warning marker is set under meta.migrationWarnings[] for the admin UI.
   - theme.backgroundPattern defaults to "mesh" (preserves current visual).
   - helpItems empty by default; the runtime fills them from defaults if empty. */
function migrateV12ToV13(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, version: 13 };

  // Auth: harden oauth2 — prevent lockout on misconfigured installs
  const authRaw = (next["auth"] as Record<string, unknown> | undefined) ?? {};
  const oauth2Raw = (authRaw["oauth2"] as Record<string, unknown> | undefined) ?? {};
  const issuerUrl = typeof oauth2Raw["issuerUrl"] === "string" ? oauth2Raw["issuerUrl"].trim() : "";
  const clientId = typeof oauth2Raw["clientId"] === "string" ? oauth2Raw["clientId"].trim() : "";
  const oauth2Configured = issuerUrl.length > 0 && clientId.length > 0;

  const auth: Record<string, unknown> = {
    ...authRaw,
    oauth2: {
      ...oauth2Raw,
      editorGroupValues: Array.isArray(oauth2Raw["editorGroupValues"])
        ? oauth2Raw["editorGroupValues"]
        : [],
      fallbackRole:
        typeof oauth2Raw["fallbackRole"] === "string" &&
        ["admin", "editor", "viewer"].includes(oauth2Raw["fallbackRole"] as string)
          ? oauth2Raw["fallbackRole"]
          : "viewer",
    },
  };

  if (authRaw["mode"] === "oauth2" && !oauth2Configured) {
    auth["mode"] = "open";
    const meta = (next["meta"] as Record<string, unknown> | undefined) ?? {};
    const warnings = Array.isArray(meta["migrationWarnings"])
      ? [...(meta["migrationWarnings"] as unknown[])]
      : [];
    warnings.push("oauth2-mode-reset-incomplete-config-v13");
    next["meta"] = { ...meta, migrationWarnings: warnings };
  }
  next["auth"] = auth;

  // Theme: add backgroundPattern, default "mesh" preserves current behavior
  const theme = (next["theme"] as Record<string, unknown> | undefined) ?? {};
  if (typeof theme["backgroundPattern"] !== "string") {
    theme["backgroundPattern"] = "mesh";
  }
  next["theme"] = theme;

  // Help items: default to [] — runtime seeds from defaults when empty
  if (!Array.isArray(next["helpItems"])) {
    next["helpItems"] = [];
  }

  return next;
}

/* ── v13 → v14 ──────────────────────────────────────────────────────────────
   v1.4.2: Command Overview banner above the dashboard content.
   - meta gains `domain`, `commandOverviewSubtitle`, `quickActions[]`
   - layout gains `showCommandOverview` (defaults to true → banner is visible
     for existing installs unless the user explicitly disables it).
   Additive only — no data loss, no field removal. */
function migrateV13ToV14(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, version: 14 };

  const meta = { ...((next["meta"] as Record<string, unknown> | undefined) ?? {}) };
  if (typeof meta["domain"] !== "string") meta["domain"] = "";
  if (typeof meta["commandOverviewSubtitle"] !== "string") meta["commandOverviewSubtitle"] = "";
  if (!Array.isArray(meta["quickActions"])) meta["quickActions"] = [];
  next["meta"] = meta;

  const layout = { ...((next["layout"] as Record<string, unknown> | undefined) ?? {}) };
  if (typeof layout["showCommandOverview"] !== "boolean") layout["showCommandOverview"] = true;
  next["layout"] = layout;

  return next;
}

/* ── v14 → v15 ──────────────────────────────────────────────────────────────
   Grid-Engine-Verfeinerung: 12 cols × 80px rows → 24 cols × 20px rows.
   Pure mechanische Hochskalierung aller gridLayouts: w/x ×2, h/y ×4.
   Optisch identisch nach Migration; danach feinkörnig anpassbar. */
function scaleGridLayoutV14toV15(gl: Record<string, unknown>): Record<string, unknown> {
  const num = (key: string, fallback: number): number => {
    const v = gl[key];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const out: Record<string, unknown> = {
    x: num("x", 0) * 2,
    y: num("y", 0) * 4,
    w: Math.min(24, num("w", 4) * 2),
    h: num("h", 4) * 4,
    minW: Math.min(24, num("minW", 2) * 2),
    minH: num("minH", 2) * 4,
  };
  if (typeof gl["maxW"] === "number") out["maxW"] = Math.min(24, (gl["maxW"] as number) * 2);
  if (typeof gl["maxH"] === "number") out["maxH"] = (gl["maxH"] as number) * 4;
  return out;
}

function migrateV14ToV15(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, version: 15 };

  const scaleOn = (key: string) => {
    const arr = next[key] as Record<string, unknown>[] | undefined;
    if (!Array.isArray(arr)) return;
    next[key] = arr.map((item) => {
      const gl = item["gridLayout"] as Record<string, unknown> | undefined;
      if (!gl) return item;
      return { ...item, gridLayout: scaleGridLayoutV14toV15(gl) };
    });
  };

  scaleOn("services");
  scaleOn("widgetInstances");
  scaleOn("infraNodes");
  scaleOn("cameras");

  return next;
}

/* ── v15 → v16 ──────────────────────────────────────────────────────────────
   v1.4.6: Z2M auto-discovery — wenn source "ha" ist und keine haGroupEntity
   gesetzt wurde, switche auf "auto" damit User automatisch von der neuen
   HA-Template-Discovery profitiert. Existierende explizite ha-Group-Configs
   bleiben unverändert. */
function migrateV15ToV16(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, version: 16 };
  const integrations = { ...((next["integrations"] as Record<string, unknown> | undefined) ?? {}) };
  const z2m = { ...((integrations["zigbee2mqtt"] as Record<string, unknown> | undefined) ?? {}) };
  const source = z2m["source"];
  const haGroup = typeof z2m["haGroupEntity"] === "string" ? z2m["haGroupEntity"].trim() : "";
  if (source === "ha" && haGroup.length === 0) {
    z2m["source"] = "auto";
  }
  integrations["zigbee2mqtt"] = z2m;
  next["integrations"] = integrations;
  return next;
}

/* ── v16 → v17 ──────────────────────────────────────────────────────────────
   v1.5.0: Header umgestellt von Filter-Tabs auf echte Routen.
   - layout.tabs[] entfällt (Top-Nav ist jetzt /, /services, /admin als Routen)
   - services[].pinnedToHome: services-Editor-Toggle für die "Häufig genutzt"-Section
     auf der Home-Route. Default false; alte Configs ohne das Feld bekommen es per
     Default. Service-Sortierung (sortOrder) bleibt für die Reihenfolge unverändert.
*/
function migrateV16ToV17(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, version: 17 };

  const layout = { ...((next["layout"] as Record<string, unknown> | undefined) ?? {}) };
  delete layout["tabs"];
  next["layout"] = layout;

  const services = (next["services"] as Record<string, unknown>[] | undefined) ?? [];
  next["services"] = services.map((s) => ({
    ...s,
    pinnedToHome: typeof s["pinnedToHome"] === "boolean" ? s["pinnedToHome"] : false,
  }));

  return next;
}

export const migrations: Migration[] = [
  { from: 1,  to: 2,  migrate: migrateV1ToV2 },
  { from: 2,  to: 3,  migrate: migrateV2ToV3 },
  { from: 3,  to: 4,  migrate: migrateV3ToV4 },
  { from: 4,  to: 5,  migrate: migrateV4ToV5 },
  { from: 5,  to: 6,  migrate: migrateV5ToV6 },
  { from: 6,  to: 7,  migrate: migrateV6ToV7 },
  { from: 7,  to: 8,  migrate: migrateV7ToV8 },
  { from: 8,  to: 9,  migrate: migrateV8ToV9 },
  { from: 9,  to: 10, migrate: migrateV9ToV10 },
  { from: 10, to: 11, migrate: migrateV10ToV11 },
  { from: 11, to: 12, migrate: migrateV11ToV12 },
  { from: 12, to: 13, migrate: migrateV12ToV13 },
  { from: 13, to: 14, migrate: migrateV13ToV14 },
  { from: 14, to: 15, migrate: migrateV14ToV15 },
  { from: 15, to: 16, migrate: migrateV15ToV16 },
  { from: 16, to: 17, migrate: migrateV16ToV17 },
];

export function runMigrations(raw: Record<string, unknown>): Record<string, unknown> {
  let current = raw;
  let version = (current["version"] as number) ?? 1;

  for (const migration of migrations) {
    if (migration.from === version) {
      current = migration.migrate(current);
      version = migration.to;
    }
  }

  return current;
}

export const CURRENT_VERSION: Config["version"] = 17;
