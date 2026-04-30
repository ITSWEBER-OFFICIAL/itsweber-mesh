# Speedtest-Tracker

Internet-Speedtest mit History via [`alex-laycalvert/speedtest-tracker`](https://github.com/alex-laycalvert/speedtest-tracker) oder LSIO-Image.

## Was die Integration kann

- Aktuelle Download / Upload / Ping
- Mini-History-Sparkline der letzten Tests
- Letzte-Test-Zeitstempel

## Voraussetzungen

- Speedtest-Tracker läuft als eigener Container und schedulet Tests selbst
- Bearer-Token aus den Tracker-Settings (Profile → API Tokens)

## Setup in Mesh

**Admin → Integrationen → Speedtest** → „Hinzufügen":

- `label` — z. B. „Speedtest Hauptnetz"
- `baseUrl` — z. B. `http://192.168.1.10:8080`
- `bearerToken` — aus Speedtest-Tracker

## Widget verwenden

**Admin → Inhalte → Widgets → „Speedtest"**.

## Troubleshooting

- **Keine Daten** → Tracker hat noch keinen Test gemacht. In Tracker-UI „Run test" oder Schedule prüfen
- **„401 Unauthorized"** → Token abgelaufen. Neu generieren

## API-Endpoints (für Debug)

| Endpoint                              | Zweck                                  |
|---------------------------------------|----------------------------------------|
| `GET /api/v1/results/latest`          | Letzter Test                            |
| `GET /api/v1/results?limit=24`        | History (für Sparkline)                 |
