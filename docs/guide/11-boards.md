# Boards — mehrere Dashboards im selben Mesh

Boards sind die Mesh-Antwort auf „aber ich hätte gerne ein eigenes Dashboard für meine Wohnung, eines für die Firma und eines fürs Studio". Jedes Board hat eigenen Slug, eigene Services, eigene Widgets, eigene Server-Karten — geteilt werden nur Theme + Auth + Integrations.

## Board anlegen

**Admin → Layout → Boards → „Neues Board"**

| Feld         | Bedeutung                                              |
|--------------|--------------------------------------------------------|
| `name`       | Anzeige-Name im Board-Switcher                         |
| `slug`       | URL-Pfad: `/boards/<slug>` (z. B. `media`, `studio`)   |
| `icon`       | Optionales Emoji oder Lucide-Icon                       |
| `isHome`     | EIN Board als Standard-Home — `/` zeigt dieses Board    |
| `layout`     | `flat` (alles in einer Reihe) oder `sections`          |

## Wechseln zwischen Boards

Im Header oben links: Board-Switcher-Dropdown. Aktuelle Auswahl persistiert im LocalStorage (`itsweber-mesh-active-board`).

## Inhalte pro Board zuordnen

Jedes Service / Widget / InfraNode / Camera hat ein `boardId`-Feld. Im Edit-Modus oben rechts wählst du das Board, dann legst du Inhalte direkt dort an.

## Sections (optional)

Wenn `layout: "sections"`: zusätzliche Untergruppen innerhalb eines Boards mit eigenen Titeln. Sinnvoll wenn ein Board sehr viele Widgets hat.

## Default-Board

Beim First-Run-Wizard wird **ein** Board namens „Home" angelegt (`isHome: true`). Es ist das Minimum — du kannst keine Boards komplett löschen, mindestens eins muss stehen bleiben.

## Beispiele aus der Praxis

- **„Home"** — Wohnzimmer + Heizung + Familie (Smart-Home-fokussiert)
- **„Server"** — alle Unraid-/Linux-Hosts mit Glances + Portainer
- **„Media"** — Plex/Jellyfin/Immich/Audiobookshelf
- **„Cams"** — UniFi Protect + Frigate
