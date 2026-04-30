# UniFi Network

UniFi-Controller-Integration (UDM Pro / Cloud Key / selbst-gehostet) via API-Key.

## Was die Integration kann

- WAN-Status (online/offline, externe IP, Throughput)
- Verbundene Clients (Anzahl, Listing optional)
- Geräte (APs, Switches) mit Status
- Optional: Switch-Ports + PoE-Status (`showSwitchPorts`)

## Voraussetzungen

- UniFi Network Application 8.x+ (für API-Key-Auth)
- API-Key aus deinem **UniFi-Account** (nicht aus dem Controller!) — `https://account.ui.com/profile/api`
- Erreichbarkeit über `https://<ip>` (selbstsigniertes Cert akzeptiert)

## Setup in Mesh

**Admin → Integrationen → UniFi Network**. Felder:

- `controllerUrl` — z. B. `https://192.168.1.1`
- `apiKey` — aus deinem UI-Account
- `siteId` — `default` für die Hauptsite
- `verifyTls` — false bei selbstsignierten Zertifikaten (default)
- Toggles: `showWan`, `showClients`, `showDevices`, `showSwitchPorts`

## Widget verwenden

**Admin → Inhalte → Widgets → „UniFi Network"**.

## Troubleshooting

- **Auth fehlgeschlagen** → API-Key aus dem Controller funktioniert in 8.x **nicht** mehr. Aus dem UI-Account-Profil neu erstellen
- **403 Forbidden** → API-Key ist read-only / hat falsche Permissions
- **Selbstsigniertes Zertifikat** → `verifyTls: false`. Dauerhafte Lösung: Zertifikat mit Let's Encrypt + DNS-01 erneuern lassen
- **WAN-Status fehlt obwohl online** → `showWan: true` aktiviert? UDM hat manchmal mehrere WAN-Interfaces (Failover) — nur Primary wird angezeigt

## API-Endpoints (für Debug)

| Endpoint                              | Zweck                                  |
|---------------------------------------|----------------------------------------|
| `GET /proxy/network/integration/v1/sites` | Site-Listung                       |
| `GET /proxy/network/integration/v1/sites/<id>/devices` | Geräte             |
| `GET /proxy/network/integration/v1/sites/<id>/clients` | Clients             |
