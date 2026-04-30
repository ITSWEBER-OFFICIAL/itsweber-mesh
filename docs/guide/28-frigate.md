# Frigate

NVR mit Object-Detection. Mesh zeigt die letzten Events mit Thumbnails.

## Was die Integration kann

- Letzte N Events (default 10) mit Thumbnail
- Filter nach Kamera + Object-Class
- Klick öffnet Frigate-UI mit dem Event direkt

## Voraussetzungen

- Frigate 0.13+ mit aktivierter API
- Optional: Auth-Header wenn Frigate hinter Reverse-Proxy mit Basic-Auth steht

## Setup in Mesh

**Admin → Integrationen → Frigate** → „Hinzufügen":

- `label` — z. B. „Frigate Hauptraum"
- `baseUrl` — z. B. `http://192.168.1.10:5000`
- `authHeader` (optional) — z. B. `Basic <base64>` für Reverse-Proxy
- `verifyTls` — false bei selbstsigniert

## Widget verwenden

**Admin → Inhalte → Widgets → „Frigate"**. Settings:

- `integrationIds[]` — eine oder mehrere
- `cameraFilter[]` — nur diese Kameras zeigen (default: alle)
- `classFilter[]` — z. B. `person`, `car`, `dog` (default: alle)
- `eventLimit` — default 10

## Troubleshooting

- **Events fehlen** → Frigate erstellt Events nur bei aktiver `record` + `detect`-Konfig. Prüfe `frigate.yaml`
- **Thumbnails laden nicht** → Mesh proxyt sie über `/api/widgets/frigate/thumbnail/<event-id>`. Wenn das 404 wirft: Auth-Header fehlt oder falsch
- **Alte Events bleiben** → Frigate-Event-Retention prüfen, Mesh holt nur was Frigate liefert

## API-Endpoints (für Debug)

| Endpoint                              | Zweck                         |
|---------------------------------------|-------------------------------|
| `GET /api/events?limit=10`            | letzte Events (JSON)           |
| `GET /api/events/<id>/thumbnail.jpg`  | Event-Thumbnail (JPEG)         |
| `GET /api/stats`                      | Frigate-System-Stats           |
