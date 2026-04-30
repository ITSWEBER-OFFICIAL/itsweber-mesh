# ESPHome (Direct-Modus)

Direkte Integration zu ESPHome-Geräten — ohne Home Assistant als Vermittler. **Multi-Instance** (eine pro Gerät).

## Was die Integration kann

- Sensor-Werte live (Temperatur, Helligkeit, Spannung, was auch immer im YAML steht)
- Binary-Sensors (an/aus)
- Text-Sensors
- Auto-Detection ob das Gerät v3 (modernes Framework, SSE-Stream) oder v2 (klassisches REST) spricht

## Voraussetzungen

- ESPHome-Gerät mit `web_server:` Component im YAML, z. B.:

  ```yaml
  web_server:
    port: 80
    version: 3   # oder 2
  ```

- Optional: API-Passwort wenn `api: { password: "..." }` im YAML

## Setup in Mesh

**Admin → Integrationen → ESPHome** → „Hinzufügen":

- `label` — z. B. „Heizung-ESP"
- `baseUrl` — z. B. `http://esp-livingroom.local` oder `http://192.168.1.50`
- `password` (optional) — Basic-Auth wenn API-Passwort gesetzt

## Widget verwenden

**Admin → Inhalte → Widgets → „ESPHome"**. Settings:

- `integrationIds[]` — eine oder mehrere Geräte
- Bei mehreren: ein Block pro Gerät, jeweils ausklappbar

## v3 vs v2 — was ist der Unterschied?

| Aspekt           | v3 (modern)               | v2 (legacy)                  |
|------------------|---------------------------|------------------------------|
| Stream           | SSE auf `/events`         | REST-Polling                  |
| Framework        | `oi.esphome.io/v3/www.js` | älter                         |
| Detection        | HTML enthält v3-Marker    | Fallback                      |
| Implementierung  | `node:http` direkt         | `fetch()`                     |

> Wichtig: Mesh nutzt für v3 SSE **`node:http` direkt** (nicht `fetch()`), weil Next.js Node-Runtime SSE-Responses puffert.

## Troubleshooting

- **„No data"** → `web_server:` Component fehlt im YAML. ESPHome neu compilieren + flashen
- **„Connection refused" auf Port 80** → Port verschoben? `port: 8080` im YAML, dann `baseUrl` mit Port
- **`*.local` (mDNS) klappt nicht** im Container — IP statt Hostname
- **API-Passwort vergessen** → ESPHome OTA-Update mit neuem YAML neu flashen

## API-Endpoints (für Debug)

| Endpoint                            | Zweck                              |
|-------------------------------------|-------------------------------------|
| `GET /`                             | HTML — Detection v2/v3              |
| `GET /events` (v3)                  | SSE-Stream mit allen Sensoren       |
| `GET /sensor/list` (v2)             | REST-Listing Sensoren               |
| `GET /binary_sensor/list` (v2)      | REST-Listing Binary-Sensors         |
| `GET /text_sensor/list` (v2)        | REST-Listing Text-Sensors           |
