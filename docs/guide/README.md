# ITSWEBER Mesh — User Guide

Step-by-step documentation for installing, configuring and operating
ITSWEBER Mesh. Pages are numbered: `0x` = setup, `1x` = concepts,
`2x`–`3x` = integrations, `9x` = operations & troubleshooting.

> Looking for the high-level overview? Start at the project [README](../../README.md).
> Looking for the developer's perspective? See [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Setup & First Steps

| File | Purpose |
|---|---|
| [`01-quick-start.md`](01-quick-start.md) | TL;DR — from zero to a running dashboard in 5 minutes |
| [`02-docker-installation.md`](02-docker-installation.md) | Docker / docker-compose in detail |
| [`03-unraid-installation.md`](03-unraid-installation.md) | Community Apps variant with the Edit-Container guide |
| [`04-first-run-wizard.md`](04-first-run-wizard.md) | What the first-run wizard asks for and why |

## Concepts

| File | Purpose |
|---|---|
| [`10-services-vs-widgets.md`](10-services-vs-widgets.md) | When to use services vs. widgets |
| [`11-boards.md`](11-boards.md) | Multi-board setup — separating rooms / topics |
| [`12-themes.md`](12-themes.md) | 7 presets, accent colour, custom CSS |
| [`13-auth-modes.md`](13-auth-modes.md) | open / token / userPassword / OAuth2 — differences |
| [`14-healthchecks.md`](14-healthchecks.md) | How the status indicator works |
| [`15-search-command-palette.md`](15-search-command-palette.md) | Ctrl + K — local hits + web engines |

## Integrations

| File | Integration |
|---|---|
| [`20-integrations-overview.md`](20-integrations-overview.md) | Overview of all 14 first-class integrations |
| [`21-home-assistant.md`](21-home-assistant.md) | Home Assistant + Smart-Home widget |
| [`22-glances.md`](22-glances.md) | Glances — live server stats for InfraNodes |
| [`23-adguard-home.md`](23-adguard-home.md) | AdGuard Home |
| [`24-pihole.md`](24-pihole.md) | Pi-hole (multi-instance) |
| [`25-unifi-network.md`](25-unifi-network.md) | UniFi Network (Controller / UDM Pro) |
| [`26-unifi-protect.md`](26-unifi-protect.md) | UniFi Protect (cameras) |
| [`27-portainer.md`](27-portainer.md) | Portainer — container overview |
| [`28-frigate.md`](28-frigate.md) | Frigate — event stream + snapshots |
| [`29-esphome.md`](29-esphome.md) | ESPHome direct mode (v3 SSE / v2 REST) |
| [`30-zigbee2mqtt.md`](30-zigbee2mqtt.md) | Zigbee2MQTT — auto-discovery via HA |
| [`31-uptime-kuma.md`](31-uptime-kuma.md) | Uptime Kuma — status page |
| [`32-speedtest.md`](32-speedtest.md) | Speedtest-Tracker |
| [`33-weather.md`](33-weather.md) | Weather (Open-Meteo, no API key) |
| [`34-custom-rest.md`](34-custom-rest.md) | Custom REST — arbitrary JSON endpoints |

## Operations

| File | Purpose |
|---|---|
| [`90-backups-migrations.md`](90-backups-migrations.md) | Schema migrations + backup strategy |
| [`91-troubleshooting.md`](91-troubleshooting.md) | Common problems and fixes |
| [`92-architecture.md`](92-architecture.md) | How Mesh is built internally |
