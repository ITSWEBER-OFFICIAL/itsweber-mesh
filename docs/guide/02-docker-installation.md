# Docker-Installation

> Im Detail. Für die Schnell-Variante: [Quick Start](01-quick-start.md).

## docker run vs docker-compose

| Use-Case                          | Empfehlung      |
|-----------------------------------|-----------------|
| Mal eben testen                   | `docker run`    |
| Permanente Installation           | `docker-compose`|
| Auf Unraid                        | [Community Apps](03-unraid-installation.md) |

## Vollständiges `docker-compose.yml`

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
      DATA_DIR: /data
      PORT: "3000"
      TZ: Europe/Berlin
      # NODE_OPTIONS: "--max-old-space-size=512"   # für RAM-arme Hosts
    volumes:
      - ./mesh-data:/data
      # Optional — Unraid GraphQL Socket für native Unraid-Stats
      # - /var/run/unraid-api.sock:/var/run/unraid-api.sock:ro
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Reverse-Proxy (Nginx Proxy Manager)

Mesh selbst macht kein TLS. Hinter NPM:

1. Stream auf `http://<container-ip>:3000` weiterleiten
2. Wildcard-Domain z. B. `mesh.deine-domain.de`
3. Force-SSL aktivieren, HTTP → HTTPS Redirect
4. Block für WebSockets / SSE: `proxy_read_timeout 3600s;` damit ESPHome v3 SSE nicht abreißt

## Volume-Layout

```
/data/
├── config.json              ← live config (zod-validated)
├── config.json.pre-v15      ← schema-bump backup
├── config.json.pre-v16      ← never overwritten
├── config.json.pre-v17      ← latest backup
└── memory/                  ← optional auto-memory data
```

## Image-Update

```bash
docker pull ghcr.io/itsweber-official/itsweber-mesh:latest
docker stop itsweber-mesh && docker rm itsweber-mesh
docker run -d \
  --name itsweber-mesh ... \
  -e MESH_SESSION_SECRET="$MESH_SESSION_SECRET" \   # WIEDERVERWENDEN!
  -v /pfad/mesh-data:/data \
  ghcr.io/itsweber-official/itsweber-mesh:latest
```

## Rollback

```bash
# Vorheriges Image:
docker run -d ... ghcr.io/itsweber-official/itsweber-mesh:v1.5.0
# UND vor dem Start die Config zurückspielen, falls Schema-Bump dazwischen:
cp /pfad/mesh-data/config.json.pre-v17 /pfad/mesh-data/config.json
```

## Resource-Bedarf

- RAM: ~80–150 MB im Idle, Peaks bei großen Polls bis ~250 MB
- CPU: <1 % im Idle, Peaks bei Healthcheck-Sweeps
- Disk: Image ~150 MB, Config (`/data`) ~100–500 KB
