# Uptime Kuma

Status-Page-Monitor — Mesh zeigt deine Uptime-Kuma-Status-Page eingebettet.

## Was die Integration kann

- Monitor-Liste mit Health-Status
- Aktuelle Up/Down-Werte pro Monitor
- Spring-Link zur vollen Status-Page

## Voraussetzungen

- Uptime Kuma 1.21+ mit aktivierter Status-Page (Settings → Status Pages)
- Status-Page-Slug (Public-URL endet auf `/status/<slug>`)
- **Kein API-Token nötig** — wir lesen nur die öffentliche Status-Page

## Setup in Mesh

**Admin → Integrationen → Uptime Kuma**:

- `baseUrl` — z. B. `http://192.168.1.10:3001`
- `statusPageSlug` — z. B. `home` (entspricht `/status/home`)

## Widget verwenden

**Admin → Inhalte → Widgets → „Uptime Kuma"**.

## Troubleshooting

- **404 / leerer Inhalt** → Status-Page ist nicht öffentlich. In Kuma: Settings → Status Pages → entsprechende Page → „Public"
- **CORS-Fehler in Browser-Console** → Mesh ruft Kuma serverseitig (Container) auf, also nie CORS. Wenn doch: Reverse-Proxy-Headers
- **Monitor-Anzahl stimmt nicht** → Du hast mehr Status-Pages und weisen die Monitore unterschiedlich zu. Pro Slug nur eigene Liste

## API-Endpoints (für Debug)

| Endpoint                              | Zweck                                  |
|---------------------------------------|----------------------------------------|
| `GET /api/status-page/<slug>`         | Status-Page-Daten (JSON)                |
| `GET /api/status-page/heartbeat/<slug>`| Heartbeats pro Monitor                  |
