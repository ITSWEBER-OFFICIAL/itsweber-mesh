# Backups & Schema-Migrations

Mesh persistiert seine ganze Konfiguration in einer einzigen JSON-Datei und schützt sie automatisch vor Schema-Änderungen.

## Wo liegt die Konfiguration?

Im Container: `/data/config.json` — das wird über das Volume-Mount auf den Host durchgereicht.

Standard auf Unraid: `/mnt/user/appdata/itsweber-mesh/config.json`.

## Schema-Migrations-Chain

Mesh hat eine Migration-Chain (`apps/web/src/server/config/migrations.ts`). Beim Container-Start läuft `runMigrations`:

1. Liest aktuelle Config-Version aus dem JSON
2. Wenn Version < `CURRENT_VERSION`: Migration für jeden Schritt durchlaufen
3. Bei Erfolg: persistierte Config hat neue Version
4. Bei Fehler: Container startet nicht — Logs zeigen genau welcher Schritt

Aktuelle Version: **v17** (Stand 2026-04-29).

## Automatisches Backup VOR jedem Bump

Vor jedem Schema-Bump legt der Store ein Backup an:

```
/data/config.json.pre-vN
```

Beispiele aus dem Live-System:

```
config.json
config.json.pre-v15
config.json.pre-v16
config.json.pre-v17
```

**Bestehende Backups werden nie überschrieben** — wenn `pre-v17` schon existiert (z. B. weil der Container schonmal von 16→17 migriert hat), wird ein neuer Bump das Backup nicht ersetzen.

## Manuelle Backups

Empfohlen: täglicher rsync auf einen anderen Host:

```bash
rsync -av --delete /mnt/user/appdata/itsweber-mesh/ backup-host:/path/to/mesh-backup/
```

Oder alle paar Tage einen Snapshot des kompletten `appdata`-Pfads — das ist Unraid-Standard via [Appdata-Backup-Plugin](https://forums.unraid.net/topic/137710-plugin-appdatabackup/).

## Restore

```bash
# Container stoppen
docker stop itsweber-mesh

# Backup zurückspielen
cp config.json.pre-v17 config.json

# Container starten
docker start itsweber-mesh
```

Beim Start läuft die Migration nochmal — wenn das die selbe Version war, ist es ein No-op.

## Was bei einem korrupten Backup tun?

Mesh kann auf einer leeren `/data` starten — der First-Run-Wizard läuft dann durch und legt eine fresh Config an. Ist also kein Datenverlust möglich, nur Konfigurations-Verlust.

Wenn die `config.json` zu sehr beschädigt ist:

```bash
mv config.json config.json.broken
# Container neustarten — fresh Config wird angelegt
docker restart itsweber-mesh
```

## Schema-Versionen-Historie

| Version | Wann       | Inhalt (Highlights)                                |
|--------:|------------|----------------------------------------------------|
|       1 | v0.1       | Initial                                            |
|       8 | v0.4       | Multi-Board-Support                                 |
|      10 | v1.0       | Header-Search, OIDC                                 |
|      13 | v1.2       | Editierbare Help-Items, Editor-Rolle                |
|      14 | v1.4.2     | Command-Overview-Banner, Quick-Actions              |
|      15 | v1.4.3     | Grid 12×80 → 24×20                                  |
|      16 | v1.4.6     | Z2M Auto-Discovery                                  |
|    **17** | **v1.5.0** | **Routen-basierte Nav, services[].pinnedToHome**   |

Vollständige Liste: `apps/web/src/server/config/migrations.ts`.

## Pre-Release-Validation

Bei Major-Schema-Bumps testen wir:

1. Live-Config kopieren in eine isolierte Test-Instanz
2. Container mit neuem Image starten → Migration läuft
3. UI manuell durchklicken → keine 500er, keine fehlenden Daten

Erst dann wird `:latest` aktualisiert.
