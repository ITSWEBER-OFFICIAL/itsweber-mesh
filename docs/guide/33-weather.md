# Wetter (Open-Meteo)

Aktuelles Wetter + 5-Tage-Forecast. Datenquelle ist [Open-Meteo](https://open-meteo.com) — **kein API-Key nötig**.

## Was die Integration kann

- Aktuelle Temperatur + Bewölkung + Wind
- 5-Tage-Forecast mit Min/Max
- Wetter-Symbole (sonnig, bewölkt, Regen, Schnee, …)

## Voraussetzungen

- Internet-Zugriff vom Mesh-Container aus zu `api.open-meteo.com`
- Geo-Koordinaten deines Standorts

## Setup in Mesh

**Admin → Integrationen → Wetter**:

- `enabled` — Toggle
- `latitude` / `longitude` — z. B. Berlin: `52.52` / `13.405`
- `locationName` — Anzeigename (z. B. „Berlin")
- `unit` — `celsius` oder `fahrenheit`
- `refreshIntervalMin` — default 15

## Widget verwenden

**Admin → Inhalte → Widgets → „Wetter"**.

## Koordinaten finden

- [latlong.net](https://www.latlong.net) eingeben
- Oder Google Maps → Rechts-Klick auf den Punkt → erste Zeile sind Koordinaten

## Troubleshooting

- **„No data"** → Open-Meteo blockt manchmal Requests aus bestimmten Regionen. Test: `curl 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m'`
- **Falscher Standort** → Latitude/Longitude vertauscht. Lat ist Y (Nord-Süd), Long ist X (Ost-West). DE liegt bei Lat ~50, Long ~10
- **Keine Symbole** → Lucide-Icons werden lokal gerendert. Wenn Icons fehlen: Browser-Console-Errors prüfen
