# UniFi Protect

NVR + Kameras von UniFi Protect. Snapshot-Proxy + optional Live-Stream-Link.

## Was die Integration kann

- Aktuelle Kamera-Snapshots (gepullt vom Mesh-Server, kein direkter Zugriff vom Browser nötig)
- Mehrere Kameras parallel
- Status-Punkt pro Kamera (online/offline)
- Klick auf Kamera-Karte → springt in Protect-UI

## Voraussetzungen

- UniFi Protect 4.x+ (mit modernem API-Key-Auth)
- API-Key aus dem UniFi-Account
- Mesh muss Protect erreichen (üblicherweise gleiche UDM-IP wie UniFi Network)

## Setup in Mesh

**Admin → Integrationen → UniFi Protect**:

- `enabled` — Toggle
- `baseUrl` — z. B. `https://192.168.1.1` (Protect läuft auf der UDM)
- `apiKey` — aus UI-Account-Profil
- `verifyTls` — false bei selbstsigniert

Die einzelnen Kameras werden separat unter **Admin → Inhalte → Kameras** angelegt mit `kind: unifiProtect` + Camera-ID aus Protect.

## Widget verwenden

Zwei Wege:

1. **`unifiProtect`-Widget** (als Widget im Grid) — kompakte Kamera-Übersicht
2. **`cameras`-Section** auf dem Dashboard — klassisches Snapshot-Grid

## Troubleshooting

- **Snapshot lädt nicht / 401** — API-Key prüfen, Protect nutzt anderen Auth-Pfad als Network. Bei Protect 4.x+ wird ein Bearer-Token mit `X-API-KEY` gesendet
- **„Camera not found"** — Camera-ID stimmt nicht. In Protect: `https://<ip>/protect/api/cameras` listet alle IDs (mit gültigem Token)
- **Snapshots sind veraltet** — Proxy-Cache ist 5s. Bei Refresh-Bedarf den `refreshSec` im Widget runterstellen (min. 5)

## API-Endpoints (für Debug)

| Endpoint                                         | Zweck                       |
|--------------------------------------------------|------------------------------|
| `GET /proxy/protect/api/cameras`                 | Camera-Listing                |
| `GET /proxy/protect/api/cameras/<id>/snapshot`   | aktueller Snapshot (JPEG)     |
