# ITSWEBER Mesh — Wiki-Inhalte

> Diese Markdown-Dateien sind **Quell-Inhalte** für das spätere Wiki-Plugin
> auf itsweber.de. Sie folgen einer klaren Nummerierung: 0x = Setup,
> 1x = Konzepte, 2x = Integrationen pro Stück, 9x = Operations/Troubleshoot.
>
> Beim Import ins CMS-Wiki werden die `# H1`-Überschriften zu Seiten-Titeln,
> die Pfade in der Sidebar-Reihenfolge übernommen.

## Setup & Erste Schritte

| Datei                           | Zweck                                              |
|---------------------------------|----------------------------------------------------|
| `01-quick-start.md`             | TL;DR — von 0 zu laufendem Dashboard in 5 Minuten   |
| `02-docker-installation.md`     | Docker / docker-compose ausführlich                |
| `03-unraid-installation.md`     | Community-Apps-Variante mit Edit-Container-Guide   |
| `04-first-run-wizard.md`        | Was der First-Run-Wizard abfragt + warum           |

## Konzepte

| Datei                           | Zweck                                              |
|---------------------------------|----------------------------------------------------|
| `10-services-vs-widgets.md`     | Wann nehme ich was?                                |
| `11-boards.md`                  | Multi-Board-Setup — Räume / Themen trennen          |
| `12-themes.md`                  | 7 Presets, Akzentfarbe, Custom CSS                  |
| `13-auth-modes.md`              | open / token / userPassword / OAuth2 — Unterschiede |
| `14-healthchecks.md`            | Wie der Status-Indikator funktioniert               |
| `15-search-command-palette.md`  | Strg + K — lokale Treffer + Web-Engines             |

## Integrationen (eine pro Stück)

| Datei                           | Integration                                        |
|---------------------------------|----------------------------------------------------|
| `21-home-assistant.md`          | Home Assistant + Smart-Home-Widget                  |
| `22-glances.md`                 | Glances — Live-Server-Stats für InfraNodes           |
| `23-adguard-home.md`            | AdGuard Home                                        |
| `24-pihole.md`                  | Pi-hole (Multi-Instance)                            |
| `25-unifi-network.md`           | UniFi Network (Controller / UDM Pro)                |
| `26-unifi-protect.md`           | UniFi Protect (Kameras)                             |
| `27-portainer.md`               | Portainer — Container-Übersicht                     |
| `28-frigate.md`                 | Frigate — Event-Stream + Snapshots                  |
| `29-esphome.md`                 | ESPHome im Direct-Modus (v3 SSE / v2 REST)          |
| `30-zigbee2mqtt.md`             | Zigbee2MQTT — Auto-Discovery via HA, MQTT v1.7+     |
| `31-uptime-kuma.md`             | Uptime Kuma — Status-Page                           |
| `32-speedtest.md`               | Speedtest-Tracker                                   |
| `33-weather.md`                 | Wetter (Open-Meteo, kein API-Key)                   |
| `34-custom-rest.md`             | Custom REST — beliebige JSON-Endpoints              |

## Operations

| Datei                           | Zweck                                              |
|---------------------------------|----------------------------------------------------|
| `90-backups-migrations.md`      | Schema-Migrations + Backup-Strategie                |
| `91-troubleshooting.md`         | Häufige Probleme + Lösungen                          |
| `92-architecture.md`            | Wie Mesh innen aufgebaut ist (für Hacker)            |

## Stand

Aktuell sind die folgenden Dateien geschrieben (V1 — noch nicht final, vor
Wiki-Import gegenlesen):
