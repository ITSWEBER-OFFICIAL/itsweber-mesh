# Home Assistant

Mesh-zu-HA-Integration über REST-API + Long-Lived Access Token.

## Was die Integration kann

- **Smart-Home-Widget** mit Personen-Status, Energie-Verbrauch, Problemen
- **HA-Health-Indicator** im Command-Overview-Banner (zeigt Updates + ungelöste Probleme)
- **Z2M Auto-Discovery** über die HA-Template-API (siehe [Zigbee2MQTT](30-zigbee2mqtt.md))
- **ESP-Auto-Discovery** wenn ESP-Geräte über HA angebunden sind

## Voraussetzungen

- Home Assistant 2024.x oder neuer
- Long-Lived Access Token aus dem HA-Profil (Profil → Sicherheit → Long-Lived Access Tokens → „Create Token")
- HA muss vom Mesh-Container aus erreichbar sein (Netzwerk-Prüfung: `curl -H "Authorization: Bearer $TOKEN" https://home.example.com/api/`)

## Setup in Mesh

1. **Admin → Integrationen → Home Assistant**
2. Felder:
   - `baseUrl` — z. B. `https://homeassistant.local` (ohne Slash am Ende)
   - `token` — der Long-Lived Token
   - `esphomeGroupEntity` (optional) — falls du Legacy-ESP über HA-Group nutzt
   - `zigbee2mqttGroupEntity` (optional) — falls Z2M im `ha`-Modus
3. Speichern → Verbindung wird sofort getestet

## Widget verwenden

**Admin → Inhalte → Widgets → „Home Assistant"** oder **„Smart Home"**.

- `homeassistant` — kompakte Sensor-Liste mit Personen-Status und Energie
- `smartHome` — größere Übersicht mit KPIs (Lichter an, Temperatur, Verbrauch)

## Troubleshooting

- **Token ungültig** → HA-Profil neu generieren, alte Tokens werden bei Passwort-Reset invalidiert
- **CORS-Fehler in Browser-Console** — Mesh ruft HA aus dem Server (Container) auf, sollte nie CORS sein. Wenn doch: Reverse-Proxy-Headers checken
- **`esphomeGroupEntity` zeigt nichts** — die Group muss existieren UND Geräte enthalten. Test in HA: Developer Tools → Templates → `{{ states.group.esphome.attributes.entity_id }}`

## API-Endpoints (für Debug)

| Endpoint                              | Zweck                                  |
|---------------------------------------|----------------------------------------|
| `GET /api/`                           | Connection-Probe (auth-check)           |
| `GET /api/states`                     | Alle Entity-States                      |
| `POST /api/template`                  | Template-Rendering (Auto-Discovery)     |
| `GET /api/config`                     | HA-Version + Komponenten                |
| `GET /api/events`                     | Event-Stream (nicht von Mesh genutzt)   |
