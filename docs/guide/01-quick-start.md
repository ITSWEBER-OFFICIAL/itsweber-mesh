# Quick Start

Von 0 zu einem laufenden ITSWEBER Mesh in unter 5 Minuten.

## Voraussetzungen

- Docker (Linux, macOS oder Windows mit WSL2)
- Ein freier Port — Default ist `3000`
- ~150 MB freier Speicher für das Image

> Auf **Unraid**? Direkt zu [Unraid-Installation](03-unraid-installation.md) springen — dort zeigen wir die Variante über die Community Apps.

## Schritt 1 — Verzeichnis anlegen

Mesh persistiert seine komplette Konfiguration in einem einzigen Volume.
Lege ein leeres Verzeichnis an:

```bash
mkdir -p ~/itsweber-mesh-data
```

## Schritt 2 — Session-Secret erzeugen

Mesh signiert Session-Cookies mit einem HMAC-Secret. Erzeuge einmalig **mindestens 32 Zeichen** und speichere ihn — er wird bei jedem Container-Replace wiederverwendet.

```bash
openssl rand -hex 32
# Beispiel-Output: 1e3741a206ef84dde3cad5c7e6aa31b4d151e87c605d5ffdbf1b273ea81f99d1
```

> ⚠ Wenn du den Secret bei einem Restart änderst, werden alle aktiven Sessions invalidiert und alle Nutzer müssen sich neu einloggen.

## Schritt 3 — Container starten

```bash
docker run -d \
  --name itsweber-mesh \
  --restart=unless-stopped \
  -p 3000:3000 \
  -e MESH_SESSION_SECRET="<dein-secret-hier>" \
  -e TZ="Europe/Berlin" \
  -v ~/itsweber-mesh-data:/data \
  ghcr.io/itsweber-official/itsweber-mesh:latest
```

## Schritt 4 — Im Browser öffnen

→ http://localhost:3000

Beim ersten Aufruf läuft der **First-Run-Wizard**: er fragt Dashboard-Name, Sprache und Theme ab und legt deinen Admin-User an.

## Was als nächstes?

1. **Services** anlegen — Admin → Inhalte → Services
2. **Häufig genutzte** auf das Dashboard pinnen — Toggle in jedem Service-Editor
3. **Integrationen** verbinden — Admin → Integrationen (Home Assistant, Glances, AdGuard … siehe [Integrations-Übersicht](20-integrations-overview.md))
4. **Theme** anpassen — Admin → System → Theme

## Mit docker-compose

```yaml
services:
  mesh:
    image: ghcr.io/itsweber-official/itsweber-mesh:latest
    container_name: itsweber-mesh
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      MESH_SESSION_SECRET: ${MESH_SESSION_SECRET}
      TZ: Europe/Berlin
    volumes:
      - ./mesh-data:/data
```

In `.env`:

```env
MESH_SESSION_SECRET=1e3741a206ef84dde3cad5c7e6aa31b4d151e87c605d5ffdbf1b273ea81f99d1
```

Starten: `docker compose up -d`.
