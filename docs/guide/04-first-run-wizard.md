# First-Run-Wizard

Beim allerersten Aufruf einer leeren Mesh-Installation läuft ein **3-Schritte-Setup-Wizard**, bevor das eigentliche Dashboard angezeigt wird.

## Schritt 1 — Identität

- **Dashboard-Name** (z. B. „Heim-Lab", „Familie", „MeineFirma")
- **Untertitel** — kleine Zeile unter dem Logo (default „Home Infrastructure")
- **Sprache** — Deutsch / Englisch (kann später unter Admin → Einstellungen geändert werden)

## Schritt 2 — Theme

- 7 vordefinierte Presets zur Auswahl (siehe [Themes](12-themes.md))
- Akzentfarbe per Color-Picker
- Kann jederzeit unter Admin → System → Theme angepasst werden

## Schritt 3 — Admin-Account

- Benutzername + Passwort + E-Mail (optional)
- Wird mit bcrypt gehasht (cost 10) und in der `auth.users[]`-Liste gespeichert
- Auth-Mode bleibt initial auf `open` — du wählst nach dem Wizard manuell `userPassword` oder OAuth2

## Was passiert technisch?

1. `meta.firstRunCompleted = true` in der `config.json`
2. Default-Services + Default-Quick-Links werden angelegt (siehe `apps/web/src/server/config/defaults.ts`)
3. Default-Theme + Default-Suchmaschinen
4. 25+ Default-FAQ-Einträge (siehe Admin → Hilfe & FAQ)
5. Redirect auf `/` (Dashboard)

## Wizard übersprungen?

Wenn `meta.firstRunCompleted: true` aber keine Admin-Nutzer existieren UND der Auth-Mode nicht `open` ist, wirst du auf `/setup` umgeleitet.

## Wizard erneut auslösen

In der `config.json`:

```json
{
  "meta": { "firstRunCompleted": false },
  "auth": { "users": [] }
}
```

Container neustarten — der Wizard läuft wieder. **Achtung**: bestehende Services/Widgets werden NICHT gelöscht, der Wizard ergänzt nur fehlende Defaults.
