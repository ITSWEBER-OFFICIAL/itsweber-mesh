# Architektur (für Hacker)

Wie Mesh innen aufgebaut ist. Falls du PRs machen willst, eigene Widgets baust oder einfach neugierig bist.

## High-Level

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Next.js Client)              │
│  React 19 · Tailwind v4 · Radix UI · React Query v5      │
└──────────────────┬───────────────────────────────────────┘
                   │ tRPC v11 (HTTP) + JSON
┌──────────────────▼───────────────────────────────────────┐
│                  Next.js Server (Node 22)                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ tRPC Router       Auth Strategy    Healthcheck    │  │
│  │ /api/widgets/*    open/token/      Scheduler      │  │
│  │                   userPwd/oauth2   p-limit(8)     │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Config Store: zod + proper-lockfile + Migrations   │  │
│  └────────────────────────────────────────────────────┘  │
└─────┬─────────┬──────────┬──────────┬─────────┬─────────┘
      │         │          │          │         │
      ▼         ▼          ▼          ▼         ▼
   /data/    Glances   HomeAssistant UniFi   Portainer …
config.json   :61208    REST + Token  API     API-Key
```

## Ordner-Struktur

```
apps/web/
├── src/
│   ├── app/                  ← Next.js App Router (Routen + Pages)
│   │   ├── page.tsx          ← Dashboard /
│   │   ├── services/         ← /services
│   │   ├── boards/[slug]/    ← /boards/<slug>
│   │   ├── admin/            ← Admin-Section
│   │   └── api/widgets/      ← Server-Side Widget-Endpoints
│   ├── components/
│   │   ├── layout/           ← DashboardHeader, EditModeBar, …
│   │   ├── services/         ← ServiceGrid, ServicesBrowser, PinnedSection
│   │   ├── widgets/          ← 19 Widget-Components + registry.tsx
│   │   ├── infra/            ← InfraNodeGrid, InfraNodeCard
│   │   ├── grid/             ← BoardGrid (react-grid-layout)
│   │   └── ui/               ← Modal, Toast, SortableList, …
│   ├── server/
│   │   ├── config/           ← schema.ts, migrations.ts, store.ts, defaults.ts
│   │   ├── auth/             ← Strategy-Pattern für 4 Modi
│   │   ├── healthcheck/      ← Scheduler + Pinger
│   │   └── trpc/             ← Router + Procedures
│   └── hooks/                ← useLocalSearch, useEditMode, …
├── public/                   ← Static Assets (Logos, Brand-PNG)
└── package.json
```

## Datenfluss am Beispiel: ein Glances-Widget

1. **User öffnet Dashboard** → Next.js rendert `app/page.tsx` server-side
2. **Hydration** → Client mounted React, React Query startet Polls
3. **Widget mounted** → `useQuery` auf `trpc.widgets.glances.list`
4. **tRPC-Procedure** auf dem Server → liest `config.integrations.glances[]`
5. **Pro Glances-Instanz** → `fetch('http://glances-host:61208/api/4/all')`
6. **Response** zusammengefasst → JSON zurück an Client
7. **React Query** cacht, nach `refreshSec` neuer Poll

## Schema-Schicht

`zod` ist der Single-Source-of-Truth:

- `ConfigSchema` (`schema.ts`) definiert die ganze Form
- TypeScript-Types via `z.infer<typeof ConfigSchema>`
- Bei jedem `writeConfig`: Schema-Validation
- Bei jedem `readConfig`: Schema-Parse + Migration-Chain

`config.json` wird mit `proper-lockfile` synchronisiert (atomares Schreiben, OS-File-Lock). Wichtig im Standalone-Build: in `next.config.mjs` muss `proper-lockfile` als `serverExternalPackages` gelistet sein.

## React Query als Live-Layer

Kein WebSocket, kein SSE (Browser-Side). Alles ist Polling über tRPC mit:

- `refetchInterval` (default 10–60 s je Widget)
- `refetchOnWindowFocus: true`
- `staleTime` knapp unter `refetchInterval`

Dadurch gibt's keinen Sticky-State zwischen Tabs, keine WebSocket-Probleme hinter Reverse-Proxies, kein Auth-State im Socket.

Ausnahme: ESPHome v3 nutzt server-side SSE (`node:http`) — aber als One-shot-Probe, nicht als Browser-Stream.

## Widget-Registry

`apps/web/src/components/widgets/registry.tsx` ist der Single-Point of:

- `kind`-String → `Component`
- `defaultSize` / `minSize` / `maxSize` (24×20-Grid)
- `wideThreshold` — ab welcher Spaltenanzahl der Wide-Layout zeigt
- `supportsCompact` — kann das Widget eine Mini-Kachel-Variante?

Eigenes Widget hinzufügen:

1. `apps/web/src/components/widgets/MyWidget.tsx` schreiben (Props: `WidgetRenderProps`)
2. In `registry.tsx` einen Eintrag mit `kind`, `displayName`, etc. ergänzen
3. Im `WidgetKind`-Enum (`schema.ts`) den neuen Kind ergänzen
4. Schema-Bump nicht nötig — neue Widget-Instanzen können einfach den neuen `kind` nutzen

## Auth-Schicht

`apps/web/src/server/auth/index.ts` exportiert `getAuthStrategy(mode)`. Jede Strategy implementiert:

```ts
interface AuthStrategy {
  isPublicRoute(path: string): boolean;
  authenticate(req: Request): Promise<{ user?: AuthUser, role: Role }>;
}
```

Routes prüfen via `adminProcedure` (tRPC Middleware). OAuth2-Strategy nutzt `openid-client@6` + `jose@6` für JWKS-Validierung.

## Tests

42+ Vitest-Tests. Organisiert pro Layer:

- `tests/auth/` — OIDC-Flow, Group-Mapping, JWT-Validation
- `tests/healthcheck/` — Pinger-Logik
- `tests/migrations/` — Migration-Chain-Roundtrip

## Build

Multi-Stage Dockerfile:

1. `deps` — pnpm install
2. `build` — `pnpm build` (Next.js Standalone-Output)
3. `runtime` — copy `.next/standalone` + `.next/static` + `public` + entrypoint

Standalone-Output bündelt alle Dependencies — der Final-Container hat KEIN `node_modules/`.

## Roadmap-Ideen

- **WebSocket optional** für unter 1 s Live-Updates (heute: 10 s Polling)
- **Plugin-Architektur** mit dynamischem Widget-Loading aus separaten Repos
- **Federated Boards** über mehrere Mesh-Instanzen via Tailscale/WireGuard
