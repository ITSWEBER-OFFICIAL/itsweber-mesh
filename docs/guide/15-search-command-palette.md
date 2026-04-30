# Command Palette (Strg + K)

Die Suchleiste oben rechts im Header öffnet ein **Modal** mit zwei Sektionen: Lokale Treffer + Web-Suche.

## Aufrufen

- Klick auf die Suchleiste
- Tastenkürzel **Strg + K** (Windows/Linux) oder **Cmd + K** (Mac)
- Esc schließt
- ↑/↓ navigiert, Enter öffnet, Hover ändert die Auswahl

## Lokale Treffer

Lokal sucht in deinem Mesh-Datenbestand:

| Quelle      | Was wird gefunden?                                     |
|-------------|--------------------------------------------------------|
| Services    | Name + URL + Beschreibung                              |
| Boards      | Board-Name + Slug                                      |
| Quick-Links | Label + URL                                            |
| Widgets     | Label + Kind                                           |

Implementiert in `apps/web/src/hooks/useLocalSearch.ts`. Substring-Suche, case-insensitive, kein Fuzzy-Matching (kommt eventuell in v2.0).

## Web-Suche

Wenn keine lokalen Treffer vorhanden ODER der Nutzer Enter drückt: weitergeleitet an die konfigurierten Engines.

Default-Engines:

- **Google** (Hotkey `g`) — `https://www.google.com/search?q={q}`
- **DuckDuckGo** (Hotkey `d`) — `https://duckduckgo.com/?q={q}`
- **Brave Search** (Hotkey `b`) — `https://search.brave.com/search?q={q}`

URL-Template mit Platzhalter `{q}` (URL-encoded eingesetzt).

## Engines anpassen

**Admin → System → Suche** → Engine hinzufügen / bearbeiten / löschen.

Felder:

- `name` — Anzeigename
- `urlTemplate` — mit `{q}`
- `icon` — URL zu einem Logo (optional)
- `hotkey` — ein Buchstabe (z. B. `g`) — Tippen `g foo` startet Google direkt
- `sortOrder` — Reihenfolge

## Mit URL starten

`http://mesh.example.com/?q=Frigate` öffnet die Mesh-UI mit vorausgefülltem Suchbegriff. Praktisch für Bookmarks oder Browser-Search-Engine-Setup.

## Nicht-lokal? Default-Engine

Wenn du keinen lokalen Treffer hast und auf Enter drückst, wird die `defaultEngineId`-Engine genutzt. Default ist Google.

## Searchbar-Komponente extern verwenden

Die Komponente liegt in `apps/web/src/components/layout/HeaderSearch.tsx`. Self-contained, Radix Dialog, ohne externe Abhängigkeiten außer `lucide-react`. Kann theoretisch isoliert eingebaut werden — aktuell aber nur im Header verwendet.
