# AdGuard Home

DNS-Filter mit Statistiken via REST-API + Basic-Auth.

## Was die Integration kann

- **AdGuard-Widget** mit Block-Rate (24h), DNS-Queries, Top-Adlists, blockierte Domains heute
- Statusfarbe basierend auf Block-Rate (gelb >50 %, rot >80 %)

## Voraussetzungen

- AdGuard Home 0.107 oder neuer (ältere Versionen liefern andere Felder im Stats-Endpoint)
- Web-UI-Credentials (kein separater API-Token in AdGuard)
- AdGuard ist über das Container-Netzwerk erreichbar

## Setup in Mesh

1. **Admin → Integrationen → AdGuard**
2. Felder:
   - `baseUrl` — z. B. `http://192.168.1.30:3001` (AdGuard-Web-UI)
   - `username` + `password` — Web-UI-Login
3. Speichern → Verbindung wird gegen `/control/status` getestet

## Widget verwenden

**Admin → Inhalte → Widgets → „AdGuard Home"**. Settings:

- `integrationId` — optional, falls du irgendwann Multi-Instance unterstützen willst (aktuell single)
- `wideThreshold` — bei Spaltenanzahl ab dem das Widget den Wide-Layout zeigt (default 8)

Compact-Mode zeigt nur Block-Rate + Status-Punkt — sinnvoll für schmale Widgets.

## Troubleshooting

- **Statistiken sind 0** — AdGuard's `/control/stats` liefert die letzten 24h als Array. Mesh liest die Aggregat-Felder `num_dns_queries` + `num_blocked_filtering`. Update auf AdGuard 0.107+ behebt das, wenn du eine sehr alte Version hast.
- **Auth fehlgeschlagen** — Username + Passwort wie in der AdGuard-WebUI. Wenn du 2FA aktiviert hast: leider nicht supported in der API → 2FA temporär aus oder einen separaten User ohne 2FA anlegen.
- **`*.local` (mDNS) Hostname** — Container kann mDNS meist nicht. IP nutzen.

## API-Endpoints (für Debug)

| Endpoint                              | Zweck                                  |
|---------------------------------------|----------------------------------------|
| `GET /control/status`                 | Health + Version                        |
| `GET /control/stats`                  | DNS-Queries, Block-Rate, Top-Domains    |
| `GET /control/filtering/status`       | Aktive Filterlisten (Adlists)           |

Mit Basic-Auth: `curl -u admin:passwort http://192.168.1.30:3001/control/status`.
