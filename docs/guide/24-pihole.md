# Pi-hole

DNS-Filter via REST-API + API-Token. **Multi-Instance** unterstützt — pflege beliebig viele Pi-holes parallel.

## Was die Integration kann

- DNS-Queries-Statistik, Block-Rate, Top-Adlists pro Pi-hole
- Aggregierte Werte über mehrere Pi-holes wenn das Widget mehrere `integrationIds[]` hat

## Voraussetzungen

- Pi-hole v5.0+ mit aktivierter API
- API-Token aus `/admin/settings.php → API` (im Reiter „API / Web Interface")

## Setup in Mesh

1. **Admin → Integrationen → Pi-hole** → „Hinzufügen"
2. Pro Instanz:
   - `label` — z. B. „Pi-hole Hauptraum"
   - `baseUrl` — z. B. `http://192.168.1.4`
   - `apiToken` — aus Pi-hole-Settings
3. Speichern → wiederhole für weitere Pi-holes

## Widget verwenden

**Admin → Inhalte → Widgets → „Pi-hole"**. Settings:

- `integrationIds[]` — Liste der Pi-hole-Instanz-IDs (eine oder mehrere)
- bei mehreren: Werte werden aufaddiert

## Troubleshooting

- **API-Token ungültig** → in Pi-hole-Settings neu generieren, alte werden bei Reset invalidiert
- **`PHP-Fehler im JSON-Response`** → Pi-hole-PHP-Log prüfen (`/var/log/lighttpd/error.log`); meist alte Pi-hole-Version
- **Keine Daten obwohl Token korrekt** → API ist evtl. via `?auth=` deaktiviert (Settings → API → „Permit destructive actions")

## API-Endpoints (für Debug)

| Endpoint                                             | Zweck                       |
|------------------------------------------------------|------------------------------|
| `GET /admin/api.php?summary&auth=<token>`            | Stats-Aggregat                |
| `GET /admin/api.php?type=top_domains&auth=<token>`   | Top-Adlists                  |
