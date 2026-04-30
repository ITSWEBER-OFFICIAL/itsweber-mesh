# Glances-Integration

[Glances](https://nicolargo.github.io/glances/) ist ein Python-basiertes System-Monitoring-Tool, das eine REST-API bereitstellt. Mesh nutzt es, um die **Server-Karten** (InfraNodes) auf dem Dashboard mit live CPU-, RAM- und Last-Werten zu füttern.

## Warum Glances und nicht Unraid GraphQL?

Unraid's GraphQL-API liefert nur **statische** Infos: CPU-Modell, Cores, Total-RAM, Array-Größe. Live-CPU% und Live-RAM% sind dort **nicht** verfügbar. Glances füllt die Lücke und funktioniert auf jedem Linux/macOS/Windows-Host — nicht nur Unraid.

## Installation auf Unraid

Direkt im **Apps-Tab**:

1. Suche **„glances"** → wähle das Template von **Roxedus** oder **SelfhostedPro** → Install
2. Defaults beibehalten, nur prüfen:
   - **Network Type:** `Host` (zwingend! sonst keine Network-/Hostname-Stats)
   - **WebUI Port:** `61208`
   - **/var/run/docker.sock:** read-only Mount (für Container-Liste)
3. Apply

Test im Browser: `http://<server-ip>:61208` → Glances-Web-Oberfläche erscheint.

## Installation per Konsole (jeder Linux-Host)

```bash
docker run -d \
  --name=Glances \
  --restart=unless-stopped \
  --network=host \
  --pid=host \
  -e TZ=Europe/Berlin \
  -e GLANCES_OPT="-w" \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  nicolargo/glances:latest-full
```

- `--network=host` → echte Interfaces sehen (br0, eth0…)
- `--pid=host` → korrekte Prozess-/Last-Stats des Hosts
- `-e GLANCES_OPT="-w"` → Web-Modus auf Port 61208
- `:latest-full` → enthält NVML (NVIDIA-GPU-Stats) und sensors-Bibliothek

## In Mesh einbinden

1. **Admin → Integrationen → Glances** → „Hinzufügen"
   - Label: z. B. „Glances Core"
   - URL: `http://<server-ip>:61208`
   - (optional: Username/Password, falls hinter Auth)
2. Wiederholen pro Server (z. B. „Glances Node")
3. **Admin → Inhalte → Server-Karten** → bei jedem InfraNode unter „Glances-Verknüpfung" die passende Glances-Instanz auswählen
4. Speichern → nach ~5–10 Sekunden erscheinen die blauen CPU- und RAM-Balken auf dem Dashboard

## Was du dann siehst

- **CPU-Bar** mit Live-% (gelb ab >85 %)
- **RAM-Bar** mit Live-% + verbrauchten/totalen GB
- **Array-Bar** kommt aus Unraid-GraphQL (statisch)
- **Hostname** in der Sub-Zeile aus Glances
- **OS-Version** aus Glances (Linux 6.12.x-Unraid)

## Troubleshooting

### „Live-Auslastung n. v. — Glances installieren"

Der Fallback-Text. Bedeutet: kein `glancesRef` am InfraNode gesetzt **oder** Glances-Container nicht erreichbar. Test:

```bash
curl http://<server-ip>:61208/api/4/cpu | head -c 100
# erwartet: {"total": 2.7, "user": 1.6, ...}
```

### CPU/RAM% sind 0 oder konstant

Prüfe ob Glances mit `--pid=host` läuft. Ohne diesen Flag sieht der Container nur seine eigenen Prozesse, nicht den Host.

### NVIDIA GPU-Stats fehlen

Voraussetzungen:

1. NVIDIA-Treiber + nvidia-container-runtime auf dem Host
2. Glances mit `:latest-full` (oder Custom-Build mit NVML)
3. `--gpus all` zum docker-run-Befehl ergänzen
4. Optional: `lm-sensors` auf dem Host installiert (für CPU-Temperatur)

### DNS-Fehler beim Image-Pull

Klassiker auf frisch eingerichteten Unraid-Nodes: DNS-Server steht auf `1.1.1.1` aber UDM/Router blockt outbound:53. Lösung: Settings → Network Settings → DNS Server auf `192.168.x.x` (Router) oder `8.8.8.8`.

## API-Endpoints, die Mesh liest

Für Debugging direkt mit `curl` ansprechbar:

| Endpoint                   | Liefert                                  |
|----------------------------|------------------------------------------|
| `/api/4/status`            | Glances-Version (Health-Probe)           |
| `/api/4/cpu`               | total %, user %, system %, idle %        |
| `/api/4/mem`               | total, available, used, percent (Bytes)  |
| `/api/4/system`            | hostname, os_name, os_version, hr_name   |
| `/api/4/load` (mid-term)   | min1 / min5 / min15 — geplant für v1.6   |
| `/api/4/diskio`            | read/write Bytes/s — geplant für v1.6    |

## Mehr Daten auf den Server-Karten?

Die `/api/4/...`-Endpoints liefern viel mehr (Disk-I/O, Netzwerk-Throughput, Top-Prozesse, Sensoren). Roadmap v1.6 plant:

- Load-Average als Chip
- Disk-I/O (R/W MB/s) als Chip
- Network-Throughput am primären Interface
- CPU-Temperatur (via sensors)
- Mini-Sparkline für CPU-Verlauf der letzten 60 Sekunden
