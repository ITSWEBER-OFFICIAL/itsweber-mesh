# Zigbee2MQTT

Drei Modi für die Z2M-Integration — wähle den, der zu deinem Setup passt.

## Was die Integration kann

- Geräte-Liste (online/offline) mit Akku-Stand
- Bridge-Status (Z2M-Daemon online/offline + Version)
- Last-Seen pro Gerät
- Optional: Trigger-Buttons (Polish in v1.7+)

## Modi

| Modus      | Voraussetzung                                          | Wann nehmen?                  |
|------------|--------------------------------------------------------|--------------------------------|
| `auto`     | Home Assistant + Z2M an HA via MQTT-Discovery angebunden| Empfohlen seit v1.4.6          |
| `ha`       | HA + manuelle Group `group.zigbee2mqtt` mit allen Geräten| Legacy / vor v1.4.6            |
| `mqtt`     | direkter MQTT-Broker-Zugriff                            | v1.7+ — kein HA als Vermittler |

## Setup `auto` (Default seit v1.4.6)

**Admin → Integrationen → Zigbee2MQTT**:

- `enabled: true`
- `source: auto`
- (Home Assistant muss korrekt verbunden sein — siehe [Home Assistant](21-home-assistant.md))

Die Discovery enumeriert alle Geräte mit `zigbee2mqtt` in `device_attr(<id>, 'identifiers')` über die HA-Template-API.

## Setup `ha` (Legacy)

- `source: ha`
- `haGroupEntity` — z. B. `group.zigbee2mqtt`

In HA müsstest du die Group manuell pflegen mit allen Z2M-Geräten als Members. Wenn `haGroupEntity` leer ist, fällt Mesh automatisch auf `auto` zurück.

## Setup `mqtt` (v1.7+)

Nicht in v1.5.x verfügbar. Aktuell Roadmap:

- `mqttBroker`, `mqttUsername`, `mqttPassword`, `mqttTopicPrefix`
- Mesh subscribiert direkt auf `<prefix>/#`

## Bridge-Status

Separat aus zwei HA-Entities:

- `binary_sensor.zigbee2mqtt_bridge_connection_state` (online/offline)
- `sensor.zigbee2mqtt_bridge_version` (Version)

Wenn diese Entities nicht existieren: bridge-Status ist „unknown".

## Widget verwenden

**Admin → Inhalte → Widgets → „Zigbee2MQTT"**.

## Troubleshooting

- **Auto-Modus zeigt 0 Geräte** → HA-Verbindung prüfen, dann `Developer Tools → Templates` in HA: `{% for state in states %}{% if 'zigbee2mqtt' in (device_attr(state.entity_id, 'identifiers') or '')|string %}{{ state.entity_id }}, {% endif %}{% endfor %}` sollte Geräte zurückgeben
- **Bridge-Status fehlt** → Z2M-Plugin in HA installiert? Sonst: Z2M-Bridge-Sensoren manuell in HA als MQTT-Sensoren anlegen
