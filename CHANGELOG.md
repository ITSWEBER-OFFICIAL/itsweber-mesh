# Changelog

All notable changes to ITSWEBER Mesh are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] — 2026-04-29 — First public release

This is the first version published on GitHub. The 1.x series before this
was developed in a private repository; the consolidated history is
preserved below for reference.

### Added

- Route-based top navigation: `/` (home), `/services` (full launcher),
  `/admin`. Replaces the previous filter-tabs-on-home approach.
- Pinned-to-home services: a per-service `pinnedToHome` flag controls
  whether a service appears in the new "Häufig genutzt" home section,
  with a category filter that narrows visible cards.
- Schema migration v16 → v17 covering both changes (additive, lossless).
- Public-release documentation: top-level `README.md` / `README.de.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, GitHub issue templates and CI
  workflows.

### Changed

- Top-level navigation no longer reads `layout.tabs[]`; that field is
  removed during the v17 migration.
- The home page renders the pinned-services section above the regular
  board grid; the full service launcher moved to its own route.

### Licensing

- Project license is GNU Affero General Public License v3.0 (AGPL-3.0).
  Self-hosting for personal or internal use is unaffected; running a
  modified version as a network service triggers the source-availability
  obligation in AGPL §13.

## [1.4.7] — 2026-04-28

### Fixed

- ESPHome v3 Server-Sent-Events streaming now uses `node:http` directly
  instead of `fetch()`. The Next.js Node runtime buffers SSE responses
  when called via `fetch`, so v3 devices never streamed updates.
- Zigbee2MQTT auto-source now correctly falls back to auto-discovery
  when the Home-Assistant group entity is empty.

### Added

- SmartHome widget redesign: hero header, KPI tiles, progress bars,
  count tiles. New `shw-` CSS namespace.
- Z2M form: `auto` is the default source; the legacy HA-group field is
  collapsed under "Legacy".

## [1.4.6] — 2026-04-28

### Added

- Zigbee2MQTT auto-discovery via Home Assistant Template API — no manual
  group setup required.
- ESPHome v3 SSE probe (initial implementation; finalised in 1.4.7).
- Schema v16: `integrations.zigbee2mqtt.source`.

## [1.4.5] — 2026-04-28

### Changed

- Header search is now a centred Radix modal with a flex shell instead
  of `transform: translate(-50%, -50%)`, which collided with Radix.
- Wide widget defaults reduced from `w: 24` to `w: 12` on a 24-column
  grid.
- Z2M / ESPHome group fields collapsed under a "Legacy" disclosure.

## [1.4.3] — 2026-04-28

### Changed

- Layout grid moved from 12 × 80 to **24 × 20** with an 8 px gap. Every
  widget, service, infra node and camera now carries an explicit
  `gridLayout: {x, y, w, h, minW, minH, maxW?, maxH?}`.
- Drag, resize, collision and vertical compaction handled by
  `react-grid-layout/legacy` (`Responsive` + `WidthProvider`).
- Edit-mode: dedicated drag handle (`.rgl-drag-handle`) and explicit
  resize handles on `e / w / s / se / sw`.

### Fixed

- Persistent "save" bug in edit-mode where layout edits would not always
  commit on cancel/save transitions.

## [1.4.1] — 2026-04-28

### Security

- **OIDC session forgery (high)** — the previous OIDC strategy accepted
  a `mesh_session` cookie of the form `oidc|sub|name|admin` without any
  signature verification. Anyone could mint a cookie and authenticate as
  admin. Replaced with HS256-signed JWTs (`jose`).
- Mandatory `MESH_SESSION_SECRET` (≥ 32 chars) enforced at boot in
  `instrumentation.ts`. Server refuses to start with `auth.mode=oauth2`
  if the secret or required OIDC config is missing or incomplete.
- Open-redirect hardening: `safeRedirectTarget` rejects backslashes,
  control characters, `//` prefixes and any URL whose resolved origin
  differs from the app's own.

### Added

- Generic OIDC support (`openid-client@6` + `jose@6`) — PKCE, state,
  nonce, JWKS validation, group-claim → role mapping. Routes:
  `/api/auth/oidc/{start, callback, logout}`.
- Help / FAQ CRUD (`helpItemsRouter` + 7 default items, editable in
  Admin).
- Background-pattern toggle (Schema v13).
- "Add widget" modal, board-switcher empty-state, and a global
  `:focus-visible` ring + scrollbar styling.

### Changed

- Project relicensed to **AGPL-3.0**.
- ESLint upgraded to v9 flat config.
- Vitest upgraded to 4.1.5; 42 tests cover the OIDC flow including
  forged cookies, tampered HMAC, `alg: none` confusion, expired tokens,
  state mismatch, and open-redirect variants.

## [1.4.0] — 2026-04-28

### Added

- ESPHome direct REST integration (Schema v12). Multi-instance,
  optional Basic-Auth, 5 s timeout per device.
- ESPHome widget supports three modes: `direct` (REST), `ha` (legacy HA
  group bridge), `auto` (probes `/direct`, falls back to legacy).
- `/api/widgets/esphome/direct` route returning device info + sensor /
  binary-sensor / text-sensor lists in parallel.

## [1.3.0] — 2026-04-28

### Added

- Multi-board UI: header `BoardSwitcher` (Radix DropdownMenu),
  `/boards/[slug]` server component, per-board filtering across
  services, widgets, infra-nodes and cameras.

## [1.2.0] — 2026-04-28

### Added

- Widget registry sizing API: `defaultSize`, `minSize`, `maxSize`,
  `wideThreshold`, `supportsCompact`. Widgets render their wide layout
  when `gridLayout.w >= wideThreshold ?? 16`.

## [1.1.0] — 2026-04-28

### Added

- React-grid-layout based grid engine: drag, resize and persistence
  in `config.json`.

## [1.0.0] — 2026-04-28

### Added

- First production-ready release: Next.js 15, tRPC v11, Tailwind v4,
  pluggable auth (open / token / username-password), JSON config with
  zod schema and migration chain, in-process healthcheck scheduler,
  19 widget kinds, 11 integrations, 7 themes, custom CSS, command
  palette, first-run wizard.

## Earlier (0.x)

The 0.x series covered the initial private development:

- 0.6.x — branding cleanup, theme polish, footer brand logos, Unraid
  widget multi-select, integration fixes, storage-bug fix.
- 0.5.x — full widget catalog, custom-REST widget, multi-instance
  integrations, UniFi Protect, Portainer wide layout, drag-and-drop
  layout.
- 0.4.x — UI polish, additional widgets and the integration catalog.

A detailed historical roadmap is preserved internally for reference;
the public history starts with [1.5.1].
