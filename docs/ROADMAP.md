# Roadmap — ITSWEBER Mesh

> Forward-looking work only. For shipped versions see [`CHANGELOG.md`](../CHANGELOG.md).

## v1.6 — Glances enrichments

- Load average + disk I/O + GPU temps as additional InfraNode chips
- Per-disk SMART status (SMART-warning badge on the InfraNode card)
- "Top processes" mini-list in the Glances widget (wide variant)
- Performance: cap polling rate when the tab is hidden (visibility API)

## v1.7 — Direct MQTT for Zigbee2MQTT

Replace the Home-Assistant-template auto-discovery with a direct MQTT
subscription. HA stays as a fallback source for users without an MQTT
broker exposed.

- MQTT client (`mqtt.js`) inside the Next.js server, subscribes to
  `zigbee2mqtt/#`
- Schema bump: `integrations.zigbee2mqtt.{mqttUrl, mqttUsername, mqttPassword}`
- Discovery, battery levels, last-seen, availability — straight from MQTT
- New `source` value `"mqtt"` next to the existing `"auto"` and `"ha"`

## v1.8 — Mobile polish

- Native-feel bottom-nav on phone breakpoint
- Service-card swipe actions (open / health-check / pin)
- Reduced-motion path: skip glassmorphism blur when prefers-reduced-motion

## v2.0 — Production hardening

- OAuth2 / Authentik full production support — official setup guide
- Unraid Community App listing (CA-template + AppFeed submission)
- Optional read-only "guest" mode for shared dashboards
- I18n: split locale strings out of components, add EN as a first-class
  alternative to DE

## Backlog (no version assigned yet)

- Native MQTT support beyond Z2M (generic MQTT-topic widget)
- WebPush notifications for healthcheck transitions
- Theme presets v2: per-board theming, schedule-based theme switch
- Plugin / extension system — load extra widgets from a separate package
- Importer for Heimdall / Homepage / Dashy configs

Suggestions and feature requests are welcome — please open an
[issue](https://github.com/ITSWEBER-OFFICIAL/itsweber-mesh/issues) with
the `enhancement` label and describe the use case first, the proposed UI
second.
