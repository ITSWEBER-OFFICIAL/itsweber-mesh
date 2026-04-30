# Portainer

Container-Management-UI über Portainer-API + API-Key. **Multi-Instance** (z. B. CORE + NODE separat).

## Was die Integration kann

- Container-Listung mit Status (running, stopped, paused)
- Stack-Übersicht
- Klick auf Container → springt in Portainer
- Aggregat-Counts in der Stat-Zeile (z. B. „20 / 35 Container")

## Voraussetzungen

- Portainer CE oder BE 2.19+
- API-Token: Portainer → User → „API Tokens" → „Add access token"
- Endpoint-ID (default 1, das ist der lokale Docker-Endpoint)

## Setup in Mesh

**Admin → Integrationen → Portainer** → „Hinzufügen":

- `label` — z. B. „Portainer Core"
- `baseUrl` — z. B. `http://192.168.1.10:9000`
- `apiKey` — aus Portainer-User-Profile
- `endpointId` — default 1; wenn du mehrere Endpoints in Portainer hast, die ID nutzen
- `verifyTls` — bei selbstsigniert auf false

Wiederhole für weitere Portainer-Instanzen.

## Widget verwenden

**Admin → Inhalte → Widgets → „Portainer"**. Settings:

- `integrationIds[]` — eine oder mehrere
- Container werden dann mit Server-Tag angezeigt

## Troubleshooting

- **„401 Unauthorized"** → API-Key abgelaufen oder gelöscht. In Portainer-User-Profile prüfen
- **Endpoint-Mismatch** → in Portainer hast du z. B. Endpoint 1 = local, 2 = remote. Wenn 1 nicht antwortet → endpointId 2 setzen
- **Container-Limits** → Portainer-API liefert max. 1000 Container per Request. Bei sehr großen Setups: Filter im Widget setzen

## API-Endpoints (für Debug)

| Endpoint                                                    | Zweck             |
|-------------------------------------------------------------|-------------------|
| `GET /api/endpoints`                                        | Endpoint-Listing   |
| `GET /api/endpoints/<id>/docker/containers/json?all=true`   | Container-Listing  |
| `GET /api/endpoints/<id>/docker/info`                       | Docker-Daemon-Info |
