import { v4 as uuidv4 } from "uuid";
import type { Config } from "./schema";
import { HOME_BOARD_ID } from "./migrations";

const wUnraid    = uuidv4();
const wSmartHome = uuidv4();
const wNetwork   = uuidv4();
const wStorage   = uuidv4();
const wAdguard   = uuidv4();

const infraNodeId = uuidv4();

const GOOGLE_ENGINE_ID = "00000000-0000-0000-0000-000000000010";
const DDG_ENGINE_ID    = "00000000-0000-0000-0000-000000000011";
const BRAVE_ENGINE_ID  = "00000000-0000-0000-0000-000000000012";

export const defaultConfig: Config = {
  version: 17,
  meta: {
    name: "ITSWEBER Mesh",
    locale: "de",
    subtitle: "Home Infrastructure",
    firstRunCompleted: false,
    migrationWarnings: [],
    domain: "",
    commandOverviewSubtitle: "",
    quickActions: [],
  },
  theme: {
    preset: "graphite-command",
    accent: "#2ea3f2",
    background: { kind: "solid" },
    backgroundPattern: "mesh",
    customCss: "",
  },
  layout: {
    showQuickAccess: true,
    showSystemBadge: true,
    serviceCardShowCategory: true,
    showCommandOverview: true,
  },
  auth: {
    mode: "open",
    users: [],
    oauth2: {
      scopes: ["openid", "profile", "email"],
      adminGroupValues: [],
      editorGroupValues: [],
      fallbackRole: "viewer",
      autoCreateUsers: false,
      userMapping: { emailClaim: "email", nameClaim: "name" },
    },
  },
  helpItems: [
    /* ── Erste Schritte ──────────────────────────────────────────────── */
    { id: uuidv4(), question: "Wie füge ich einen neuen Service hinzu?", answer: "Admin → Inhalte → Services → \"Neuer Service\". Fülle Name, URL und optional Icon/Beschreibung aus. Mit dem Toggle \"Auf Dashboard unter Häufig genutzt zeigen\" landet er auf der Startseite — sonst nur auf /services.", sortOrder: 0 },
    { id: uuidv4(), question: "Was ist der Unterschied zwischen Dashboard und Services-Seite?", answer: "Das Dashboard (/) zeigt nur als 'pinnedToHome' markierte Services in einer kompakten Liste — gedacht für die meistgenutzten 5-10 Apps. Die Services-Seite (/services) zeigt alle aktivierten Services mit voller Such- und Filter-Funktion.", sortOrder: 5 },
    { id: uuidv4(), question: "Wie sichere ich meine Konfiguration?", answer: "Die Konfiguration liegt in /data/config.json im Container. Mounte dieses Verzeichnis als Volume (-v /dein/pfad:/data). Vor jedem Schema-Update legt das System automatisch ein Backup unter /data/config.json.pre-vN an — bestehende Backups werden nie überschrieben.", sortOrder: 10 },
    { id: uuidv4(), question: "Wie erstelle ich mehrere Boards?", answer: "Admin → Layout → Boards. Jedes Board hat einen eigenen Slug (z. B. /boards/media) und kann als Home-Board markiert werden. Services, Widgets, InfraNodes und Kameras können pro Board zugeordnet werden.", sortOrder: 20 },

    /* ── Theme & UI ───────────────────────────────────────────────────── */
    { id: uuidv4(), question: "Wie ändere ich das Theme?", answer: "Admin → System → Theme. Es gibt 7 vordefinierte Presets: Dark (Standard), Light, Terminal, ITSWEBER (Blau-Glassmorphism), Slate, Modern Light und Graphite Command. Akzentfarbe + Hintergrund-Muster + optionales Hintergrundbild sind pro Theme einstellbar.", sortOrder: 30 },
    { id: uuidv4(), question: "Kann ich eigenes CSS einbinden?", answer: "Ja — Admin → System → Custom CSS. Code wird live in den <head> injiziert, kein Rebuild nötig. Tipp: nutze die Klassen .app-header, .infra-card, .service-card, .widget-card als Anker. Achtung: CSS wird ungeprüft eingefügt, bei Syntax-Fehlern läuft das ganze Dashboard kaputt — dann temporär leeren via Admin oder direkt in config.json.", sortOrder: 40 },
    { id: uuidv4(), question: "Wie ordne ich die Anordnung auf dem Dashboard?", answer: "Klicke oben rechts auf 'Anordnung'. Im Edit-Modus kannst du Service-Karten, InfraNodes, Widgets per Drag-and-Drop verschieben und Widget-Größen anpassen (24×20-Grid). Speichern via Save-Bar oben.", sortOrder: 50 },

    /* ── Suche ─────────────────────────────────────────────────────────── */
    { id: uuidv4(), question: "Was macht die Suche oben im Header?", answer: "Strg + K (oder Cmd + K auf Mac) öffnet die Command-Palette. Sie findet lokal Services, Boards, Quick-Links und Widgets, und delegiert Web-Suchen an konfigurierbare Engines (Google/DuckDuckGo/Brave by default). Engines pflegst du unter Admin → System → Suche.", sortOrder: 60 },

    /* ── Auth & Sicherheit ────────────────────────────────────────────── */
    { id: uuidv4(), question: "Wie aktiviere ich Benutzername/Passwort-Login?", answer: "Admin → Benutzer & Sicherheit → Auth → Modus 'userPassword'. WICHTIG: Lege ZUERST mindestens einen Admin-Account an (Admin → Benutzer), erst dann den Modus aktivieren — sonst sperrst du dich aus. Passwörter werden mit bcrypt gehasht (cost 10).", sortOrder: 70 },
    { id: uuidv4(), question: "Wie richte ich OAuth2/OIDC mit Authentik ein?", answer: "Admin → Auth → 'OAuth2 / OIDC' Tab. Du brauchst eine Application in Authentik mit Redirect-URI {dashboard-url}/api/auth/oidc/callback und Scopes openid + profile + email. Die Felder issuerUrl, clientId, clientSecret und Group-Claim-Mapping werden in der UI ausgefüllt. Pflicht-ENV: MESH_SESSION_SECRET (≥32 Zeichen).", sortOrder: 80 },
    { id: uuidv4(), question: "Was passiert wenn ich MESH_SESSION_SECRET ändere?", answer: "Alle aktiven Sessions werden invalidiert und müssen sich neu einloggen. Der Secret signiert die Session-Cookies (HMAC-SHA256). Bei Container-Replace IMMER den gleichen Secret wiederverwenden (env-var weitergeben), sonst werden Nutzer rausgeworfen.", sortOrder: 90 },

    /* ── Live-System / Healthchecks ──────────────────────────────────── */
    { id: uuidv4(), question: "Wie funktioniert die Status-Anzeige (online/offline)?", answer: "Ein in-process Healthcheck-Scheduler prüft alle 10 Sekunden alle Services und Netzwerk-Geräte (parallel via p-limit(8)). HTTP-Pings akzeptieren 200/204/301/302/401, TCP-Pings versuchen einen Connect zum Port. Ergebnisse landen im React-Query-Cache und werden im UI live angezeigt.", sortOrder: 100 },

    /* ── Integrationen ─────────────────────────────────────────────────── */
    { id: uuidv4(), question: "Wie konfiguriere ich Home Assistant?", answer: "Admin → Integrationen → Home Assistant. Du brauchst Base-URL und einen Long-Lived Access Token (Profil → Sicherheit). Die Verbindung wird beim Speichern getestet. Das Smart-Home-Widget zeigt Personen-Status, Energie und Probleme; der HA-Health-Indikator im Command-Overview meldet Probleme/Updates.", sortOrder: 110 },
    { id: uuidv4(), question: "Wie konfiguriere ich AdGuard Home?", answer: "Admin → Integrationen → AdGuard. Trage Base-URL (z. B. http://192.168.x.x:3000) und Username/Passwort der Web-UI ein. Das Widget liefert DNS-Queries-Statistik und Block-Rate. ACHTUNG: AdGuard's /control/stats liefert dns_queries und blocked_filtering als 24h-Arrays — wir lesen die Aggregat-Felder num_dns_queries und num_blocked_filtering.", sortOrder: 120 },
    { id: uuidv4(), question: "Was ist der Unterschied zwischen UniFi Network und Protect?", answer: "UniFi Network = die Hauptkomponente deines UniFi-Controllers (UDM Pro / Cloud Key) für Geräte, Clients, WAN-Status. UniFi Protect = das separate NVR-Modul für Kameras. Beide haben eigene Integrations-Slots in Admin → Integrationen, beide nutzen API-Keys aus deinem UniFi-Account.", sortOrder: 130 },
    { id: uuidv4(), question: "Wie konfiguriere ich Pi-hole?", answer: "Admin → Integrationen → Pi-hole (Multi-Instance möglich). Pro Pi-hole brauchst du Base-URL und einen API-Token (aus /admin/settings.php → API). Das Widget zeigt DNS-Queries, blockierte Domains und Top-Adlists.", sortOrder: 140 },
    { id: uuidv4(), question: "Wie installiere ich Glances für Live-Server-Stats?", answer: "Auf jedem Server (Unraid/Linux) als Docker laufen lassen: docker run -d --name=Glances --restart=unless-stopped --network=host --pid=host -e GLANCES_OPT='-w' -v /var/run/docker.sock:/var/run/docker.sock:ro nicolargo/glances:latest-full. Dann in Admin → Integrationen → Glances hinzufügen mit URL http://server-ip:61208 und im InfraNode (Server-Karte) als 'glancesRef' setzen — Live-CPU/RAM-Bars erscheinen automatisch.", sortOrder: 150 },
    { id: uuidv4(), question: "Wie konfiguriere ich Portainer?", answer: "Admin → Integrationen → Portainer (Multi-Instance). Du brauchst Base-URL und einen API-Key (Portainer → User → Access Tokens). Optional Endpoint-ID festlegen (Default: 1 = erster Endpoint). Das Widget listet Container nach Status (running/stopped/paused) inkl. Container-Chips und springt direkt in Portainer.", sortOrder: 160 },
    { id: uuidv4(), question: "Wie verbinde ich Frigate?", answer: "Admin → Integrationen → Frigate (Multi-Instance). Frigate-Base-URL eintragen (z. B. http://192.168.x.x:5000). Das Widget zeigt die letzten Events mit Thumbnails, gefiltert nach Kameras + Klassen. Optional Auth-Header für hinter Reverse-Proxy. Frigate-Live-View bleibt im Frigate-UI selbst.", sortOrder: 170 },
    { id: uuidv4(), question: "Wie nutze ich ESPHome im Direct-Modus?", answer: "Admin → Integrationen → ESPHome (Multi-Instance, jeweils eine pro Gerät). Pro Gerät baseUrl (z. B. http://esphome-device.local) + optional API-Passwort. Voraussetzung: web_server: Component im ESPHome-YAML. Das Widget erkennt v3 (modernes SSE-Streaming via /events) und v2 (REST GET /sensor/list etc.) automatisch.", sortOrder: 180 },
    { id: uuidv4(), question: "Wie konfiguriere ich Zigbee2MQTT?", answer: "Drei Modi: 'auto' (Default seit v1.4.6) — enumeriert Z2M-Geräte über die Home-Assistant-Template-API, kein manuelles Group-Setup. 'ha' (Legacy) — explizite HA-Group. 'mqtt' (v1.5.0+) — direktes MQTT, Home Assistant nicht erforderlich. Bridge-Status separat aus binary_sensor.zigbee2mqtt_bridge_connection_state.", sortOrder: 190 },
    { id: uuidv4(), question: "Wie verbinde ich einen Speedtest-Tracker?", answer: "Admin → Integrationen → Speedtest. Du brauchst eine laufende Speedtest-Tracker-Instanz (alex-laycalvert/speedtest-tracker oder lscr.io/linuxserver/speedtest-tracker). Base-URL + Bearer-Token eintragen. Das Widget zeigt Download/Upload/Ping mit kleiner History-Sparkline.", sortOrder: 200 },
    { id: uuidv4(), question: "Wie konfiguriere ich das Wetter-Widget?", answer: "Admin → Integrationen → Wetter. Trage latitude/longitude deines Standorts ein und wähle Einheit (celsius/fahrenheit). Datenquelle ist Open-Meteo (kein API-Key nötig). Refresh-Intervall in Minuten konfigurierbar (Default 15).", sortOrder: 210 },
    { id: uuidv4(), question: "Wann nutze ich das Custom-REST-Widget?", answer: "Admin → Inhalte → Widgets → Custom REST. Wenn deine Datenquelle nicht abgedeckt ist und einen JSON-Endpoint bietet. Eigene URL + JSONPath-Mapping (z. B. $.value, $.data[0].name) → freie Anzeige als Wert + Label + Status. Standardmäßig sind nur private Netzwerke erlaubt — externe Hosts in der Allowlist (Admin → Integrationen → Custom REST) freischalten.", sortOrder: 220 },
    { id: uuidv4(), question: "Wie binde ich Uptime Kuma ein?", answer: "Admin → Integrationen → Uptime Kuma. Du brauchst nur die Base-URL und optional den Slug einer öffentlichen Status-Page (Settings → Status Pages in Uptime Kuma). Das Widget zeigt die Monitor-Liste mit Health-Punkt — kein API-Key nötig.", sortOrder: 230 },

    /* ── Operations ──────────────────────────────────────────────────── */
    { id: uuidv4(), question: "Wie aktualisiere ich das Image?", answer: "docker pull ghcr.io/itsweber/mesh:latest && docker stop itsweber-mesh && docker rm itsweber-mesh && docker run -d ... (mit gleichem MESH_SESSION_SECRET + Volume!). Die Schema-Migrations laufen automatisch beim Start; Backups landen unter /data/config.json.pre-vN.", sortOrder: 240 },
    { id: uuidv4(), question: "Wie melde ich einen Bug oder schlage eine neue Funktion vor?", answer: "Öffne ein Issue auf GitHub (Link auf der About-Seite). Beschreibe Browser + Version, Schritte zur Reproduktion und ggf. relevante Log-Auszüge (`docker logs itsweber-mesh --tail 100`). Bitte keine echten API-Keys/Tokens posten.", sortOrder: 250 },
  ],
  boards: [
    {
      id: HOME_BOARD_ID,
      slug: "home",
      name: "Home",
      isHome: true,
      layout: "flat",
      sortOrder: 0,
    },
  ],
  sections: [],
  search: {
    engines: [
      {
        id: GOOGLE_ENGINE_ID,
        name: "Google",
        urlTemplate: "https://www.google.com/search?q={q}",
        icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/google.png",
        hotkey: "g",
        sortOrder: 0,
      },
      {
        id: DDG_ENGINE_ID,
        name: "DuckDuckGo",
        urlTemplate: "https://duckduckgo.com/?q={q}",
        icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/duckduckgo.png",
        hotkey: "d",
        sortOrder: 1,
      },
      {
        id: BRAVE_ENGINE_ID,
        name: "Brave Search",
        urlTemplate: "https://search.brave.com/search?q={q}",
        icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/brave.png",
        hotkey: "b",
        sortOrder: 2,
      },
    ],
    defaultEngineId: GOOGLE_ENGINE_ID,
    localFirst: true,
  },
  services: [
    {
      id: uuidv4(), name: "My Server", category: "infrastructure",
      url: "http://192.168.1.100:1080", icon: "server",
      pingTarget: { kind: "http", url: "http://192.168.1.100:1080", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 0, enabled: true, pinnedToHome: true,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 0, y: 0, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "Nginx Proxy Manager", category: "infrastructure",
      url: "http://192.168.1.2:81", icon: "shield",
      pingTarget: { kind: "http", url: "http://192.168.1.2:81", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 10, enabled: true, pinnedToHome: false,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 8, y: 0, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "AdGuard Home", category: "infrastructure",
      url: "http://192.168.1.3:3000", icon: "shield-check",
      pingTarget: { kind: "http", url: "http://192.168.1.3:3000", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 20, enabled: true, pinnedToHome: true,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 16, y: 0, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "Router", category: "infrastructure",
      url: "https://192.168.1.1", icon: "network",
      pingTarget: { kind: "http", url: "https://192.168.1.1", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 30, enabled: true, pinnedToHome: false,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 0, y: 16, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "Home Assistant", category: "smart-home",
      url: "http://homeassistant.local:8123", icon: "home",
      pingTarget: { kind: "http", url: "http://homeassistant.local:8123", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 40, enabled: true, pinnedToHome: true,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 8, y: 16, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "Immich", category: "media",
      url: "http://192.168.1.100:2283", icon: "image",
      pingTarget: { kind: "http", url: "http://192.168.1.100:2283", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 50, enabled: true, pinnedToHome: true,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 16, y: 16, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "Jellyfin", category: "media",
      url: "http://192.168.1.100:8096", icon: "play-circle",
      pingTarget: { kind: "http", url: "http://192.168.1.100:8096", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 60, enabled: true, pinnedToHome: false,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 0, y: 32, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "Frigate NVR", category: "media",
      url: "http://192.168.1.100:5000", icon: "camera",
      pingTarget: { kind: "http", url: "http://192.168.1.100:5000", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 70, enabled: true, pinnedToHome: false,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 8, y: 32, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "Portainer", category: "tools",
      url: "http://192.168.1.100:9000", icon: "box",
      pingTarget: { kind: "http", url: "http://192.168.1.100:9000", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 80, enabled: true, pinnedToHome: true,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 16, y: 32, w: 8, h: 16, minW: 4, minH: 8 },
    },
    {
      id: uuidv4(), name: "Authentik SSO", category: "external",
      url: "https://auth.example.com", icon: "lock",
      pingTarget: { kind: "http", url: "https://auth.example.com", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 5000 },
      sortOrder: 90, enabled: true, pinnedToHome: false,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 0, y: 48, w: 8, h: 16, minW: 4, minH: 8 },
    },
  ],
  widgetInstances: [
    {
      id: wUnraid,    kind: "unraid",    label: "Server Stats", enabled: false, refreshSec: 15, sortOrder: 0, settings: {},
      boardId: HOME_BOARD_ID, gridLayout: { x: 18, y: 0,  w: 6, h: 24, minW: 4, minH: 12 },
    },
    {
      id: wSmartHome, kind: "smartHome", label: "Smart Home",   enabled: true,  refreshSec: 30, sortOrder: 1, settings: {},
      boardId: HOME_BOARD_ID, gridLayout: { x: 18, y: 24, w: 6, h: 24, minW: 4, minH: 12 },
    },
    {
      id: wNetwork,   kind: "network",   label: "Netzwerk",     enabled: true,  refreshSec: 30, sortOrder: 2, settings: {},
      boardId: HOME_BOARD_ID, gridLayout: { x: 18, y: 48, w: 6, h: 24, minW: 4, minH: 12 },
    },
    {
      id: wStorage,   kind: "storage",   label: "Speicher",     enabled: true,  refreshSec: 60, sortOrder: 3, settings: {},
      boardId: HOME_BOARD_ID, gridLayout: { x: 18, y: 72, w: 6, h: 24, minW: 4, minH: 12 },
    },
    {
      id: wAdguard,   kind: "adguard",   label: "AdGuard",      enabled: false, refreshSec: 60, sortOrder: 4, settings: {},
      boardId: HOME_BOARD_ID, gridLayout: { x: 18, y: 96, w: 6, h: 24, minW: 4, minH: 12 },
    },
  ],
  infraNodes: [
    {
      id: infraNodeId,
      label: "My-Server",
      kind: "unraid",
      ip: "192.168.1.100",
      primary: true,
      badge: "PRIMARY",
      chips: ["NAS", "Docker", "VM Host"],
      iconEmoji: "⚡",
      integrationRef: null,
      glancesRef: null,
      sortOrder: 0,
      enabled: true,
      boardId: HOME_BOARD_ID,
      gridLayout: { x: 0, y: 0, w: 24, h: 20, minW: 8, minH: 12 },
    },
  ],
  cameras: [],
  networkDevices: [
    {
      id: uuidv4(), label: "Router", sub: "192.168.1.1 · Gateway", iconEmoji: "🌐",
      url: "https://192.168.1.1",
      healthCheck: { kind: "http", url: "https://192.168.1.1", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 0, enabled: true,
      boardId: HOME_BOARD_ID,
    },
    {
      id: uuidv4(), label: "Nginx Proxy Manager", sub: "192.168.1.2 · Reverse-Proxy", iconEmoji: "🔀",
      url: "http://192.168.1.2:81",
      healthCheck: { kind: "http", url: "http://192.168.1.2:81", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 1, enabled: true,
      boardId: HOME_BOARD_ID,
    },
    {
      id: uuidv4(), label: "AdGuard Home", sub: "192.168.1.3 · DNS", iconEmoji: "🛡️",
      url: "http://192.168.1.3:3000",
      healthCheck: { kind: "http", url: "http://192.168.1.3:3000", expectStatus: [200, 204, 301, 302, 401], timeoutMs: 3000 },
      sortOrder: 2, enabled: true,
      boardId: HOME_BOARD_ID,
    },
  ],
  quickLinks: [
    { id: uuidv4(), label: "My Server",      url: "http://192.168.1.100:1080",      iconEmoji: "⚡", target: "_blank", sortOrder: 0, enabled: true },
    { id: uuidv4(), label: "Router",         url: "https://192.168.1.1",             iconEmoji: "🌐", target: "_blank", sortOrder: 1, enabled: true },
    { id: uuidv4(), label: "NPM",            url: "http://192.168.1.2:81",           iconEmoji: "🔀", target: "_blank", sortOrder: 2, enabled: true },
    { id: uuidv4(), label: "AdGuard",        url: "http://192.168.1.3:3000",         iconEmoji: "🛡️", target: "_blank", sortOrder: 3, enabled: true },
    { id: uuidv4(), label: "Home Assistant", url: "http://homeassistant.local:8123", iconEmoji: "🏠", target: "_blank", sortOrder: 4, enabled: true },
    { id: uuidv4(), label: "Admin",          url: "/admin",                           iconEmoji: "⚙",  target: "_self",  sortOrder: 5, enabled: true },
  ],
  integrations: {
    unraid: [],
    homeAssistant: {},
    adguard: {},
    unifi: {
      siteId: "default", verifyTls: false, authMode: "apiKey",
      showWan: true, showClients: true, showDevices: true, showSwitchPorts: false,
    },
    unifiProtect: { enabled: false, verifyTls: false },
    glances: [],
    portainer: [],
    uptimeKuma: {},
    pihole: [],
    speedtest: [],
    weather: { enabled: false, latitude: 0, longitude: 0, locationName: "", unit: "celsius", refreshIntervalMin: 15 },
    frigate: [],
    zigbee2mqtt: { enabled: false, source: "ha", mqttTopicPrefix: "zigbee2mqtt" },
    customRest: { allowPrivateNetworks: true, allowedHosts: [] },
    esphome: [],
  },
};
