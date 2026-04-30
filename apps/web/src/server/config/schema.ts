import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

/* ── Grid Layout (v15: 24 cols × 20px rows) ──────────────────────────────── */
export const GridLayoutSchema = z.object({
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  w: z.number().int().min(1).max(24).default(8),
  h: z.number().int().min(1).default(16),
  minW: z.number().int().min(1).default(4),
  minH: z.number().int().min(1).default(8),
  maxW: z.number().int().min(1).max(24).optional(),
  maxH: z.number().int().min(1).optional(),
});
export type GridLayout = z.infer<typeof GridLayoutSchema>;

/* ── Board (v8) — one dashboard tab / page ───────────────────────────────── */
export const BoardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  icon: z.string().optional(),
  isHome: z.boolean().default(false),
  layout: z.enum(["flat", "sections"]).default("flat"),
  sortOrder: z.number().int().default(0),
});
export type Board = z.infer<typeof BoardSchema>;

/* ── Section (v8) — sub-container within a board ────────────────────────── */
export const SectionSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().min(1),
  title: z.string().min(1),
  collapsed: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type Section = z.infer<typeof SectionSchema>;

/* ── Search (v10) ────────────────────────────────────────────────────────── */
export const SearchEngineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  /** URL template with {q} placeholder, e.g. "https://www.google.com/search?q={q}" */
  urlTemplate: z.string().min(1),
  icon: z.string().optional(),
  /** Optional single-char hotkey prefix, e.g. "g" for "g foo" → Google */
  hotkey: z.string().optional(),
  sortOrder: z.number().int().default(0),
});
export type SearchEngine = z.infer<typeof SearchEngineSchema>;

export const SearchConfigSchema = z.object({
  engines: z.array(SearchEngineSchema).default([]),
  defaultEngineId: z.string().optional(),
  localFirst: z.boolean().default(true),
});
export type SearchConfig = z.infer<typeof SearchConfigSchema>;

/* ── Service ─────────────────────────────────────────────────────────────── */
export const ServiceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url(),
  category: z.enum(["infrastructure", "media", "smart-home", "tools", "external"]),
  icon: z.string().default("globe"),
  color: z.string().optional(),
  pingTarget: z.object({
    kind: z.enum(["http", "tcp", "none"]),
    url: z.string().optional(),
    host: z.string().optional(),
    port: z.number().int().optional(),
    expectStatus: z.array(z.number()).default([200, 204, 301, 302, 401]),
    timeoutMs: z.number().int().default(3000),
  }),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
  /** v8: which board this service belongs to */
  boardId: z.string().min(1).default("home"),
  /** v8: grid position on the board */
  gridLayout: GridLayoutSchema.default({}),
  /** v17: shown in the "Häufig genutzt" section on the home dashboard */
  pinnedToHome: z.boolean().default(false),
});
export type Service = z.infer<typeof ServiceSchema>;

/* ── Widget-Slot (v6–v10, removed in v11 — kept as type alias for existing code) */
export const WidgetSlotSchema = z.enum([
  "sidebar-right",
  "full-width-top",
  "below-infra",
  "below-services",
  "below-cameras",
  "full-width-bottom",
]);
export type WidgetSlot = z.infer<typeof WidgetSlotSchema>;

export const WIDGET_SLOTS: readonly WidgetSlot[] = [
  "sidebar-right",
  "full-width-top",
  "below-infra",
  "below-services",
  "below-cameras",
  "full-width-bottom",
] as const;

export const WidgetDisplayModeSchema = z.enum(["auto", "compact", "expanded", "full"]);
export type WidgetDisplayMode = z.infer<typeof WidgetDisplayModeSchema>;

/* ── Widget-Instanz ─────────────────────────────────────────────────────── */
export const WidgetKindSchema = z.enum([
  "unraid",
  "homeassistant",
  "adguard",
  "unifi",
  "smartHome",
  "network",
  "storage",
  "glances",
  "portainer",
  "uptimeKuma",
  "speedtest",
  "pihole",
  "cameras",
  "weather",
  "esphome",
  "zigbee2mqtt",
  "unifiProtect",
  "frigate",
  "customRest",
]);
export type WidgetKind = z.infer<typeof WidgetKindSchema>;

