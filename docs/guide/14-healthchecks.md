# Healthchecks — wie der Status-Punkt funktioniert

Mesh hat einen in-process Healthcheck-Scheduler — kein externer Cron, kein zusätzlicher Container.

## Wie es läuft

- **Intervall:** alle 10 Sekunden ein voller Sweep
- **Parallel:** `p-limit(8)` — maximal 8 gleichzeitige Pings
- **Implementierung:** `apps/web/src/server/healthcheck/scheduler.ts`
- **Helper:** `pingTarget(target, fallbackUrl)` aus `pinger.ts`

## Ping-Typen

### `http`

`fetch(url)` mit `AbortController(timeoutMs)`. Akzeptierte Status-Codes per default: `[200, 204, 301, 302, 401]`.

`401` ist absichtlich drin — viele Services haben Auth-Walls aber sind erreichbar. Wenn du das nicht willst, im Service-Editor die `expectStatus` anpassen.

### `tcp`

`net.connect({host, port})` mit Timeout. Erfolgreich wenn der Connect klappt — keine Antwort wird geprüft. Nützlich für Datenbanken, MQTT-Broker etc.

### `none`

Kein Ping — Status ist immer „unknown". Sinnvoll für Karten, die nur Direktzugriff sind ohne sinnvollen Healthcheck (z. B. Doku-Seite, externer Cloud-Service).

## Betroffene Felder

Services, NetworkDevices und InfraNodes haben jeweils `pingTarget`. Widget-eigene Polls sind separat (jedes Widget pollt seine Integration selbst, im React-Query-Layer).

## Refresh & UI

- React-Query holt `trpc.status.all` alle 10 s + bei `refetchOnWindowFocus`
- Status-Punkte sind grün (online), gelb (warning), rot (offline), grau (unknown)
- Latenz wird angezeigt (z. B. „42 ms")

## Was du tun kannst

- **Häufige Probleme:** siehe [Troubleshooting](91-troubleshooting.md#healthchecks--status-anzeige)
- **Timeout anpassen:** im Service-Editor → `pingTimeoutMs` (default 3000)
- **Status-Code-Liste erweitern:** in `config.json` → `services[].pingTarget.expectStatus` Array

## Roadmap

- v1.6 — Healthcheck-Intervall pro Service konfigurierbar
- v1.6 — Optional: SSL-Zertifikats-Ablauf-Warnung
- v1.7 — Latenz-History für 24h (Mini-Sparkline)
