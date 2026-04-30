# Integrations Setup Guide

User-facing walkthrough für jede unterstützte Integration.
Diese Anleitung gilt für **jede** ITSWEBER Mesh-Installation, nicht nur für ein spezifisches Setup.

## Unraid

Mesh kann eine **oder mehrere** Unraid-Instanzen anzeigen. Die Wahl hängt davon ab, wo das Mesh-Container läuft:

### Szenario A: Mesh läuft AUF dem Unraid-Server (lokal)

Empfohlen für die "Haupt"-Instanz, da am performantesten und sicher.

**Voraussetzungen:**
- Mesh-Container hat den Unraid-API-Socket gemountet (im Standard-`docker run` enthalten):
  ```
  -v /var/run/unraid-api.sock:/var/run/unraid-api.sock:ro
  ```
- Container läuft als `USER root` (im Dockerfile gesetzt) — Socket hat mode `750 root:root`

**Schritte:**
1. SSH auf den Unraid-Host: `unraid-api apikey --create` → Wizard, gewünschte Permissions wählen, Key kopieren
2. Im Mesh: **Admin → Integrationen → Unraid → Hinzufügen**
3. Name: frei wählbar (z.B. "ITSWEBER-CORE")
4. Verbindung: **Lokaler Unix-Socket**
5. API Key: einfügen
6. Speichern → InfraNode-Karte unter **Admin → Server-Karten** anlegen und mit dieser Integration verknüpfen

### Szenario B: Mesh greift auf einen REMOTE Unraid-Server zu

Nötig für sekundäre Nodes oder wenn Mesh außerhalb von Unraid läuft.

**Voraussetzungen:**
- Remote Unraid-Server mit unraid-api Plugin (ab Unraid 7.x standardmäßig dabei)
- Die WebGUI ist vom Mesh-Host aus erreichbar (ggf. Firewall-Regeln prüfen)

**Schritte:**
1. SSH auf den Remote-Unraid: `unraid-api apikey --create` → Key generieren
2. WebGUI-URL des Remote-Servers feststellen — typisch: `http://<IP>:80` (Standard) oder `http://<IP>:1580` (custom HTTP-Port falls geändert)
3. Im Mesh: **Admin → Integrationen → Unraid → Hinzufügen**
4. Verbindung: **Remote-URL**
5. Remote-URL: WebGUI-URL **inklusive Port**, z.B. `http://192.168.1.10:1580` oder `https://meinunraid.example.com`
6. API Key: einfügen
7. Speichern

**WICHTIG — was NICHT funktioniert:**
- ❌ `*.local`-Hostnames (mDNS) — Container kann das nicht auflösen, Container-DNS kennt nur klassisches DNS
- ❌ `unraid-api start --port XYZ` — diese CLI-Option existiert nicht. Der GraphQL-Endpoint ist immer über den WebGUI-Port erreichbar (`/graphql`-Pfad).
- ❌ Hostname statt IP, wenn der Mesh-Host das nicht auflösen kann

**Wenn es nicht klappt:**
- Im Browser auf dem Mesh-Host (oder via SSH/curl im Container) testen:
  ```bash
  curl -X POST -H "Content-Type: application/json" -H "x-api-key: DEIN_KEY" \
    -d '{"query":"{ online }"}' http://<URL>/graphql
  ```
  Antwort sollte `{"data":{"online":true}}` sein. Wenn nein → Netzwerk-/Firewall-Problem oder falsche URL.

## Home Assistant

**Voraussetzungen:** HA 2023.7 oder neuer (für Areas-Template-API).

**Schritte:**
1. In HA: Profil → "Long-lived access tokens" → neuen Token erstellen, kopieren
2. Im Mesh: **Admin → Integrationen → Home Assistant**
3. Base URL: `https://home.example.com` (deine HA-URL, ohne trailing slash)
4. Long-Lived Token: einfügen
5. Speichern

Funktioniert mit HA OS, Supervised, Container und Core. CPU/RAM-Anzeige nur wenn Supervisor aktiv (HA OS oder Supervised).

