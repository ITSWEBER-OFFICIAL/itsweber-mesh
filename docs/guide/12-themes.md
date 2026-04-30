# Themes & Aussehen anpassen

Mesh kommt mit **7 Theme-Presets** und einer Custom-CSS-Schleuse für Pixel-Genaues.

## Die 7 Presets

| Preset             | Charakter                                            |
|--------------------|------------------------------------------------------|
| `dark`             | Standard. Navy-Petrol-Grundton, Teal-Akzente          |
| `light`            | Hell, weiß-grau-teal — fürs Büro tagsüber             |
| `terminal`         | Monochrom-grün auf Schwarz, „Hacker"-Look             |
| `itsweber`         | Cyan-Blau-Hero, Glassmorphism — Brand-Theme           |
| `slate`            | Warm-Dark mit Amber-Akzenten                          |
| `modern-light`     | Notion-Style hell mit zarten Pastell-Akzenten         |
| `graphite-command` | Command-Center-Look, Graphit + Mint                   |

→ Wechsel unter **Admin → System → Theme**.

## Akzentfarbe

Jedes Theme hat eine Default-Akzentfarbe, du überschreibst sie per Color-Picker. Der Wert (`theme.accent`) wird zur Laufzeit als CSS-Variable `--brand` injiziert — sofortige Wirkung ohne Reload.

## Hintergrund-Muster

Vier Optionen:

- `none` — nur Akzent-Glow
- `mesh` — feines 48 px Grid
- `dots` — 18 px Dots
- `stripes` — 45° Streifen

Wirkt sich auf den ganzseitigen Hintergrund aus.

## Hintergrundbild

JPG/PNG/WebP/GIF bis 10 MB hochladen — wird Vollbild + cover + center hinter dem Layout angezeigt.

## Custom CSS

**Admin → System → Custom CSS** öffnet einen Editor mit Live-Preview.

Wichtige Klassen-Anker:

```css
.app-header        /* Header-Leiste */
.app-nav           /* Routen-Pills */
.header-search-trigger   /* Suchleiste */
.command-overview  /* KPI-Banner */
.infra-card        /* Server-Karten */
.service-grid      /* Service-Launcher */
.widget-card       /* Widget-Container */
.app-footer        /* Footer */
```

CSS-Variablen pro Theme (in der Browser-Devtools sichtbar):

```css
[data-theme="itsweber"] {
  --itw-cyan-400: #2ea3f2;
  --itw-cyan-500: #1577a3;
  --itw-grad-hero: linear-gradient(180deg, ...);
}
```

## Theme erstellen vs überschreiben

Mesh hat keine Theme-Editor-UI für komplette neue Themes. Wenn du einen 8. Preset willst:

1. CSS für das Theme schreiben (siehe `apps/web/src/app/globals.css` als Referenz)
2. PR gegen den Repo öffnen — wir freuen uns über Beiträge

Pixel-Tweaks am bestehenden Theme: Custom CSS reicht, kein PR nötig.

## Browser-Cache

Theme-Wechsel sind sofortig, aber Custom-CSS-Edits werden manchmal cached. Strg + F5 (Hard Refresh) hilft.
