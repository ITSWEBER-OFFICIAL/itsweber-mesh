import { NextRequest, NextResponse } from "next/server";

export interface IconSuggestion {
  url: string;
  source: "selfhosted-icons" | "dashboard-icons" | "favicon";
  label: string;
}

// Known app-name → selfhosted-icons slug mappings for common homelab apps.
// Full list at https://selfh.st/icons/ — we only cache the most common ones.
const SELFHOSTED_SLUGS: Record<string, string> = {
  "home-assistant": "home-assistant", homeassistant: "home-assistant",
  "adguard": "adguard-home", adguardhome: "adguard-home",
  "portainer": "portainer", "grafana": "grafana",
  "jellyfin": "jellyfin", "plex": "plex",
  "nextcloud": "nextcloud", "vaultwarden": "vaultwarden",
  "bitwarden": "vaultwarden", "uptime-kuma": "uptime-kuma", uptimekuma: "uptime-kuma",
  "sonarr": "sonarr", "radarr": "radarr", "prowlarr": "prowlarr",
  "qbittorrent": "qbittorrent", "transmission": "transmission",
  "pihole": "pihole", "pi-hole": "pihole",
  "unifi": "unifi", "nginx": "nginx",
  "frigate": "frigate", "overseerr": "overseerr",
  "bazarr": "bazarr", "readarr": "readarr",
  "lidarr": "lidarr", "whisparr": "whisparr",
  "tdarr": "tdarr", "recyclarr": "recyclarr",
  "homepage": "homepage", "homarr": "homarr",
  "immich": "immich", "photoprism": "photoprism",
  "gitea": "gitea", "forgejo": "forgejo",
  "gitlab": "gitlab", "github": "github",
  "syncthing": "syncthing", "duplicati": "duplicati",
  "paperless": "paperless-ngx",
  "mealie": "mealie", "grocy": "grocy",
  "audiobookshelf": "audiobookshelf", "kavita": "kavita",
  "komga": "komga", "calibre": "calibre",
  "influxdb": "influxdb", "prometheus": "prometheus",
  "n8n": "n8n", "node-red": "node-red", nodered: "node-red",
};

function hostnameToSlug(hostname: string): string {
  return hostname
    .replace(/^www\./, "")
    .replace(/\.[^.]+$/, "")        // strip TLD
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
}

function buildSelfhostedUrl(slug: string, ext = "png"): string {
  return `https://cdn.jsdelivr.net/gh/selfhst/icons/${ext}/${slug}.${ext}`;
}

function buildDashboardIconsUrl(slug: string): string {
  return `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${slug}.png`;
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ suggestions: [] });

  let hostname: string;
  try {
    hostname = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).hostname;
  } catch {
    return NextResponse.json({ suggestions: [] });
  }

  const slug = hostnameToSlug(hostname);
  const suggestions: IconSuggestion[] = [];

  // 1. Lookup in known-slugs map
  const knownSlug = SELFHOSTED_SLUGS[slug] ?? SELFHOSTED_SLUGS[slug.replace(/-/g, "")] ?? null;
  if (knownSlug) {
    suggestions.push({
      url: buildSelfhostedUrl(knownSlug),
      source: "selfhosted-icons",
      label: `selfh.st icons (${knownSlug})`,
    });
    suggestions.push({
      url: buildSelfhostedUrl(knownSlug, "svg"),
      source: "selfhosted-icons",
      label: `selfh.st icons SVG (${knownSlug})`,
    });
  }

  // 2. dashboard-icons by slug
  suggestions.push({
    url: buildDashboardIconsUrl(slug),
    source: "dashboard-icons",
    label: `dashboard-icons (${slug})`,
  });
  if (slug.includes("-")) {
    suggestions.push({
      url: buildDashboardIconsUrl(slug.replace(/-/g, "")),
      source: "dashboard-icons",
      label: `dashboard-icons (${slug.replace(/-/g, "")})`,
    });
  }

  // 3. Favicon fallbacks (fast, no network on server side)
  const base = `${new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).origin}`;
  suggestions.push({ url: `${base}/favicon.ico`, source: "favicon", label: "favicon.ico" });
  suggestions.push({
    url: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    source: "favicon",
    label: "Google Favicon",
  });

  return NextResponse.json({ suggestions }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
