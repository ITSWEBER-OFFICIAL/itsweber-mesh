# Architecture — ITSWEBER Mesh

## Overview

Single Next.js 15 monolithic app, deployed as a single container on an Unraid host.
JSON-config-driven so non-developers can administer everything via the web UI.
Read-only mounts to host services (`/var/run/unraid-api.sock`) for live data; everything
else is a configurable HTTP/HTTPS REST or GraphQL integration.

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (mesh.example.com)                                      │
│  - React 19 SPA shell (Next.js App Router)                       │
│  - tRPC client + React Query                                     │
│  - Radix UI primitives + custom CSS theme                        │
└──────────┬───────────────────────────────────────────────────────┘
           │ HTTP/HTTPS
┌──────────▼───────────────────────────────────────────────────────┐
│  Next.js Server (port 3000, container itsweber-mesh)             │
│  ┌────────────────────┐  ┌──────────────────────────────────┐    │
│  │ tRPC Routers       │  │ Widget API Routes (REST)         │    │
│  │ - services         │  │ - /api/widgets/unraid            │    │
│  │ - status           │  │ - /api/widgets/glances           │    │
│  │ - settings         │  │ - /api/widgets/smart-home        │    │
│  │ - integrations     │  │ - /api/widgets/network           │    │
│  │ - widgets          │  │ - /api/widgets/adguard           │    │
│  │ - infraNodes       │  │ - /api/widgets/unifi             │    │
│  │ - networkDevices   │  │ - /api/widgets/homeassistant     │    │
│  │ - quickLinks       │  │ - /api/health                    │    │
│  └────────────────────┘  └──────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Config Store (proper-lockfile + zod + migration chain)     │  │
│  │ /data/config.json (mounted from /mnt/user/appdata/...)     │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Healthcheck Scheduler (in-process, p-limit 8, 10s)         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────┬───────────────────────────────────────────────────────┘
           │
   ┌───────┼───────┬───────────┬──────────┬──────────┬───────────┐
   ▼       ▼       ▼           ▼          ▼          ▼           ▼
