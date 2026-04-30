# Services vs Widgets — Wann nehme ich was?

Mesh hat zwei Konzepte, die auf den ersten Blick ähnlich wirken: **Services** und **Widgets**. Sie haben aber sehr unterschiedliche Aufgaben.

## Services — der Launcher

- **Eine Karte = ein klickbarer Link** auf eine externe Web-UI (z. B. Home Assistant, Portainer, Frigate)
- Status-Punkt zeigt online/offline aus dem in-process Healthcheck-Scheduler (alle 10s)
- Kategorien: `infrastructure`, `media`, `smart-home`, `tools`, `external`
- Sind auf der **Services-Seite** (`/services`) immer komplett zu sehen
- Auf dem **Dashboard** nur die als „pinnedToHome" markierten

→ Pflegen unter **Admin → Inhalte → Services**.

## Widgets — Live-Daten

- **Eine Kachel = aktive Datenanzeige** mit Live-Werten (CPU, RAM, DNS-Stats, Wetter, Sensoren, Container-Counts, …)
- Holen Daten aus konfigurierten Integrationen (Glances, AdGuard, HA, ESPHome, …)
- Liegen im 24×20-Grid (`react-grid-layout`), frei verschiebbar im Edit-Modus
- 19 verschiedene Kinds verfügbar (siehe [Widget-Übersicht](11-widgets.md))
- Erscheinen nur auf dem Dashboard, nicht auf `/services`

→ Pflegen unter **Admin → Inhalte → Widgets**.

## Quick-Links

Die kleine Reihe ganz unten im Footer („Quick-Access") sind weder Services noch Widgets — nur einfache Verknüpfungen ohne Status.

→ Pflegen unter **Admin → Inhalte → Quick-Access**.

## InfraNodes (Server-Karten)

Die großen Karten oben auf dem Dashboard mit CPU/RAM/Array-Bars. Stehen für **physische Server** und kombinieren Daten aus Unraid GraphQL + Glances (siehe [Glances](22-glances.md)).

→ Pflegen unter **Admin → Inhalte → Server-Karten**.

## Entscheidungs-Hilfe

| Du willst…                                  | Nimm        |
|---------------------------------------------|-------------|
| Schnell zu Home Assistant springen          | Service     |
| HA-Probleme + Personen-Status anzeigen      | Widget      |
| Nginx Proxy Manager öffnen                  | Service     |
| AdGuard Block-Rate dauerhaft sehen          | Widget      |
| Unraid-Server-Status mit CPU/RAM-Bars       | InfraNode   |
| Footer-Schnellzugriff (Strg+Klick)          | Quick-Link  |
