# Unraid Community Apps Template

This directory ships an Unraid Community Apps template you can install
directly without waiting for the Community Apps store listing.

## Quick install (recommended)

1. Open Unraid → **Apps** tab
2. Click the gear icon (top-right) → **Template repositories**
3. Paste the raw template URL:
   ```
   https://raw.githubusercontent.com/ITSWEBER-OFFICIAL/itsweber-mesh/main/unraid/itsweber-mesh.xml
   ```
4. Save
5. Go back to **Add Container**, choose **ITSWEBER Mesh** from the dropdown
6. Generate a session secret and paste it into the `MESH_SESSION_SECRET` field:
   ```bash
   openssl rand -hex 32
   ```
7. Click **Apply** — Unraid pulls the image from GHCR and starts the container.
8. Open the WebUI port (default 3000). The first-run wizard creates your admin
   user and switches auth to `userPassword` automatically.

## Per-field reference

| Field | Required | Notes |
|---|---|---|
| WebUI Port | yes | default 3000 |
| Config & Backups Volume | yes | persists `config.json`, default `/mnt/user/appdata/itsweber-mesh` |
| `MESH_SESSION_SECRET` | yes | 32+ chars, **reuse across container replaces** |
| `TZ` | optional | default `Europe/Berlin` |
| Unraid GraphQL Socket | optional | enables the native Unraid widget without an HTTP key |

## Upgrading

Unraid pulls the `:latest` tag on every restart. Pin a specific version by
editing the container repository to `ghcr.io/itsweber-official/itsweber-mesh:v1.5.1`.

Schema migrations run automatically on the first read after upgrade and write
a backup to `${DATA_DIR}/config.json.pre-v{N}` before every bump.
