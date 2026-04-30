# ITSWEBER Mesh auf Unraid installieren

Unraid ist eines der primären Ziele von ITSWEBER Mesh — wenn du Unraid 6.10+ läufst, ist die Installation ein Drei-Klick-Vorgang.

## Voraussetzungen

- Unraid 6.10 oder höher
- Plugin **Community Applications** installiert (steht auf 99% aller Unraid-Server, falls nicht: Apps-Tab erscheint nach Plugin-Install in den Settings)
- Ein freier Port — Default `3000`

## Installation in 3 Klicks

1. **Apps**-Tab in der Unraid-WebUI öffnen
2. Suche **„itsweber mesh"** → Container-Karte „Install"
3. Im Edit-Container-Formular nur **MESH_SESSION_SECRET** ausfüllen — alles andere ist sinnvoll vorbelegt:

   - WebUI Port: `3000` (passe an wenn belegt)
   - Config Volume: `/mnt/user/appdata/itsweber-mesh`
   - **MESH_SESSION_SECRET**: 32+ Zeichen, generiert via `openssl rand -hex 32` (auf Unraid-Konsole)
   - TZ: `Europe/Berlin`

4. **Apply** klicken — Container startet, beim ersten Aufruf der WebUI läuft der First-Run-Wizard

## Optional: native Unraid-Stats

Wenn du das Mesh-Unraid-Widget mit Live-Daten füttern willst (statt nur HTTP-Pings), aktiviere unter „Show Advanced" den **Unraid GraphQL Socket**:

```
/var/run/unraid-api.sock  →  /var/run/unraid-api.sock  (read-only)
```

Voraussetzung: Plugin **unraid-api** läuft (`unraid-api status` in der Konsole). Damit liefert das Widget Array-State, Container-Counts, VM-Counts und Service-Status ohne API-Key.

> Alternativ: ohne Socket-Mount verbindest du dich per HTTP — Admin → Integrationen → Unraid → Endpoint = `http://192.168.x.x:1580` plus API-Key.

## Glances dazu installieren

Für CPU-/RAM-Live-Bars in den Server-Karten siehe [Glances](22-glances.md). Auch ein 2-Klick-Vorgang im Apps-Tab.

## Update auf neue Version

Unraid macht das automatisch:

1. **Docker-Tab** → bei `itsweber-mesh` rechts auf das Container-Icon → **Update Ready** wenn vorhanden
2. **Apply Update**

Schema-Migrations laufen beim Container-Start automatisch. Backups landen unter `/mnt/user/appdata/itsweber-mesh/config.json.pre-vN` — bestehende Backups werden nie überschrieben.

## Troubleshooting

### „Cannot connect to WebUI"

- Prüfe ob der Container läuft: `docker ps | grep itsweber-mesh`
- Prüfe Logs: `docker logs itsweber-mesh --tail 50`
- Wenn die UI weiß bleibt nach „Apply" — meistens fehlt der `MESH_SESSION_SECRET`. Das Bootstrap-Skript verweigert den Start dann mit einer Log-Meldung.

### „Image pull fehlgeschlagen"

- DNS auf dem Unraid-Server prüfen: Settings → Network Settings → DNS Server → `192.168.x.x` (deinen Router) oder `8.8.8.8`
- `docker pull hello-world` testet die Registry-Verbindung

### Container startet aber Migration läuft nicht

- Prüfe Logs auf `Config migrated and persisted` Zeile
- Wenn Schema-Mismatch: Backup zurückspielen — `cp /mnt/user/appdata/itsweber-mesh/config.json.pre-vN /mnt/user/appdata/itsweber-mesh/config.json`, dann Container neustarten

## Submission an Community Apps

Wer die XML selbst maintainen will (statt durch den AppFeed-Maintainer): siehe [`docs/release-prep/unraid/PUBLISHING.md`](../unraid/PUBLISHING.md).
