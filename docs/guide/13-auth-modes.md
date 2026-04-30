# Auth-Modi — wer darf was?

Mesh hat ein **pluggable Auth-System** mit 4 Modi. Jeder Modus ist eine Strategy-Klasse in `apps/web/src/server/auth/`.

## Übersicht

| Modus           | Wer kann zugreifen?                | Wer kann admin-Routen?     | Use-Case                          |
|-----------------|------------------------------------|-----------------------------|------------------------------------|
| `open`          | jeder mit URL-Zugriff               | jeder                       | Dev / Heimnetz / hinter VPN        |
| `token`         | jeder mit URL-Zugriff               | nur mit Bearer-Token-Header | Heimnetz mit Admin-Schutz          |
| `userPassword`  | nach Login                          | nur Admin-Rolle             | Familien-Dashboard mit Auth        |
| `oauth2`        | nach OIDC-Login                     | Group-Mapping               | Production / SSO mit Authentik etc.|

## Pflicht: `MESH_SESSION_SECRET`

Für alle Modi außer `open`: in den Env-Vars muss `MESH_SESSION_SECRET` (32+ Zeichen) gesetzt sein. Das Secret signiert die Session-Cookies (HMAC-SHA256). Bei Container-Replace IMMER wiederverwenden.

## Wechsel des Modus

**Admin → Benutzer & Sicherheit → Auth**.

⚠ Vor dem Wechsel auf `userPassword` oder `oauth2`:

1. Mindestens einen Admin-Account anlegen (Admin → Benutzer → „Neuer Benutzer")
2. Erst dann den Modus aktivieren
3. Sonst: Aussperrung — Lösung über `/data/config.json` Edit + Container-Restart

## Mode `open`

Default beim First-Run. Keine Auth, jeder Aufruf ist Admin. Mesh zeigt einen **roten Warnbanner** im Dashboard solange `auth.mode === "open"`.

## Mode `token`

Ein einzelnes Bearer-Token pro Mesh-Instanz (`auth.token` in `config.json`). Senden via `Authorization: Bearer <token>`-Header — Browser-Erweiterung wie ModHeader oder Reverse-Proxy-Auth.

Vorteil: kein Login-Screen, gut für API-Integrationen
Nachteil: schlechter UX, ein-Token-für-alle

## Mode `userPassword`

Klassischer Login mit Username + bcrypt-Passwort.

- Rolle: `admin`, `editor`, `viewer`
- Admin-Routen erfordern `admin`
- Editor kann Inhalte ändern aber keine Auth/User
- Viewer = nur lesen

Passwort-Reset: nur durch direktes Bearbeiten der `config.json` (bcrypt-Hash neu setzen) — keine UI für Self-Service-Reset (kommt eventuell in v2.0).

## Mode `oauth2` (OIDC)

Production-tauglich, getestet mit **Authentik** + **Keycloak**.

### Voraussetzung: Reverse Proxy

Mesh läuft intern als **HTTP auf Port 3000**. Wenn ein Reverse Proxy davor sitzt (NPM, Traefik, Caddy …), muss er folgende Header setzen:

```nginx
X-Forwarded-Proto: https
Host: <mesh-domain>
```

Mesh baut daraus die öffentliche Callback-URL (`https://<domain>/api/auth/oidc/callback`). Fehlen die Header, schickt die App dem IdP eine `http://0.0.0.0:3000/…`-URL → **Redirect URI Error** oder kaputte Post-Login-Weiterleitung.

> NPM, Traefik und Caddy setzen diese Header standardmäßig — kein Extra-Aufwand nötig. Bei manuellem nginx: `proxy_set_header X-Forwarded-Proto $scheme;` und `proxy_set_header Host $http_host;` im `location`-Block ergänzen.

### Einrichtung in deinem IdP

1. **Application** anlegen mit:
   - Redirect-URI: `https://<mesh-url>/api/auth/oidc/callback`
   - Scopes: `openid` + `profile` + `email`
   - Optional: Group-Claim aktivieren (für Role-Mapping)

2. Daten notieren: `issuer-url`, `client-id`, `client-secret`

### Einrichtung in Mesh

**Admin → Auth → OAuth2 / OIDC** ausfüllen:

- `issuerUrl` (z. B. `https://auth.example.com/application/o/mesh/`)
- `clientId`, `clientSecret`
- `scopes`: `openid profile email` (default OK)
- **Group-Mapping** (optional):
  - `adminGroupClaim`: Name des Group-Claims (z. B. `groups`)
  - `adminGroupValues`: Liste der Gruppen, die Admin-Rolle bekommen
  - `editorGroupValues`: Editor-Gruppen
  - `fallbackRole`: was kriegen Nutzer ohne passende Group? Default `viewer`

### Technik

- PKCE + State + Nonce
- Token signiert als HS256-JWT mit MESH_SESSION_SECRET
- JWKS-Verifikation gegen den IdP
- Session-TTL: 24h
- Routen: `/api/auth/oidc/{start,callback,logout}`

### Bootstrap-Hard-Block

Ohne `MESH_SESSION_SECRET` ≥32 Zeichen UND `issuerUrl` UND `clientId` verweigert Mesh den Start im OAuth2-Modus — `instrumentation.ts` macht den Check beim Boot.

### Troubleshooting OAuth2 / OIDC

| Symptom | Ursache | Lösung |
| --- | --- | --- |
| **„Redirect URI Error"** beim IdP | Callback-URL im IdP nicht registriert | Im IdP `https://<domain>/api/auth/oidc/callback` als Redirect-URI eintragen (exakt, HTTPS) |
| **„Code-Exchange ungültig"** auf der Callback-Seite | Reverse Proxy setzt `X-Forwarded-Proto` nicht — App schickt `http://` statt `https://` an IdP | Proxy-Header prüfen (siehe oben) |
| **Weiterleitung zu `0.0.0.0:3000`** nach Login | Gleiche Ursache — fehlende Proxy-Header beim Post-Login-Redirect | Proxy-Header ergänzen |
| **„invalid_client"** im Container-Log | Client-Secret fehlt oder stimmt nicht | Im Auth-Formular Client-Secret eintragen und speichern |
| **„Ungültige OIDC-Session"** beim Speichern | Browser hat altes Cookie (z. B. aus `open`-Modus) | Cookies für die Mesh-Domain löschen, neu einloggen |
| Server startet nicht im oauth2-Modus | `MESH_SESSION_SECRET`, `issuerUrl` oder `clientId` fehlen | Pflichtfelder prüfen — Mesh blockiert den Start per Hard-Check |

## Tests

42+ Vitest-Tests für die Auth-Layer. Ausführen lokal:

```bash
pnpm test --run
```
