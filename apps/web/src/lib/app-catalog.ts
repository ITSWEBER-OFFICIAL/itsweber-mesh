const CDN = "https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg";
const CDN2 = "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons@main/svg";

function icon(slug: string): string { return `${CDN}/${slug}.svg`; }
function icon2(slug: string): string { return `${CDN2}/${slug}.svg`; }

export type AppCatalogEntry = {
  id: string;
  name: string;
  category: "server" | "network" | "monitoring" | "smarthome" | "media" | "security";
  description: string;
  color: string;
  iconUrl: string;
  configKind:
    | "unraid" | "homeassistant" | "adguard" | "unifi" | "glances"
    | "portainer" | "uptimekuma" | "pihole" | "speedtest"
    | "weather" | "zigbee2mqtt" | "frigate" | "unifiprotect" | "customrest" | "esphome";
  multi: boolean;
};

export const APP_CATALOG: AppCatalogEntry[] = [
  {
    id: "unraid",
    name: "Unraid",
    category: "server",
    description: "NAS & Homelab-Server · GraphQL-API für System-Stats, Docker, VMs",
    color: "#f97316",
    iconUrl: icon("unraid"),
    configKind: "unraid",
    multi: true,
  },
  {
    id: "glances",
    name: "Glances",
    category: "monitoring",
    description: "Live CPU, RAM, Disk & Netzwerk-Stats für jeden Linux-Host",
    color: "#22d3ee",
    iconUrl: icon("glances"),
    configKind: "glances",
    multi: true,
  },
  {
    id: "homeassistant",
    name: "Home Assistant",
    category: "smarthome",
    description: "Smart-Home-Plattform · Health, Updates, Automationen",
    color: "#fb923c",
    iconUrl: icon("home-assistant"),
    configKind: "homeassistant",
    multi: false,
  },
  {
    id: "adguard",
    name: "AdGuard Home",
    category: "security",
    description: "DNS-Filter · Blockrate, Abfrage-Stats, Top-Domains",
    color: "#60a5fa",
    iconUrl: icon("adguard-home"),
    configKind: "adguard",
    multi: false,
  },
  {
    id: "unifi",
    name: "UniFi Controller",
    category: "network",
    description: "Netzwerk-Geräte, Client-Count, WAN-Uptime via UDM Pro",
    color: "#a78bfa",
    iconUrl: icon2("unifi"),
    configKind: "unifi",
    multi: false,
  },
  {
    id: "portainer",
    name: "Portainer",
    category: "monitoring",
    description: "Docker-Container-Management · Running/Stopped, Stacks",
    color: "#13bef9",
    iconUrl: icon("portainer"),
    configKind: "portainer",
    multi: false,
  },
  {
    id: "uptimekuma",
    name: "Uptime Kuma",
    category: "monitoring",
    description: "Service-Uptime-Monitoring via öffentliche Status-Page",
    color: "#5cdd8b",
    iconUrl: icon("uptime-kuma"),
    configKind: "uptimekuma",
    multi: false,
  },
  {
    id: "pihole",
    name: "Pi-hole",
    category: "security",
    description: "Alternativer DNS-Filter · Blockrate & Abfrage-Statistiken",
    color: "#ef4444",
    iconUrl: icon("pi-hole"),
    configKind: "pihole",
    multi: false,
  },
  {
    id: "speedtest",
    name: "Speedtest Tracker",
    category: "monitoring",
    description: "Internet-Geschwindigkeit · History & aktueller Run",
    color: "#f59e0b",
    iconUrl: icon("speedtest-tracker"),
    configKind: "speedtest",
    multi: false,
  },
  {
    id: "weather",
    name: "Wetter (Open-Meteo)",
    category: "monitoring",
    description: "Aktuelle Wetterdaten + 7-Tage-Vorhersage · kein API-Key nötig",
    color: "#fbbf24",
    iconUrl: icon("open-meteo"),
    configKind: "weather",
    multi: false,
  },
  {
    id: "zigbee2mqtt",
    name: "Zigbee2MQTT",
    category: "smarthome",
    description: "Z2M-Geräte (online/offline, Akku) · via Home-Assistant-Group",
    color: "#84cc16",
    iconUrl: icon("zigbee2mqtt"),
    configKind: "zigbee2mqtt",
    multi: false,
  },
  {
    id: "frigate",
    name: "Frigate NVR",
    category: "security",
    description: "Object-Detection-Events mit Thumbnails & Snapshot-Proxy",
    color: "#a855f7",
    iconUrl: icon("frigate"),
    configKind: "frigate",
    multi: false,
  },
  {
    id: "unifiprotect",
    name: "UniFi Protect",
    category: "security",
    description: "Kamera-Grid + Snapshot-Proxy + Lightbox via UniFi Protect API",
    color: "#a78bfa",
    iconUrl: icon2("unifi-protect"),
    configKind: "unifiprotect",
    multi: false,
  },
  {
    id: "customrest",
    name: "Custom REST",
    category: "monitoring",
    description: "Generischer JSON-Endpoint mit JSONPath · Phase 4.5",
    color: "#6b7280",
    iconUrl: icon2("json"),
    configKind: "customrest",
    multi: false,
  },
  {
    id: "esphome",
    name: "ESPHome",
    category: "smarthome",
    description: "Direkte ESPHome REST-API · Sensor-States, Gerätestatus — kein HA-Bridge nötig",
    color: "#06b6d4",
    iconUrl: icon("esphome"),
    configKind: "esphome",
    multi: true,
  },
];

export const CATEGORY_LABELS: Record<AppCatalogEntry["category"], string> = {
  server: "Server",
  network: "Netzwerk",
  monitoring: "Monitoring",
  smarthome: "Smart Home",
  media: "Media",
  security: "Security",
};