export const WidgetInstanceSchema = z.object({
  id: z.string().uuid(),
  kind: WidgetKindSchema,
  label: z.string().min(1),
  enabled: z.boolean().default(true),
  refreshSec: z.number().int().min(5).default(30),
  sortOrder: z.number().int().default(0),
  settings: z.record(z.unknown()).default({}),
  linkUrl: z.string().optional(),
  /** v8: which board this widget belongs to */
  boardId: z.string().min(1).default("home"),
  /** v8: grid position on the board */
  gridLayout: GridLayoutSchema.default({}),
});
export type WidgetInstance = z.infer<typeof WidgetInstanceSchema>;

/* ── Slot-Configuration (v6–v10, removed in v11) ─────────────────────────── */
export const SlotConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxItems: z.number().int().min(0).default(0),
  columns: z.number().int().min(1).max(6).default(4),
});
export type SlotConfig = z.infer<typeof SlotConfigSchema>;

/* ── Infrastructure-Node-Karte ───────────────────────────────────────────── */
export const InfraNodeKindSchema = z.enum(["unraid", "generic"]);
export type InfraNodeKind = z.infer<typeof InfraNodeKindSchema>;

export const InfraNodeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  kind: InfraNodeKindSchema.default("unraid"),
  ip: z.string().optional(),
  linkUrl: z.string().optional(),
  versionOverride: z.string().optional(),
  primary: z.boolean().default(false),
  badge: z.string().default("PRIMARY"),
  chips: z.array(z.string()).default([]),
  iconEmoji: z.string().default("⚡"),
  integrationRef: z
    .object({ kind: z.literal("unraid"), id: z.string().uuid() })
    .nullable()
    .default(null),
  glancesRef: z
    .object({ kind: z.literal("glances"), id: z.string().uuid() })
    .nullable()
    .default(null),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
  /** v8: which board this node belongs to */
  boardId: z.string().min(1).default("home"),
  /** v8: grid position on the board */
  gridLayout: GridLayoutSchema.default({ x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 }),
});
export type InfraNode = z.infer<typeof InfraNodeSchema>;

/* ── Network-Device ──────────────────────────────────────────────────────── */
export const NetworkDeviceSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  sub: z.string().optional(),
  iconEmoji: z.string().default("🌐"),
  url: z.string().optional(),
  healthCheck: z
    .object({
      kind: z.enum(["http", "tcp", "none"]),
      url: z.string().optional(),
      host: z.string().optional(),
      port: z.number().int().optional(),
      expectStatus: z.array(z.number()).default([200, 204, 301, 302, 401]),
      timeoutMs: z.number().int().default(3000),
    })
    .default({ kind: "none", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 }),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
  /** v8: which board this device belongs to */
  boardId: z.string().min(1).default("home"),
});
export type NetworkDevice = z.infer<typeof NetworkDeviceSchema>;

/* ── Kamera ──────────────────────────────────────────────────────────────── */
export const CameraSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  snapshotUrl: z.string().min(1),
  linkUrl: z.string().optional(),
  refreshSec: z.number().int().min(2).default(10),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
  /** v8: which board this camera belongs to */
  boardId: z.string().min(1).default("home"),
  /** v8: grid position on the board */
  gridLayout: GridLayoutSchema.default({ x: 0, y: 0, w: 4, h: 5, minW: 2, minH: 3 }),
});
export type Camera = z.infer<typeof CameraSchema>;

/* ── Quick-Link (Footer-Bar) ─────────────────────────────────────────────── */
export const QuickLinkSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  url: z.string().min(1),
  iconEmoji: z.string().default("🔗"),
  target: z.enum(["_blank", "_self"]).default("_blank"),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
});
export type QuickLink = z.infer<typeof QuickLinkSchema>;

/* ── Auth ────────────────────────────────────────────────────────────────── */
export const AuthModeSchema = z.enum(["open", "token", "userPassword", "oauth2"]);
export type AuthMode = z.infer<typeof AuthModeSchema>;

