# Integrationen — Überblick

Mesh hat aktuell **14 first-class Integrationen**. Jede ist ein eigener Slot unter **Admin → Integrationen** und liefert Daten für eines oder mehrere Widgets.

## Liste

| Integration         | Datenquelle                        | Widget-Kinds                         | Wiki                                 |
|---------------------|------------------------------------|--------------------------------------|--------------------------------------|
| Home Assistant      | REST-API + Token                   | `homeassistant`, `smartHome`         | [21-home-assistant.md](21-home-assistant.md) |
| Glances             | REST-API (multi-instance)          | `glances` + InfraNode-CPU/RAM-Bars   | [22-glances.md](22-glances.md)        |
| AdGuard Home        | REST-API + Basic-Auth              | `adguard`                            | [23-adguard-home.md](23-adguard-home.md) |
| Pi-hole             | REST-API + Token (multi-instance)  | `pihole`                             | [24-pihole.md](24-pihole.md)          |
| UniFi Network       | UniFi API-Key                      | `unifi`                              | [25-unifi-network.md](25-unifi-network.md) |
| UniFi Protect       | UniFi API-Key                      | `unifiProtect`, Camera-Snapshot      | [26-unifi-protect.md](26-unifi-protect.md) |
| Portainer           | Portainer API-Key (multi-instance) | `portainer`                          | [27-portainer.md](27-portainer.md)    |
| Frigate             | Frigate API (multi-instance)       | `frigate`                            | [28-frigate.md](28-frigate.md)        |
| ESPHome (Direct)    | REST + SSE (multi-instance)        | `esphome`                            | [29-esphome.md](29-esphome.md)        |
| Zigbee2MQTT         | via HA / direct MQTT (v1.7+)       | `zigbee2mqtt`                        | [30-zigbee2mqtt.md](30-zigbee2mqtt.md) |
| Uptime Kuma         | Status-Page-Slug                   | `uptimeKuma`                         | [31-uptime-kuma.md](31-uptime-kuma.md) |
| Speedtest-Tracker   | REST + Bearer (multi-instance)     | `speedtest`                          | [32-speedtest.md](32-speedtest.md)    |
| Wetter (Open-Meteo) | öffentliches API, kein Key         | `weather`                            | [33-weather.md](33-weather.md)        |
| Custom REST         | beliebiger JSON-Endpoint + JSONPath| `customRest`                         | [34-custom-rest.md](34-custom-rest.md) |

Plus: **Unraid GraphQL** (für InfraNodes) — siehe [22-glances.md](22-glances.md#warum-glances-und-nicht-unraid-graphql) für die Abgrenzung.

## Multi-Instance vs Single-Instance

- **Multi-Instance** ([] im Schema): Glances, Pi-hole, Portainer, Speedtest, Frigate, ESPHome — kannst beliebig viele anlegen
- **Single-Instance** ({} im Schema): Home Assistant, AdGuard, UniFi, Wetter, Uptime Kuma — eine Instanz pro Mesh

Für Multi-Instance bekommt jedes Widget ein `integrationIds[]`-Setting, mit dem du auswählst welche Instanzen es zeigt.

## Eigenes Widget bauen?

Wenn deine Datenquelle nicht in der Liste ist:

1. **Custom REST** für JSON-Endpoints — kein Code nötig
2. **PR** mit eigenem Widget-Kind — siehe `apps/web/src/components/widgets/registry.tsx` als Vorlage. Wir freuen uns über Beiträge.
