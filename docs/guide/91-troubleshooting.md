# Troubleshooting

Häufige Probleme + Lösungen, sortiert nach Symptom.

## Container

### Container startet nicht / Exit-Code 1 sofort beim Start

Prüfe Logs:

```bash
docker logs itsweber-mesh --tail 50
```

Häufigste Ursachen:

- **`MESH_SESSION_SECRET ist nicht gesetzt oder zu kurz`** — Variable fehlt in den Env-Vars oder ist <32 Zeichen. Erzeuge mit `openssl rand -hex 32` und übergib via `-e MESH_SESSION_SECRET=...`.
- **`OAuth2 mode aber issuerUrl/clientId fehlen`** — du hast Auth-Mode auf oauth2 gestellt, aber nicht alle Pflichtfelder ausgefüllt. Bootstrap-Hard-Block. Lösung: in `/data/config.json` `auth.mode: "open"` setzen (oder den Container temporär mit dem Backup ersetzen).
- **`Permission denied: /data/config.json`** — Volume-Mount-Permissions stimmen nicht. Auf dem Host: `chown -R root:root /pfad/zu/data` (Mesh läuft als root im Container, weil der Unraid-Socket-Mount sonst nicht klappt).

### WebUI lädt aber Seite ist weiß

- **Browser-Cache** ist die häufigste Ursache. Strg + F5 (hard refresh).
- Console-Fehler in den Browser-Devtools öffnen — wenn `Hydration mismatch`: meist ein Custom-CSS-Fehler. Setze in der `config.json` `theme.customCss: ""` und reload.

### Schema-Migration läuft nicht durch

- Logs zeigen `Config migrated and persisted` mit `from`/`to`-Versionen
- Wenn fehlgeschlagen: ein Backup wird unter `/data/config.json.pre-vN` angelegt → `cp /data/config.json.pre-vN /data/config.json`, dann Container neustarten und im Issue-Tracker melden mit Log-Auszug

## Healthchecks / Status-Anzeige

### Service zeigt „offline" obwohl er läuft

- **HTTP-Pings** akzeptieren nur `200/204/301/302/401`. Wenn dein Service `403` (Auth-Wall) oder `503` (Loading) liefert, schlägt der Check fehl. Ändere den Service-Eintrag → Ping-Typ auf „Kein Ping" oder erweitere die Allow-List in der `config.json`.
- **TCP-Pings** brauchen einen erreichbaren Port — wenn der Host gar nicht antwortet (z. B. Container down), dauert das bis zum Timeout (default 3s).
- **Container-DNS:** Mesh läuft im Bridge-Netzwerk. `*.local` (mDNS) wird in vielen Setups **nicht** aufgelöst. Lösung: IP statt Hostname benutzen, oder das eigene DNS (Pi-hole/AdGuard) in `docker-compose` als `dns:` eintragen.

### Status-Punkte im Header sind grau

- React-Query holt erst nach `staleTime` neu — beim ersten Aufruf bis zu 10s warten
- F5 erzwingt Refresh
- Logs prüfen: `docker logs itsweber-mesh | grep healthcheck` — fehlende Pings tauchen mit `pingTarget kind: ...` auf

## Auth & Login

### SSO / OAuth2 — „Redirect URI Error"

Authentik/Keycloak zeigt diesen Fehler wenn die App eine `redirect_uri` schickt, die im IdP nicht registriert ist.

**Ursache 1 — URI nicht eingetragen:** Im IdP die Redirect-URI `https://<mesh-domain>/api/auth/oidc/callback` ergänzen.

**Ursache 2 — Reverse Proxy fehlen Header:** Mesh baut die Callback-URL aus `X-Forwarded-Proto` + `Host`. Ohne diese Header entsteht `http://0.0.0.0:3000/api/auth/oidc/callback` — was nie im IdP steht. Sicherstellen dass der Proxy sendet:

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Host $http_host;
```

NPM, Traefik und Caddy tun das automatisch.

### SSO — „Code-Exchange ungültig" auf `/api/auth/oidc/callback`

Gleiche Ursache wie oben: der IdP lehnt den Token-Request ab weil die `redirect_uri` im Token-Exchange nicht mit der bei der Autorisierung übereinstimmt. Proxy-Header prüfen.

Im Container-Log taucht dann auf:

```json
"error": "invalid_client", "error_description": "Client authentication failed"
```

Zusätzlich prüfen: Ist das **Client-Secret** in Mesh gespeichert? Admin → Auth → OIDC-Formular → Client-Secret-Feld darf nicht leer sein (bei Confidential Clients Pflicht).

### SSO — Nach Login Weiterleitung zu `0.0.0.0:3000`

Gleiche Proxy-Header-Ursache, diesmal beim Post-Login-Redirect. Nach dem Fix der Headers den Browser-Cache leeren und erneut versuchen.

### Admin-Bereich trotz fehlendem Login erreichbar

Wenn sich der Auth-Modus ändert (z. B. von `open` auf `oauth2`), bleibt ein altes `mesh_session`-Cookie 24 h gültig. Der Benutzer ist damit noch authentifiziert — das ist kein Bug. Wer alle aktiven Sessions sofort invalidieren will: `MESH_SESSION_SECRET` im Container rotieren und neu starten.

## Integrationen

### Home Assistant — „Token ungültig"

- Long-Lived Access Token läuft nicht ab, **aber** wird ungültig wenn der Nutzer in HA gelöscht/passwort-resettet wird
- Test direkt: `curl -H "Authorization: Bearer <token>" https://home.example.com/api/` → erwartet `{"message": "API running."}`