export const AuthUserSchema = z.object({
  /** v9: stable UUID for the user */
  id: z.string().uuid().default(() => uuidv4()),
  username: z.string().min(1),
  email: z.string().email().optional(),
  /** bcrypt hash; never store plaintext */
  passwordHash: z.string().min(1),
  /** v9: added "editor" role between admin and viewer */
  role: z.enum(["admin", "editor", "viewer"]).default("admin"),
  /** v9: ISO timestamp of account creation */
  createdAt: z.string().default(() => new Date().toISOString()),
  /** v9: ISO timestamp of last successful login */
  lastLogin: z.string().optional(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthOauth2Schema = z.object({
  issuerUrl: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).default(["openid", "profile", "email"]),
  adminGroupClaim: z.string().optional(),
  adminGroupValues: z.array(z.string()).default([]),
  /** v13: groups that map to the editor role (admin > editor > viewer) */
  editorGroupValues: z.array(z.string()).default([]),
  /** v13: role to assign when no group claim matches; "viewer" is the safe default */
  fallbackRole: z.enum(["admin", "editor", "viewer"]).default("viewer"),
  /** v10: human-readable provider name shown on the login page */
  providerLabel: z.string().optional(),
  /** v10: OIDC callback path override (default: /api/auth/oidc/callback) */
  callbackPath: z.string().optional(),
  /** v10: auto-create user accounts on first OIDC login */
  autoCreateUsers: z.boolean().default(false),
  /** v10: which OIDC claims map to which user fields */
  userMapping: z
    .object({
      emailClaim: z.string().default("email"),
      nameClaim: z.string().default("name"),
      roleClaim: z.string().optional(),
    })
    .default({ emailClaim: "email", nameClaim: "name" }),
});
export type AuthOauth2 = z.infer<typeof AuthOauth2Schema>;

export const AuthSchema = z.object({
  mode: AuthModeSchema.default("open"),
  users: z.array(AuthUserSchema).default([]),
  oauth2: AuthOauth2Schema.default({
    scopes: ["openid", "profile", "email"],
    adminGroupValues: [],
    autoCreateUsers: false,
    userMapping: { emailClaim: "email", nameClaim: "name" },
  }),
});
export type AuthConfig = z.infer<typeof AuthSchema>;

/* ── Help/FAQ items (v13) ─────────────────────────────────────────────────── */
export const FaqItemSchema = z.object({
  id: z.string().uuid().default(() => uuidv4()),
  question: z.string().min(1),
  answer: z.string().min(1),
  sortOrder: z.number().int().default(0),
});
export type FaqItem = z.infer<typeof FaqItemSchema>;

/* ── Command Overview Quick-Action (v14) ─────────────────────────────────── */
export const QuickActionSchema = z.object({
  id: z.string().uuid().default(() => uuidv4()),
  label: z.string().min(1),
  url: z.string().min(1),
  iconEmoji: z.string().optional(),
  target: z.enum(["_blank", "_self"]).default("_blank"),
  sortOrder: z.number().int().default(0),
});
export type QuickAction = z.infer<typeof QuickActionSchema>;

/* ── Config-Root ─────────────────────────────────────────────────────────── */
export const ConfigSchema = z.object({
  version: z.literal(17),
  meta: z.object({
    name: z.string().default("ITSWEBER Mesh"),
    locale: z.enum(["de", "en"]).default("de"),
    subtitle: z.string().default("Home Infrastructure"),
    /** v10: set to true once the first-run wizard has been completed */
    firstRunCompleted: z.boolean().default(false),
    /** v13: optional GitHub repo URL — when empty, About-page hides repo links */
    githubUrl: z.string().optional(),
    /** v13: surfaced to admin UI as banners (e.g. "oauth2 reset due to incomplete config") */
    migrationWarnings: z.array(z.string()).default([]),
    /** v14: domain shown in the Command Overview title, e.g. "mesh.itsweber.net". Empty string falls back to window.location.hostname. */
    domain: z.string().default(""),
    /** v14: subtitle line under the Command Overview title; empty string hides the line. */
    commandOverviewSubtitle: z.string().default(""),
    /** v14: configurable quick-action buttons in the Command Overview header. */
    quickActions: z.array(QuickActionSchema).default([]),
  }),
  theme: z.object({
    preset: z
      .enum(["dark", "light", "terminal", "itsweber", "slate", "modern-light", "graphite-command"])
      .default("graphite-command"),
    accent: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default("#3ba7a7"),
    background: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("solid") }),
        z.object({ kind: z.literal("gradient") }),
        z.object({ kind: z.literal("image"), src: z.string() }),
      ])
      .default({ kind: "solid" }),
    /** v13: optional decorative background pattern overlay */
    backgroundPattern: z.enum(["none", "mesh", "dots", "stripes"]).default("mesh"),
    customCss: z.string().default(""),
  }),
  layout: z.object({
    showQuickAccess: z.boolean().default(true),
    showSystemBadge: z.boolean().default(true),
    serviceCardShowCategory: z.boolean().default(true),
    /** v14: render the Command Overview banner above the dashboard content. */
    showCommandOverview: z.boolean().default(true),
  }),
  auth: AuthSchema.default({
    mode: "open",
    users: [],
    oauth2: {
      scopes: ["openid", "profile", "email"],
      adminGroupValues: [],
      editorGroupValues: [],
      fallbackRole: "viewer",
      autoCreateUsers: false,
      userMapping: { emailClaim: "email", nameClaim: "name" },
    },
  }),
  /** v13: editable Help/FAQ items (replaces hardcoded array on /admin/help) */
  helpItems: z.array(FaqItemSchema).default([]),
  services: z.array(ServiceSchema),
  widgetInstances: z.array(WidgetInstanceSchema).default([]),
  infraNodes: z.array(InfraNodeSchema).default([]),
  networkDevices: z.array(NetworkDeviceSchema).default([]),
  cameras: z.array(CameraSchema).default([]),
  quickLinks: z.array(QuickLinkSchema).default([]),
  /** v8: boards for multi-board support */
  boards: z.array(BoardSchema).default([]),
  /** v8: sections within boards */
  sections: z.array(SectionSchema).default([]),
  /** v10: header search configuration */
  search: SearchConfigSchema.default({}),
  integrations: z.object({
    unraid: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          endpoint: z.string().min(1),
          apiKey: z.string(),
        })
      )
      .default([]),
    homeAssistant: z
      .object({
        baseUrl: z.string().optional(),
        token: z.string().optional(),
        esphomeGroupEntity: z.string().optional(),
        zigbee2mqttGroupEntity: z.string().optional(),
      })
      .default({}),
    adguard: z
      .object({
        baseUrl: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .default({}),
    unifi: z
      .object({
        controllerUrl: z.string().optional(),
        apiKey: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        authMode: z.enum(["apiKey", "session"]).default("apiKey"),
        siteId: z.string().default("default"),
        verifyTls: z.boolean().default(false),
        showWan: z.boolean().default(true),
        showClients: z.boolean().default(true),
        showDevices: z.boolean().default(true),
        showSwitchPorts: z.boolean().default(false),
      })
      .default({}),
    unifiProtect: z
      .object({
        enabled: z.boolean().default(false),
        baseUrl: z.string().optional(),
        apiKey: z.string().optional(),
        verifyTls: z.boolean().default(false),
      })
      .default({}),
    glances: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          baseUrl: z.string().url(),
          username: z.string().optional(),
          password: z.string().optional(),
          verifyTls: z.boolean().default(false),
        })
      )
      .default([]),
    portainer: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          baseUrl: z.string().optional(),
          apiKey: z.string().optional(),
          endpointId: z.number().int().default(1),
          verifyTls: z.boolean().default(false),
        })
      )
      .default([]),
    uptimeKuma: z
      .object({
        baseUrl: z.string().optional(),
        statusPageSlug: z.string().optional(),
      })
      .default({}),
    pihole: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          baseUrl: z.string().optional(),
          apiToken: z.string().optional(),
        })
      )
      .default([]),
    speedtest: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          baseUrl: z.string().optional(),
          bearerToken: z.string().optional(),
        })
      )
      .default([]),
    weather: z
      .object({
        enabled: z.boolean().default(false),
        latitude: z.number().default(0),
        longitude: z.number().default(0),
        locationName: z.string().default(""),
        unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
        refreshIntervalMin: z.number().int().min(5).default(15),
      })
      .default({}),
    frigate: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          baseUrl: z.string().optional(),
          username: z.string().optional(),
          password: z.string().optional(),
          authMode: z.enum(["none", "jwt"]).default("none"),
        })
      )
      .default([]),
    zigbee2mqtt: z
      .object({
        enabled: z.boolean().default(false),
        source: z.enum(["auto", "ha", "mqtt"]).default("auto"),
        haGroupEntity: z.string().optional(),
        mqttUrl: z.string().optional(),
        mqttUsername: z.string().optional(),
        mqttPassword: z.string().optional(),
        mqttTopicPrefix: z.string().default("zigbee2mqtt"),
      })
      .default({}),
    customRest: z
      .object({
        allowPrivateNetworks: z.boolean().default(true),
        allowedHosts: z.array(z.string()).default([]),
      })
      .default({}),
    /** v12: direct ESPHome REST API instances (replaces HA group entity bridge) */
    esphome: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          baseUrl: z.string(),
          password: z.string().optional(),
          enabled: z.boolean().default(true),
        })
      )
      .default([]),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
