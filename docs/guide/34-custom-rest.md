# Custom REST

Beliebiger JSON-Endpoint → Mesh-Widget. Mit JSONPath-Mapping.

## Was die Integration kann

- Jeden HTTP-GET-Endpoint mit JSON-Response anzapfen
- JSONPath für die Werte-Auswahl
- Anzeige als Wert + Label + Status

## Wann nehmen?

- Deine Datenquelle ist nicht in der [Integrations-Liste](20-integrations-overview.md)
- Du willst etwas „mal eben" anzeigen ohne PR
- Custom Cloud-API (deine Smart-Home-Bridge, Crypto-Ticker, Bus-Live-Daten, …)

## Sicherheits-Allowlist

Standardmäßig sind nur **private Netzwerke** erlaubt (RFC 1918: 10.x, 172.16–31.x, 192.168.x). Externe Hosts müssen explizit freigeschaltet werden.

**Admin → Integrationen → Custom REST**:

- `allowPrivateNetworks: true` (default)
- `allowedHosts` — Liste externer Domains, z. B. `["api.coingecko.com", "data.example.com"]`

Wildcard-Subdomains: `*.example.com` (alle Sub-Domains).

## Widget verwenden

**Admin → Inhalte → Widgets → „Custom REST"**:

- `url` — z. B. `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur`
- `valuePath` — z. B. `$.bitcoin.eur`
- `labelPath` (optional) — z. B. konstanter String
- `statusPath` (optional) — wenn ein Feld true/false oder online/offline liefert
- `headers` (optional) — Auth-Header etc.
- `refreshSec` — default 60

## JSONPath-Beispiele

| JSON-Response                         | Gewünschtes Feld   | Path               |
|---------------------------------------|---------------------|---------------------|
| `{"bitcoin": {"eur": 38000}}`         | 38000               | `$.bitcoin.eur`     |
| `{"data": [{"value": 42}]}`           | 42                  | `$.data[0].value`   |
| `{"status": "ok", "items": [...]}`    | "ok"                | `$.status`          |
| `[{"name": "a"}, {"name": "b"}]`      | "a"                 | `$[0].name`         |

## Troubleshooting

- **„blocked: host not in allowlist"** → externe Domain in `allowedHosts` ergänzen
- **JSONPath kein Match** → Test mit `curl <url> | jq <path>` (jq nutzt fast die gleiche Syntax)
- **Auth fehlschlägt** → `headers: { "Authorization": "Bearer ..." }` setzen

## Beispiele aus der Community

- **Crypto-Preise**: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur` + `$.bitcoin.eur`
- **GitHub-Stars**: `https://api.github.com/repos/itsweber/mesh` + `$.stargazers_count`
- **Wetter-Detail**: `https://api.open-meteo.com/v1/forecast?...` + `$.current.temperature_2m`
