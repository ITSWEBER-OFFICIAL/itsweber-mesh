<div align="center">

# ITSWEBER Mesh

**Self-hosted Homelab-Dashboard** — Services, Widgets, Server-Stats, Smart-Home und Kameras an einem Ort.
Eine moderne Heimdall-Alternative, gebaut mit Next.js 15, tRPC und Tailwind v4.

[![Lizenz: AGPL-3.0](https://img.shields.io/badge/Lizenz-AGPL--3.0-3ba7a7.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-bereit-2ea3f2.svg)](#schnellstart)
[![Made by ITSWEBER](https://img.shields.io/badge/by-itsweber.de-2ea3f2.svg)](https://itsweber.de)

[Schnellstart](#schnellstart) · [Funktionen](#funktionen) · [Konfiguration](#konfiguration) · [Architektur](#architektur)

🇬🇧 **Read in English** → [README.md](README.md)

</div>

---

## Screenshots

<details open>
<summary><strong>Dashboard</strong></summary>

![Dashboard mit Command Overview, Server-Karten und „Häufig genutzt"](docs/screenshots/01-dashboard-overview.png)
*Command Overview, Server-Karten mit Live-Glances-Daten und gepinnte Services mit Kategorie-Filter.*

![Widgets — Wetter, Speedtest, Glances, UDM, Home Assistant, Z2M, ESPHome](docs/screenshots/02-dashboard-widgets.png)
*Widget-Bereich — 19 Kinds verfügbar, frei anordnbar im 24×20-Grid.*

![Portainer-Widget mit Container-Liste](docs/screenshots/04-portainer-widget.png)
*Portainer-Widget — Running, Stopped, Paused inkl. Container-Chips.*

</details>

<details>
<summary><strong>Services-Route</strong></summary>

![Alle Services mit Kategorie-Filter und Suche](docs/screenshots/05-services-all.png)
*Alle Services im Überblick — Suche und Kategorie-Filter kombinierbar; Status live aus dem Healthcheck-Scheduler.*

</details>

<details>
<summary><strong>Kameras (UniFi Protect)</strong></summary>

![UniFi Protect Kamera-Snapshots](docs/screenshots/03-cameras-unifi-protect.png)
*UniFi Protect Snapshot-Proxy — kein RTSP-Gefrickel.*

</details>

<details>
<summary><strong>Command-Palette</strong></summary>

![Strg+K Command-Palette mit lokalen + Web-Treffern](docs/screenshots/06-command-palette-search.png)
*Strg + K — lokale Treffer (Services, Boards, Quick-Links, Widgets) plus konfigurierbare Web-Suchmaschinen.*

</details>

<details>
<summary><strong>Admin</strong></summary>

![Admin-Einstellungen](docs/screenshots/07-admin-settings.png)
*Admin-Startseite — Name, Sprache, Untertitel.*

![Server-Karten Admin](docs/screenshots/08-admin-server-cards.png)
*Server-Karten verwalten. Jede Karte ist mit einer Unraid- + Glances-Instanz verknüpft.*

![Netzwerk-Geräte Admin](docs/screenshots/09-admin-network-devices.png)
*Netzwerk-Geräte mit HTTP/TCP-Healthcheck — angezeigt im Netzwerk-Widget.*

![Auth-Konfiguration mit 4 Modi](docs/screenshots/10-admin-auth-config.png)
*Pluggable Auth — open / Token / User-Passwort / OAuth2 (PKCE, JWKS).*

![Theme-Presets — 7 vordefinierte](docs/screenshots/11-admin-theme-presets.png)
*7 vordefinierte Themes (Dark, Light, Terminal, ITSWEBER, Slate, Modern Light, Graphite Command).*

![Theme-Optionen — Muster, Akzent, Hintergrundbild](docs/screenshots/12-admin-theme-options.png)
*Akzentfarbe + Hintergrund-Muster + optionales Hintergrundbild pro Theme.*

![Custom-CSS-Editor](docs/screenshots/13-admin-custom-css.png)
*Custom-CSS einfügen — wird live angewendet, kein Rebuild nötig.*

![Such-Engines Admin](docs/screenshots/14-admin-search-engines.png)
*Web-Suchmaschinen für die Command-Palette konfigurieren.*

![Hilfe / FAQ Admin](docs/screenshots/15-admin-help-faq.png)
*Editierbare Hilfe/FAQ — Inhalt liegt in `config.json`, nicht im Code.*

![About-Seite](docs/screenshots/16-admin-about.png)
*Projekt-Identität, Tech-Stack, Copyright.*

</details>

## Funktionen

- **Service-Launcher** mit HTTP/TCP-Healthchecks (10 s Scheduler), Kategorie-Filter, „Häufig genutzt"-Section
- **Live-Server-Stats** via [Glances](https://nicolargo.github.io/glances/) — CPU / RAM / Array / Disk-I/O / Netzwerk
- **19 Widget-Kinds** für Home Assistant, AdGuard, UniFi, Pi-hole, Speedtest, ESPHome, Zigbee2MQTT, Frigate, Portainer, Uptime Kuma, Wetter, Custom REST und mehr
- **Multi-Board-Support** — eigene Dashboards pro Raum/Thema, drag-and-drop im 24×20 react-grid-layout
- **Pluggable Auth** — open / Token / User-Passwort / OAuth2 (PKCE, JWKS, Group → Role-Mapping)
- **Single Docker Container**, Alpine-basiert, ~120 MB. `/data` als Volume für Persistenz
- **Theme-System** — 7 Presets, Custom-CSS, Brand-Akzent override
- **First-Run-Wizard** + editierbare Hilfe/FAQ + Admin-Suche
- **Command-Palette** (Strg + K) — lokale Services + konfigurierbare Web-Suchmaschinen
- **Healthcheck-Scheduler** in-process (`p-limit(8)`) — kein externer Cron nötig
- **Glassmorphism-UI**, mobile-responsive, kein horizontales Overflow

## Schnellstart

### Docker (empfohlen)

```bash
# Session-Secret erzeugen (>= 32 Zeichen; bei Container-Replace WIEDERVERWENDEN!)
SESSION_SECRET=$(openssl rand -hex 32)

docker run -d \
  --name itsweber-mesh \
  --restart=unless-stopped \
  -p 3000:3000 \
  -e MESH_SESSION_SECRET="$SESSION_SECRET" \
  -v /dein/pfad/itsweber-mesh:/data \
  ghcr.io/itsweber-official/itsweber-mesh:latest
```

> ⚠️ Halte `MESH_SESSION_SECRET` über Container-Restarts hinweg stabil — sonst
> werden alle aktiven OIDC-Sessions invalidiert.

Öffne http://localhost:3000 — der First-Run-Wizard legt den Admin-User an.

### docker-compose

```yaml
services:
  mesh:
    image: ghcr.io/itsweber-official/itsweber-mesh:latest
    container_name: itsweber-mesh
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      MESH_SESSION_SECRET: ${MESH_SESSION_SECRET}   # >= 32 Zeichen
      DATA_DIR: /data
      PORT: "3000"
    volumes:
      - ./data:/data
      # Optional — nur wenn auf Unraid und native Unraid-Stats gewünscht:
      # - /var/run/unraid-api.sock:/var/run/unraid-api.sock:ro
```

### Aus Source-Code

```bash
git clone https://github.com/ITSWEBER-OFFICIAL/itsweber-mesh.git
cd itsweber-mesh
pnpm install
pnpm typecheck && pnpm test
pnpm dev          # http://localhost:3000
```

Eigenes Image bauen: `docker build -f docker/Dockerfile -t itsweber-mesh:dev .`

## Dokumentation

Schritt-für-Schritt-Guides liegen in [`docs/guide/`](docs/guide/README.md):

- **Erste Schritte** — [Quick Start](docs/guide/01-quick-start.md) ·
  [Docker-Installation](docs/guide/02-docker-installation.md) ·
  [Unraid-Installation](docs/guide/03-unraid-installation.md) ·
  [First-Run-Wizard](docs/guide/04-first-run-wizard.md)
- **Konzepte** — [Services vs. Widgets](docs/guide/10-services-vs-widgets.md) ·
  [Boards](docs/guide/11-boards.md) · [Themes](docs/guide/12-themes.md) ·
  [Auth-Modi](docs/guide/13-auth-modes.md) ·
  [Healthchecks](docs/guide/14-healthchecks.md) ·
  [Command-Palette](docs/guide/15-search-command-palette.md)
- **Integrationen** — [Übersicht](docs/guide/20-integrations-overview.md),
  dazu eine Seite pro Integration (Home Assistant, Glances, AdGuard, Pi-hole,
  UniFi, UniFi Protect, Portainer, Frigate, ESPHome, Zigbee2MQTT, Uptime
  Kuma, Speedtest, Wetter, Custom REST)
- **Operations** — [Backups & Migrationen](docs/guide/90-backups-migrations.md) ·
  [Troubleshooting](docs/guide/91-troubleshooting.md) ·
  [Architektur-Deep-Dive](docs/guide/92-architecture.md)

## Konfiguration

### Environment-Variablen

| Variable                | Default       | Beschreibung |
|-------------------------|---------------|--------------|
| `MESH_SESSION_SECRET`   | *(Pflicht)*   | Min. 32 Zeichen, signiert die Session-Cookies. **Über Restarts wiederverwenden.** |
| `PORT`                  | `3000`        | HTTP-Port, an den Next.js bindet |
| `DATA_DIR`              | `/data`       | Wo `config.json` und Backups liegen (als Volume mounten) |
| `NODE_OPTIONS`          | —             | z.B. `--max-old-space-size=512` für engen RAM |

### Persistierte Konfiguration

Alle UI-Änderungen landen in `${DATA_DIR}/config.json` (Zod-validiert,
`proper-lockfile`, Schema-Migrations-Chain). Vor jedem Schema-Bump wird ein
Backup unter `${DATA_DIR}/config.json.pre-v{N}` angelegt — überschreibt nie ein
existierendes Backup.

### Out-of-the-box Integrationen

Home Assistant · AdGuard Home · UniFi Network + Protect · Pi-hole · Glances ·
Portainer · Uptime Kuma · Speedtest-Tracker · Frigate · ESPHome · Zigbee2MQTT
(via HA Template Auto-Discovery) · OpenWeatherMap · Custom REST (jeder JSONPath).

Jede Integration wird in **Admin → Integrationen** konfiguriert — kein
`.env`-Hin und Her, kein YAML.

## Architektur

| Layer            | Technologie                                         |
|------------------|-----------------------------------------------------|
| Framework        | Next.js 15 (App Router, React 19), monolithisch     |
| RPC              | tRPC v11 + React Query v5 + superjson               |
| Sprache          | TypeScript 5.7 strict, `exactOptionalPropertyTypes` |
| Package-Manager  | pnpm 9.15 + Turborepo                               |
| Styling          | Tailwind v4, CSS-Variablen pro Theme                |
| Forms            | react-hook-form + Zod                               |
| Modal/Dialog     | Radix UI Dialog (kein Eigenbau)                     |
| Persistenz       | JSON `/data/config.json` + Zod + `proper-lockfile` + Migration-Chain |
| Logging          | pino (JSON, stdout)                                 |
| Container        | `node:22-alpine`, multi-stage, Standalone-Output    |

Detail-Architektur: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md) ·
Changelog: [`CHANGELOG.md`](CHANGELOG.md).

## Entwicklung

```bash
pnpm dev              # Next.js Dev-Server mit HMR
pnpm typecheck        # tsc --noEmit
pnpm test       # vitest (42+ Tests)
pnpm build            # Production-Build (Standalone)
pnpm lint             # ESLint
```

Die Codebasis erzwingt:

- **Keine privaten Daten im Core** — User-spezifisches gehört in `/data/config.json`
- **TypeScript strict** — `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
- **Modals nutzen Radix Dialog** — niemals selbst basteln
- **Schema-Bumps brauchen Migrations** — siehe `apps/web/src/server/config/migrations.ts`

## Roadmap

- [x] v1.x — Feature-komplettes Dashboard mit 19 Widget-Kinds und 11 Integrationen
- [x] v1.4.7 — ESPHome v3 SSE Streaming, Z2M Auto-Discovery
- [x] **v1.5.1** — Routen-basierte Navigation (`/`, `/services`, `/admin`),
      „Häufig genutzt"-Services, ITSWEBER-Theme Polish, erstes Public Release
- [ ] v1.6 — Glances-Erweiterungen (Load-Avg, Disk-I/O, GPU-Temps als InfraNode-Chips)
- [ ] v1.7 — Direktes MQTT für Z2M (kein HA-Proxy mehr nötig)
- [ ] v2.0 — OAuth2/Authentik produktionsreif, Unraid Community App Listing

## Sicherheit

Verantwortungsvolle Offenlegung: siehe [SECURITY.md](SECURITY.md).

## Beitragen

Issues, Feature-Requests und PRs willkommen — siehe [CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz

[AGPL-3.0](LICENSE) — Copyright © 2026 ITSWEBER.

Wer eine modifizierte Version als Netzwerk-Service betreibt, muss die
Modifikationen unter derselben Lizenz veröffentlichen (AGPL §13).
Self-Hosting für privaten oder internen Gebrauch ist davon nicht betroffen.

## Maintainer

Entwickelt von **[ITSWEBER](https://itsweber.de)**.

Issues, Feature-Requests und PRs willkommen — siehe [`CONTRIBUTING.md`](CONTRIBUTING.md).