unraid- HA REST Glances   AdGuard /control  UniFi    NPM        ...
api.sock /api    /api/4    /control/stats   /proxy/  http(s)
(unix)   token   basic-au  basic-auth        network  ping
```

## Directory layout

```
ITSWEBER Home Dashboard/
├── apps/web/                          — Next.js app
│   ├── src/
│   │   ├── app/                       — Routes (server + client components)
│   │   │   ├── page.tsx               — Dashboard
│   │   │   ├── layout.tsx             — Root layout, custom-css injection
│   │   │   ├── globals.css            — All non-tailwind CSS (theme tokens, modals, widgets)
│   │   │   ├── admin/                 — Admin pages (one per resource type)
│   │   │   └── api/                   — REST handlers (widgets) + tRPC mount
│   │   ├── components/
│   │   │   ├── ui/                    — Modal (Radix wrapper), Toast
│   │   │   ├── layout/                — DashboardHeader/Footer, LiveClock, SystemBadge
│   │   │   ├── infra/                 — InfraNodeGrid + InfraNodeCard
│   │   │   ├── services/              — ServiceGrid + ServiceCard + StatusDot
│   │   │   ├── widgets/               — One file per widget kind + WidgetSidebar dispatcher
│   │   │   └── providers.tsx          — tRPC + QueryClient + ToastProvider
│   │   ├── server/
│   │   │   ├── config/                — schema.ts, store.ts, defaults.ts, migrations.ts
│   │   │   ├── healthcheck/           — pinger.ts, scheduler.ts
│   │   │   ├── trpc/                  — init.ts, root.ts, routers/*.ts
│   │   │   └── logger.ts              — pino
│   │   └── lib/                       — trpc-client.ts
│   └── package.json
├── packages/theme/                    — CSS-token build pipeline (primitives/presets)
├── docker/Dockerfile                  — Multi-stage Alpine, USER root (Socket-Mount)
├── docker/entrypoint.sh
├── docs/                              — ARCHITECTURE.md, ROADMAP.md, INTEGRATIONS.md, screenshots/
├── .github/                           — Issue templates, PR template, CI workflow
├── CHANGELOG.md  README.md  CONTRIBUTING.md  SECURITY.md  LICENSE
└── pnpm-workspace.yaml + turbo.json
```

## Data flow

### Read path (Widget update cycle)

1. Browser opens `/`
2. `WidgetSidebar` queries `trpc.widgets.list` → which widget kinds + IDs to render
3. For each widget kind, the corresponding component issues a `useQuery` against
   the matching `/api/widgets/<kind>` route
4. The route reads `config.json`, picks the matching integration credentials, hits
   the upstream (Unraid GraphQL, HA REST, AdGuard /control/stats, …)
5. Response normalized to the widget's typed shape, returned as JSON
6. React Query caches per `refetchInterval` from the widget instance config

### Write path (Admin)

1. Admin form opens `<Modal>` (Radix Dialog)
2. Form submit → `trpc.<resource>.upsert` mutation
3. Mutation reads + patches `config.json` under `proper-lockfile`
4. On success: invalidates `trpc.<resource>.list` and fires `toast.success`
5. Browser re-renders with new data

### Unraid GraphQL transport selection

```
endpoint string ──► parseEndpoint() ──► Transport
─────────────────────────────────────────────────
"socket"                              ──► { kind: "socket", socketPath: "/var/run/unraid-api.sock" }
"unix:..." | "socket://..."           ──► same as above
"http://localhost(:port)?(/...)?"     ──► same as above
"http://127.0.0.1(:port)?(/...)?"     ──► same as above
"http://host:port" | "https://..."    ──► { kind: "http", host, port, protocol }
                                          (HTTPS uses rejectUnauthorized: false)
```

Every Unraid integration produces 4 calls in parallel:
- `QUERY_CORE` (mandatory) — online + info + array
- `QUERY_DOCKER` (optional, may fail) — container counts
- `QUERY_VMS` (optional, may fail — disabled on NODE) — VM counts
- `QUERY_SERVICES` (optional, may fail) — unraid-api / dynamic-remote-access status

`Promise.allSettled` ensures one failed sub-query never breaks the response.

## Schema (zod, version 17)

Current version: `CURRENT_VERSION = 17`. Migration chain (v1→v17, 16 steps) in
`migrations.ts` runs idempotently on every read; persists to disk on first read
after upgrade. Pre-migration backup written to `${DATA_DIR}/config.json.pre-v{N}`;
never overwrites an existing backup.

```ts
ConfigSchema = z.object({
  version: z.literal(17),

  meta: {
    name, locale: "de"|"en", subtitle,
    firstRunCompleted: boolean,         // v10
    githubUrl?: string,                 // v13
    migrationWarnings: string[],        // v13
    domain: string,                     // v14 — shown in Command Overview title
    commandOverviewSubtitle: string,    // v14
    quickActions: QuickAction[],        // v14 — { id, label, url, iconEmoji?, target, sortOrder }
  },

  theme: {
    preset: "dark"|"light"|"terminal"|"itsweber"|"slate"|"modern-light"|"graphite-command",
    accent: string,          // hex color, e.g. "#3ba7a7"
    background: { kind: "solid" } | { kind: "gradient" } | { kind: "image", src: string },
    backgroundPattern: "none"|"mesh"|"dots"|"stripes",  // v13
    customCss: string,
  },

  // v17: layout.tabs[] removed — navigation is now route-based (/, /services, /admin)
  layout: {
    showQuickAccess: boolean,
    showSystemBadge: boolean,
    serviceCardShowCategory: boolean,
    showCommandOverview: boolean,       // v14
  },

  auth: {
    mode: "open"|"token"|"userPassword"|"oauth2",
    users: {                           // v9: UUID, role, createdAt, lastLogin
      id, username, email?, passwordHash, role: "admin"|"editor"|"viewer",
      createdAt, lastLogin?,
    }[],
    oauth2: {
      issuerUrl?, clientId?, clientSecret?, scopes,
      adminGroupClaim?, adminGroupValues, editorGroupValues,  // v13
      fallbackRole: "admin"|"editor"|"viewer",                // v13
      providerLabel?, callbackPath?,                          // v10
      autoCreateUsers, userMapping,                           // v10
    },
  },

  helpItems: FaqItem[],               // v13 — { id, question, answer, sortOrder }

  // v8: all items carry boardId + gridLayout (24-col × 20px-row react-grid-layout)
  boards: { id, slug, name, icon?, isHome, layout: "flat"|"sections", sortOrder }[],
  sections: { id, boardId, title, collapsed, sortOrder }[],
  services: {
    id, name, description?, url, category, icon, color?,
    pingTarget: { kind: "http"|"tcp"|"none", url?, host?, port?, expectStatus, timeoutMs },
    sortOrder, enabled, boardId, gridLayout,
    pinnedToHome: boolean,            // v17 — shown in "Häufig genutzt" on home route
  }[],
  widgetInstances: {
    id, kind: WidgetKind, label, enabled, refreshSec, sortOrder,
    settings: Record<string, unknown>, linkUrl?,
    boardId, gridLayout,
    // WidgetKind (19): unraid|homeassistant|adguard|unifi|smartHome|network|storage|
    //   glances|portainer|uptimeKuma|speedtest|pihole|cameras|weather|esphome|
    //   zigbee2mqtt|unifiProtect|frigate|customRest
  }[],
  infraNodes: {
    id, label, kind: "unraid"|"generic", ip?, linkUrl?, versionOverride?,
    primary, badge, chips, iconEmoji,
    integrationRef: { kind: "unraid", id } | null,
    glancesRef: { kind: "glances", id } | null,
    sortOrder, enabled, boardId, gridLayout,
  }[],
  networkDevices: { id, label, sub?, iconEmoji, url?, healthCheck, sortOrder, enabled, boardId }[],
  cameras: { id, label, snapshotUrl, linkUrl?, refreshSec, sortOrder, enabled, boardId, gridLayout }[],
  quickLinks: { id, label, url, iconEmoji, target: "_blank"|"_self", sortOrder, enabled }[],
  search: { engines: SearchEngine[], defaultEngineId?, localFirst },  // v10

  integrations: {
    unraid: { id, label, endpoint, apiKey }[],
    homeAssistant: { baseUrl?, token?, esphomeGroupEntity?, zigbee2mqttGroupEntity? },
    adguard: { baseUrl?, username?, password? },
    unifi: { controllerUrl?, apiKey?, username?, password?, authMode, siteId, verifyTls,
             showWan, showClients, showDevices, showSwitchPorts },
    unifiProtect: { enabled, baseUrl?, apiKey?, verifyTls },
    glances: { id, label, baseUrl, username?, password?, verifyTls }[],
    portainer: { id, label, baseUrl?, apiKey?, endpointId, verifyTls }[],
    uptimeKuma: { baseUrl?, statusPageSlug? },
    pihole: { id, label, baseUrl?, apiToken? }[],
    speedtest: { id, label, baseUrl?, bearerToken? }[],
    weather: { enabled, latitude, longitude, locationName, unit, refreshIntervalMin },
    frigate: { id, label, baseUrl?, username?, password?, authMode: "none"|"jwt" }[],
    zigbee2mqtt: { enabled, source: "auto"|"ha"|"mqtt", haGroupEntity?,
                   mqttUrl?, mqttUsername?, mqttPassword?, mqttTopicPrefix },
    esphome: { id, label, baseUrl, password?, enabled }[],  // v12
    customRest: { allowPrivateNetworks, allowedHosts },
  },
})
```

GridLayout schema: `{ x, y, w, h, minW, minH, maxW?, maxH? }` — 24-column grid,
20 px row height, 8 px gap. All grid-placed items (services, widgets, infraNodes,
cameras, networkDevices) carry a `gridLayout` field.

## Modal architecture (CRITICAL — don't reinvent)

`components/ui/Modal.tsx` is a thin wrapper around `@radix-ui/react-dialog`.

**Why Radix:**
- Renders into `document.body` via Portal — no parent-stacking-context bugs
- Built-in focus trap, ESC handling, scroll lock, ARIA
- Stable across browsers / mobile / RTL

**Layout:**
- `.modal-overlay` — fixed full-viewport, blurred backdrop
- `.modal-shell` — fixed-positioned, `transform: translate(-50%, -50%)` for bulletproof centering, `max-height: calc(100dvh - 32px)`, `display: flex; flex-direction: column`
- Direct children: `<ModalHeader>` (flex-shrink 0), `<form className="modal-form-shell">` (flex 1) which contains `<ModalBody>` (flex 1, overflow-y auto) and `<ModalFooter>` (flex-shrink 0)

**Sizes:** sm 440 / md 560 / lg 720 / xl 920 px (var `--modal-w`).

## Integration capability matrix

| Integration | Schema | API route | Widget UI | Admin form | Live-tested |
|---|---|---|---|---|---|
| Unraid | ✅ multi | ✅ split-queries | ✅ via InfraNode + Storage | ✅ Connection-Type-Toggle | ✅ CORE+NODE |
| Home Assistant | ✅ | ✅ + smart-home extra | ✅ HaWidget + SmartHomeWidget | ✅ | ✅ |
| AdGuard | ✅ | ✅ num_*-fields | ✅ AdguardWidget | ✅ | ✅ |
| UniFi | ✅ | ✅ /proxy/network | ✅ UnifiWidget | ✅ + siteId+TLS | ⚠ no key set |
| Glances | ✅ multi | ✅ Promise.allSettled | ✅ GlancesWidget + InfraNode-Live-CPU | ✅ | ⚠ no host set |
| Portainer | ✅ multi | ✅ | ✅ PortainerWidget (sidebar + wide) | ✅ | ✅ NODE |
| Uptime Kuma | ✅ | ✅ | ✅ UptimeKumaWidget | ✅ | ✅ |
| Pi-hole | ✅ multi | ✅ | ✅ PiholeWidget | ✅ | ✅ |
| Speedtest Tracker | ✅ multi | ✅ | ✅ SpeedtestWidget | ✅ | ✅ |
| UniFi Protect | ✅ | ✅ /proxy/protect/v1 | ✅ UnifiProtectWidget (sidebar + wide) | ✅ | ✅ |
| Frigate | ✅ multi | ✅ | ✅ FrigateWidget | ✅ | ⚠ no host set |
| Custom REST | ✅ | ✅ JSONPath proxy | ✅ CustomRestWidget | ✅ inline config | ✅ |

## Widget dual-layout pattern

Widgets that support both sidebar and center/full-width slots must implement
two distinct layouts based on where they are placed. The correct way to detect
this in the component:

```tsx
const wide = instance.slot !== "sidebar-right";
```

**Do NOT use `compact` for this decision.** The `compact` prop is `false` when
`display === "full"`, so using it would break full-width layouts.

### Sidebar layout (`!wide`)

- Compact vertical list / row-per-item
- Fixed `max-height` with `overflow-y: auto` is acceptable
- Small thumbnails (72×40) or dense text rows

### Wide layout (`wide`) — center slots, full-width slots

- No `overflow-y: auto` / no scrollbars — show all items
- Responsive grid via `grid-template-columns: repeat(auto-fill, minmax(Xpx, 1fr))`
- No fixed `max-height`
- Stack/group sections as horizontal pill bars, not sidebar columns

### Implemented examples

| Widget | Sidebar | Wide |
| --- | --- | --- |
| UnifiProtectWidget | `protect-cam-list` — vertical rows with 72×40 thumbs | `protect-cam-grid` — responsive 260–320px tile grid |
| PortainerWidget | vertical container list with `max-height: 240px` scroll | `portainer-container-grid` — 160px min tile grid, stacks as pill bar |

### Registry entry

Set `supportsCompact: true` for widgets that have a working wide layout.
Do NOT rely on `compact` in the component — always use `instance.slot !== "sidebar-right"`.

## Auth system (v1.4.1, pluggable)

Four modes, configured in `server/auth/index.ts` via Strategy Pattern.

| Mode | Description |
| --- | --- |
| `open` | No auth — all requests pass |
| `token` | ENV `ADMIN_TOKEN` → Cookie `mesh_session` (opaque string) |
| `userPassword` | bcrypt-hashed users in config, Session-Cookie `username\|hash` |
| `oauth2` | OIDC via `openid-client@6` + `jose@6`, PKCE + State + Nonce, HS256-signed JWT Session |

### OIDC flow (oauth2 mode)

1. `/api/auth/oidc/start` — PKCE + State + Nonce in HMAC-signed HttpOnly Cookie (5 min) → IDP redirect
2. `/api/auth/oidc/callback` — State verify, code exchange, JWKS validation, Userinfo, Role-Mapping → signed `mesh_session` JWT (24h)
3. `/api/auth/oidc/logout` — Clears cookie + optional RP-initiated end-session

**Key files:**

- `server/auth/oidc-session.ts` — HS256 JWT sign/verify helpers via `jose`
- `server/auth/oidc-client.ts` — `openid-client` v6 wrapper, Discovery cache (1h), PKCE helpers
- `server/auth/oidc-redirect.ts` — `safeRedirectTarget`: blocks backslash, control-chars, origin-mismatch
- `app/api/auth/oidc/{start,callback,logout}/route.ts` — three OIDC API routes

**Pflicht-ENV:** `MESH_SESSION_SECRET` (≥32 chars) — Bootstrap hard-blocks if oauth2 mode without it.

**Tests:** 6 Vitest suites, 42 tests — `tests/auth/oidc-*.test.ts` cover forged cookies, HMAC tampering, algorithm confusion, expiry, wrong audience, mode-without-config, state mismatch, open-redirect variants.

## Known limits / decisions

- **No mDNS in container.** Use IP addresses or real DNS for any HTTP-based integration endpoint.
- **AdGuard `dns_queries` / `blocked_filtering` are 24h-arrays**, not totals. Use `num_*` scalar fields.
- **`unraid-api start --port` does not exist** in v7.2 CLI. Remote access uses the WebGUI port itself (e.g. `http://192.168.1.15:1580/graphql`).
- **`exactOptionalPropertyTypes: true`** in tsconfig — `T | undefined` properties must be declared, not just optional.
- **Container runs as root** — required for `/var/run/unraid-api.sock` (mode 750).
- **Standalone build on Windows fails** with EPERM symlink errors. We always build inside the Linux Docker context on Unraid.
- **Browser cache on CSS/JS is sticky** — F5 (hard reload Strg+F5) after deploys.