## AdGuard Home

**Wichtig:** Standard-Setup-Port ist `3000`, der eigentliche Service läuft danach auf `80`/`443` oder einem Custom-Port (oft `3001`). Wenn das Widget keine Daten liefert, prüfe den tatsächlichen Port.

**Schritte:**
1. AdGuard-WebGUI → Settings → Allgemeine Einstellungen → Admin-User/Passwort notieren
2. Im Mesh: Base URL z.B. `http://192.168.1.30:3001`, Username + Passwort eintragen

## UniFi (UDM Pro / Cloud Key)

Funktioniert mit jedem UniFi-OS-Console (UDM, UDM Pro, UDM SE, Cloud Key Gen2+).

**Schritte:**
1. UniFi-WebGUI → Settings → Control Plane → Integrations → API Keys → "Create New"
2. Im Mesh: Controller-URL `https://<console-IP>` (mit `https://`!), Site-ID lassen auf `default`, TLS-Verify deaktiviert (UDM nutzt selbstsigniertes Cert)

## Glances (für Live CPU/RAM jeder Linux-Maschine)

Sehr empfohlen für Server ohne Unraid-API (Proxmox-Hosts, TrueNAS, generische Linux-Boxen) und als Ergänzung für Unraid-Nodes.

**Voraussetzungen:** Glances-Container auf dem Ziel-Host:
```bash
docker run -d --name=glances --net=host --pid=host --restart=unless-stopped \
  -e GLANCES_OPT="-w" nicolargo/glances:latest-full
```

Web-UI / API ist dann auf Port **61208** verfügbar.

**Schritte:**
1. Im Mesh: **Admin → Integrationen → Glances Hosts → Hinzufügen**
2. Name + Base URL `http://<IP>:61208`
3. Optional: Basic-Auth-Credentials wenn Glances mit `--password` läuft

**InfraNode-Verknüpfung:** Im Server-Karten-Form gibt es ein optionales Feld "Glances-Host". Wenn gesetzt, zeigt die InfraNode-Karte die Live-CPU/RAM-Werte aus Glances statt der statischen Unraid-Werte.

## Pi-hole

Unterstützt mehrere Pi-hole-Instanzen (Multi-Instance).

**Voraussetzungen:** Pi-hole v5+ oder Pi-hole v6 (FTL-API).

**Schritte:**
1. Pi-hole WebGUI → Settings → API/Web interface → Long-lived Token generieren (oder `WEBPASSWORD`-Hash aus `/etc/pihole/setupVars.conf` entnehmen)
2. Im Mesh: **Admin → Integrationen → Pi-hole → Hinzufügen**
3. Name + Base URL: `http://<pihole-ip>` (kein Port nötig wenn Standard 80)
4. API-Token: aus Schritt 1 einfügen
5. Speichern

**Wichtig:** `*.local`-Hostnamen funktionieren nicht (mDNS, siehe Container-Limitierung). IP-Adresse verwenden.

## Portainer

Unterstützt mehrere Portainer-Instanzen (Multi-Instance).

**Voraussetzungen:** Portainer CE oder BE, v2.x oder neuer.

**Schritte:**
1. Portainer WebGUI → Account (oben rechts) → Access Tokens → "Add access token"
2. Token-Namen vergeben, Token kopieren
3. Im Mesh: **Admin → Integrationen → Portainer → Hinzufügen**
4. Name + Base URL: `https://<portainer-ip>:9443` (Standard-HTTPS-Port)
5. API-Key: Token aus Schritt 2
6. Endpoint-ID: Standard `1` (sichtbar in Portainer-URL `/#!/1/docker/...`)
7. TLS-Verify: deaktivieren wenn selbstsigniertes Zertifikat

Das Widget zeigt alle Container des konfigurierten Endpoints gruppiert nach Status (Running / Stopped / Paused).

## Uptime Kuma

**Voraussetzungen:** Uptime Kuma v1.17+ mit aktivierter Status-Page.