### AdGuard — Statistiken zeigen 0

AdGuard's `/control/stats` liefert die letzten 24h als Array, nicht als Aggregat. Wir lesen die Felder `num_dns_queries` + `num_blocked_filtering` (Singular-Aggregate), die bei manchen älteren AdGuard-Versionen fehlen. Update auf AdGuard 0.107+ behebt das.

### UniFi — „Auth fehlgeschlagen"

- API-Key-Modus ist Pflicht ab UniFi 8.x. Generiere einen API-Key im UniFi-Account (nicht im Controller!).
- Bei selbstsignierten Zertifikaten: `verifyTls: false` in der Integration aktivieren

### Glances — siehe [Glances-Wiki](22-glances.md#troubleshooting)

### Frigate — Events fehlen

Frigate-Auth: wenn Frigate hinter einem Reverse-Proxy mit Basic-Auth steht, in der Mesh-Integration den Auth-Header eintragen. Sonst: `verifyTls: false` falls selbstsigniert.

### ESPHome — keine Sensoren sichtbar

- Voraussetzung: `web_server:` Component im ESPHome-YAML
- Test: `curl http://<esphome-ip>/sensor/list` → JSON mit Sensor-IDs
- v3-Geräte streamen via SSE auf `/events`. Wenn da nichts ankommt: ESPHome-Version prüfen, `web_server.version: 3` im YAML setzen

### Zigbee2MQTT — Geräte nicht erkannt (Auto-Modus)

Auto-Discovery liest aus Home Assistant via Template-API: `device_attr(<device_id>, 'identifiers')`. Voraussetzung:

1. Z2M an Home Assistant via MQTT angebunden (Standard-Setup)
2. HA hat MQTT-Discovery aktiviert
3. Mesh hat eine funktionierende HA-Integration

Wenn das nicht passt: Mode auf `ha` (Legacy) wechseln und eine HA-Group mit den Z2M-Geräten anlegen, oder auf `mqtt` (v1.7+) wechseln.

## Theme & UI

### Dashboard sieht „kaputt" aus nach Custom-CSS-Edit

- Custom-CSS hat Syntax-Fehler. Browser-Devtools → Console → CSS-Parse-Errors finden
- Schnell-Lösung: in `/data/config.json` das Feld `theme.customCss: ""` leeren, Mesh neu laden

### Theme wechselt nicht

- React-Query-Cache: bis zu 60 Sekunden, oder F5
- Wenn `data-theme` auf `<html>` nicht aktualisiert: prüfe ob `ThemeSync`-Komponente läuft (sollte in jeder Page eingebunden sein)

## Mobile-Ansicht

### Horizontaler Scroll auf dem Smartphone

Der `app-header` schrumpft unter 820 px auf 3 Spalten + Hamburger-Menü-Button. Bei Bug öffne ein Issue mit Screenshot + Browser/User-Agent.

### Widgets sehen falsch aus auf Mobile

Manche Widgets haben ein Mindest-Width. Bei `w<minWidth` schalten sie in den `compact`-Modus (kleine Kachel). Wenn dieser Modus zu früh kommt, im Edit-Mode `w` größer ziehen oder im Service/Widget-Editor das `wideThreshold` checken.

## Performance

### Dashboard ist langsam beim Laden

- Wenn `>50` Services konfiguriert sind: Healthcheck-Scheduler limitiert mit `p-limit(8)` parallel, aber alle 10s ein voller Sweep. Bei sehr vielen TCP-Targets (>30) ggf. Healthcheck-Intervall in einer kommenden Version konfigurierbar
- Container-Memory: für >100 Services ggf. `-e NODE_OPTIONS="--max-old-space-size=512"` setzen

### Image ist groß

Standard ~150 MB (Alpine + Next.js Standalone). `:latest-slim` (ohne lm-sensors / GPU-Tools) wäre denkbar — kommt evtl. in v1.6.

## Wenn nichts hilft

1. Logs sammeln: `docker logs itsweber-mesh --tail 200 > mesh.log`
2. Browser-Console-Errors als Screenshot
3. Issue auf [GitHub](https://github.com/ITSWEBER-OFFICIAL/itsweber-mesh/issues) öffnen — bitte ohne echte API-Keys/Tokens