**Schritte:**
1. Uptime Kuma → Status Pages → eine Status-Page anlegen oder öffnen
2. URL-Slug notieren (z.B. `https://status.example.com/status/mein-status` → Slug: `mein-status`)
3. Im Mesh: **Admin → Integrationen → Uptime Kuma**
4. Base URL: `https://status.example.com` (ohne `/status/...`)
5. Status-Page-Slug: `mein-status`
6. Speichern

Das Widget zeigt alle Monitors der Status-Page mit ihrem aktuellen Status.

## Speedtest Tracker

Unterstützt mehrere Speedtest-Tracker-Instanzen (Multi-Instance). Kompatibel mit [alexjustesen/speedtest-tracker](https://github.com/alexjustesen/speedtest-tracker).

**Schritte:**
1. Speedtest-Tracker WebGUI → Settings → API-Key erstellen (oder `APP_KEY` aus der `.env` des Containers)
2. Im Mesh: **Admin → Integrationen → Speedtest Tracker → Hinzufügen**
3. Name + Base URL: `http://<speedtest-ip>:8765` (Standard-Port)
4. Bearer Token: API-Key aus Schritt 1
5. Speichern

Das Widget zeigt den letzten gemessenen Download/Upload/Ping-Wert.

## Frigate (NVR)

Unterstützt mehrere Frigate-Instanzen (Multi-Instance).

**Voraussetzungen:** Frigate v0.13+.

**Schritte:**
1. Frigate WebGUI → Settings → Auth-Mode prüfen:
   - **Kein Auth (Standard):** Auth-Mode `none` wählen
   - **JWT-Auth aktiviert:** Auth-Mode `jwt`, Bearer-Token aus Frigate eintragen
2. Im Mesh: **Admin → Integrationen → Frigate → Hinzufügen**
3. Name + Base URL: `http://<frigate-ip>:5000`
4. Auth-Mode + ggf. Username/Passwort
5. Speichern

Das Widget zeigt erkannte Objekte und Kamera-Status.

## ESPHome

Unterstützt mehrere ESPHome-Instanzen (Multi-Instance). Mesh spricht direkt mit dem eingebetteten Webserver der ESPHome-Geräte — kein HA-Proxy.

**Voraussetzungen:** ESPHome-Gerät mit `web_server:` Component im YAML:
```yaml
web_server:
  port: 80
```

**Schritte:**
1. Im Mesh: **Admin → Integrationen → ESPHome → Hinzufügen**
2. Name + Base URL: `http://<device-ip>` (Port 80 Standard)
3. Passwort (optional): nur wenn `web_server: auth:` konfiguriert
4. Speichern

**Auto-Erkennung v2/v3:** Mesh erkennt automatisch ob das Gerät die moderne ESPHome v3 API (SSE) oder die ältere REST-API (v2) verwendet. Server-Side-Events werden über `node:http` direkt gelesen (kein `fetch()` — Next.js würde SSE puffern).

**Hinweis Routing:** Wenn Mesh in einem anderen VLAN als die ESP-Geräte läuft (z.B. IoT-VLAN), muss eine Firewall-Regel "LAN → IoT" existieren.

## Zigbee2MQTT

**Voraussetzungen:** Home Assistant muss konfiguriert sein (ITSWEBER Mesh nutzt die HA Template-API zur Z2M-Geräte-Enumeration) — oder direktes MQTT (ab v1.7).

**Schritte:**
1. Sicherstellen, dass Home Assistant konfiguriert ist (siehe [Home Assistant](#home-assistant))
2. Im Mesh: **Admin → Integrationen → Zigbee2MQTT aktivieren** (Toggle)
3. Source-Modus:
   - **auto (empfohlen):** Mesh enumeriert Z2M-Geräte via HA Template-API automatisch — kein manuelles Group-Setup nötig
   - **ha (Legacy):** Explizite HA-Group-Entity angeben (z.B. `group.zigbee2mqtt_devices`)
4. Speichern

Das Widget zeigt Bridge-Status (online/offline), Bridge-Version sowie alle gepaarten Geräte mit ihrem Availability-Status.

## OpenWeatherMap (Wetter-Widget)

**Voraussetzungen:** Kostenloser [OpenWeatherMap](https://openweathermap.org/)-Account für den API-Key.

**Schritte:**
1. openweathermap.org → Account → API keys → Key kopieren
2. Im Mesh: **Admin → Integrationen → Wetter**
3. Aktivieren (Toggle)
4. Breitengrad + Längengrad: Koordinaten des Standorts (z.B. Berlin: `52.52` / `13.405`)
5. Ortsname: frei wählbar, wird im Widget angezeigt
6. Einheit: Celsius oder Fahrenheit
7. API-Key: aus Schritt 1
8. Speichern

Das Widget zeigt aktuelle Temperatur, Wetterbeschreibung und Icon.

## Custom REST

Erlaubt das Einbinden beliebiger HTTP/REST-APIs via JSONPath-Proxy. Kein eigenes Backend nötig — Mesh führt den Request serverseitig aus und gibt das extrahierte Ergebnis zurück.

**Konfiguration in Admin → Widgets → Custom REST Widget:**
- **URL:** Ziel-API-Endpunkt, z.B. `http://192.168.1.100/api/status`
- **JSONPath:** Pfad zum gewünschten Wert, z.B. `$.data.temperature`
- **Label:** Anzeigename
- **Refresh-Intervall:** in Sekunden

**Sicherheit:**
- **Private Networks:** Standard erlaubt (für Homelab-Adressen); kann in Admin → Integrationen → Custom REST deaktiviert werden
- **Allowed Hosts:** Optionale Whitelist — wenn nicht leer, werden nur diese Hosts akzeptiert

## OAuth2/OIDC (Single Sign-On)

Ab v1.4.1 unterstützt Mesh vollständiges OIDC/OAuth2 via `openid-client@6`.  
Getestet mit Authentik und Keycloak; jeder OIDC-konforme Provider sollte funktionieren.

### Pflicht-ENV

```bash
-e MESH_SESSION_SECRET=<min-32-zeichen-random-string>
```

Generieren: `openssl rand -hex 32`. **Beim Container-Replace wiederverwenden** — neues Secret invalidiert alle aktiven Sessions.

### Authentik-Setup

1. **Application erstellen:** Authentik → Applications → Create Application  
   - Name: `ITSWEBER Mesh`, Slug: `itsweber-mesh`

2. **OAuth2/OpenID Provider erstellen:**  
   - Authorization flow: `default-provider-authorization-explicit-consent`  
   - Client type: **Confidential**  
   - Redirect URI: `https://<mesh-domain>/api/auth/oidc/callback`  
   - Scopes: `openid profile email` (+ ggf. `groups` für Role-Mapping)  
   - Client ID + Secret notieren

3. **Issuer-URL ermitteln:** Authentik → System → Advanced → API  
   Oder: `https://<authentik-host>/application/o/<slug>/`  
   Verify: `https://<authentik-host>/application/o/<slug>/.well-known/openid-configuration`

4. **Mesh konfigurieren:** Admin → Auth → OAuth2/OIDC aktivieren  
   - Issuer URL: `https://<authentik-host>/application/o/<slug>/`  
   - Client ID + Secret eintragen  
   - Redirect URI: `https://<mesh-domain>/api/auth/oidc/callback`  
   - Group-Claim: `groups` (Standard bei Authentik)  
   - Admin Groups: Name der Authentik-Gruppe die Admin-Zugriff bekommen soll  
   - Fallback-Rolle: `viewer` (Nutzer ohne passende Gruppe)

### Keycloak-Setup

1. **Realm** öffnen → Clients → Create  
   - Client ID: `itsweber-mesh`  
   - Client Protocol: `openid-connect`  
   - Access Type: `confidential`  
   - Valid Redirect URIs: `https://<mesh-domain>/api/auth/oidc/callback`

2. Nach Speichern: Tab **Credentials** → Secret kopieren

3. **Issuer-URL:** `https://<keycloak-host>/realms/<realm-name>`  
   Verify: `https://<keycloak-host>/realms/<realm-name>/.well-known/openid-configuration`

4. Mesh konfigurieren analog zu Authentik.

### Generischer OIDC-Provider

Jeder Provider der den OIDC Discovery-Endpoint (`/.well-known/openid-configuration`) bereitstellt sollte funktionieren. Minimal nötig:

- `authorization_endpoint`
- `token_endpoint`
- `userinfo_endpoint`
- `jwks_uri`

### Reverse Proxy — Pflichtanforderungen

Mesh läuft intern als HTTP auf Port 3000. Wenn ein Reverse Proxy (NPM, Traefik, Caddy, nginx) davor sitzt, **muss** der Proxy folgende Header setzen, damit die OIDC-Callback-URL korrekt als `https://<domain>/api/auth/oidc/callback` gebaut wird:

```nginx
X-Forwarded-Proto: https
Host: <mesh-domain>          # wird von NPM/Traefik automatisch gesetzt
```

Mesh liest diese Header und baut daraus die öffentliche Callback-URL. Fehlen sie, schickt die App intern `http://0.0.0.0:3000/api/auth/oidc/callback` an den IDP — was zu Redirect-URI-Fehlern oder kaputten Post-Login-Redirects führt.

**NPM (Nginx Proxy Manager):** Setzt `X-Forwarded-Proto` und `Host` standardmäßig — keine Extra-Konfiguration nötig.  
**Traefik:** Setzt beide Header automatisch.  
**Caddy:** Setzt beide Header automatisch.  
**Manuelles nginx:** `proxy_set_header X-Forwarded-Proto $scheme;` und `proxy_set_header Host $http_host;` in den `location`-Block.

### Troubleshooting

| Problem | Lösung |
| --- | --- |
| Server startet nicht | `MESH_SESSION_SECRET` fehlt oder < 32 Zeichen |
| "Redirect URI Error" beim IDP | Callback-URL im IDP nicht eingetragen: `https://<domain>/api/auth/oidc/callback` — exakt, mit HTTPS |
| "Code-Exchange ungültig" | Reverse Proxy setzt `X-Forwarded-Proto` nicht → App schickt `http://...` statt `https://...` an den IDP. Proxy-Konfiguration prüfen (siehe oben) |
| Nach Login Weiterleitung zu `0.0.0.0:3000` | Gleiche Ursache wie Code-Exchange-Fehler — `X-Forwarded-Proto`/`Host`-Header fehlen |
| Login-Loop | Issuer-URL falsch oder Discovery-Endpoint nicht erreichbar |
| Alle Nutzer bekommen `viewer` | Group-Claim-Name stimmt nicht (`groups` vs. `Group`) |
| "State mismatch" Fehler | Mehrere Login-Tabs gleichzeitig — nur einen Tab verwenden |
| Nach Container-Replace ausgeloggt | `MESH_SESSION_SECRET` hat sich geändert — beim Replace wiederverwenden |
| Altes `mesh_session`-Cookie nach Moduswechsel | Session bleibt 24 h gültig. Wer sofort ausloggen will: Cookies im Browser löschen oder `MESH_SESSION_SECRET` rotieren |

## Generelle Tipps

- **Speichern-Feedback:** Jede Mutation zeigt einen Toast oben rechts (grün = OK, rot = Fehler mit Details)
- **Verbindungstest:** Direkt nach dem Speichern wird das zugehörige Widget automatisch aktualisiert. Status sichtbar in den Widgets oder im Browser auf `/api/widgets/<integration>` (JSON-Response zeigt `online: true/false` + Fehlertext)
- **Logs:** `docker logs -f ITSWEBER-Mesh` zeigt API-Aufrufe und Fehler im JSON-Format (pino)
- **Rollback:** Vor jedem Schema-Bump wird die alte config.json als `.pre-vX.Y` gesichert
