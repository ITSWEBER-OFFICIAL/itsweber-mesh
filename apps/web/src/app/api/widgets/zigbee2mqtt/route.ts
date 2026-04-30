import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type Z2mDevice = {
  /** Z2M-side IEEE address or HA device_id, used as React key */
  id: string;
  friendlyName: string;
  /** True if at least one entity reports a non-unavailable state */
  online: boolean;
  /** Battery percentage if a battery sensor exists for this device */
  battery?: number;
  /** True if battery < 20 */
  lowBattery: boolean;
  /** Most recent last_changed across all entities of this device */
  lastChanged: string;
  /** Optional area name from HA */
  area?: string;
};

export type Zigbee2MqttWidgetData = {
  configured: boolean;
  online: boolean;
  /** "auto" = template-driven device discovery; "ha" = legacy HA-Group; "mqtt" = future */
  source: "auto" | "ha" | "mqtt";
  bridgeVersion?: string;
  bridgeOnline?: boolean;
  permitJoin?: boolean;
  error?: string;
  totals: {
    online: number;
    offline: number;
    total: number;
    lowBattery: number;
  };
  devices: Z2mDevice[];
  /** Most recently active device (last_changed max) */
  lastActive?: { name: string; lastChanged: string };
};

type HaState = {
  entity_id: string;
  state: string;
  attributes?: { friendly_name?: string; entity_id?: string[]; device_class?: string };
  last_changed?: string;
};

function emptyData(): Zigbee2MqttWidgetData {
  return {
    configured: false,
    online: false,
    source: "auto",
    totals: { online: 0, offline: 0, total: 0, lowBattery: 0 },
    devices: [],
  };
}

function isOnlineState(state: string): boolean {
  const s = state.toLowerCase();
  return s !== "unavailable" && s !== "unknown" && s !== "";
}

/**
 * HA Jinja template that enumerates every entity created by the Zigbee2MQTT
 * integration. Returns a JSON-stringified array of {entity_id, device_id,
 * friendly_name, area_name} objects so the dashboard doesn't need to know HA's
 * device registry layout. Runs server-side in HA in <100ms even with 2k+ entities.
 */
const Z2M_TEMPLATE = `
{%- set ns = namespace(items=[]) -%}
{%- for ent in states -%}
  {%- set d_id = device_id(ent.entity_id) -%}
  {%- if d_id -%}
    {%- set idents = device_attr(d_id, 'identifiers') -%}
    {%- if idents and 'zigbee2mqtt' in (idents | string) -%}
      {%- set ns.items = ns.items + [{
        'entity_id': ent.entity_id,
        'device_id': d_id,
        'friendly_name': device_attr(d_id, 'name_by_user') or device_attr(d_id, 'name') or ent.attributes.friendly_name,
        'area': area_name(d_id)
      }] -%}
    {%- endif -%}
  {%- endif -%}
{%- endfor -%}
{{ ns.items | tojson }}
`.trim();

type Z2mEntityRow = {
  entity_id: string;
  device_id: string;
  friendly_name: string;
  area: string | null;
};

async function fetchZ2mEntitiesViaTemplate(
  baseUrl: string,
  token: string,
): Promise<Z2mEntityRow[] | null> {
  try {
    const res = await fetch(`${baseUrl}/api/template`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ template: Z2M_TEMPLATE }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // HA returns the rendered template as a quoted JSON string. We tojson'd
    // inside Jinja, so the body is a JSON array string. Parse it.
    const parsed = JSON.parse(text) as Z2mEntityRow[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchAllStates(baseUrl: string, token: string): Promise<HaState[] | null> {
  try {
    const res = await fetch(`${baseUrl}/api/states`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as HaState[];
  } catch {
    return null;
  }
}

function aggregateDevices(
  entities: Z2mEntityRow[],
  stateMap: Map<string, HaState>,
): Z2mDevice[] {
  // Group entities by device_id.
  const byDevice = new Map<string, Z2mEntityRow[]>();
  for (const e of entities) {
    const list = byDevice.get(e.device_id) ?? [];
    list.push(e);
    byDevice.set(e.device_id, list);
  }

  const devices: Z2mDevice[] = [];
  for (const [device_id, ents] of byDevice) {
    let online = false;
    let battery: number | undefined;
    let lastChanged = "";
    let lastTs = 0;
    let friendlyName = ents[0]?.friendly_name ?? device_id;
    let area: string | null = ents[0]?.area ?? null;

    for (const e of ents) {
      const s = stateMap.get(e.entity_id);
      if (!s) continue;
      if (isOnlineState(s.state)) online = true;

      // Battery — pick first entity with device_class === "battery"
      if (battery === undefined && s.attributes?.device_class === "battery") {
        const v = parseFloat(s.state);
        if (Number.isFinite(v)) battery = v;
      }

      const ts = s.last_changed ? new Date(s.last_changed).getTime() : 0;
      if (ts > lastTs) {
        lastTs = ts;
        lastChanged = s.last_changed ?? "";
      }
      if (e.friendly_name) friendlyName = e.friendly_name;
      if (e.area) area = e.area;
    }

    const dev: Z2mDevice = {
      id: device_id,
      friendlyName,
      online,
      lowBattery: battery !== undefined && battery < 20,
      lastChanged,
    };
    if (battery !== undefined) dev.battery = battery;
    if (area) dev.area = area;
    devices.push(dev);
  }

  // Sort: offline first (so they're visible), then by lastChanged desc
  devices.sort((a, b) => {
    if (a.online !== b.online) return a.online ? 1 : -1;
    return (new Date(b.lastChanged).getTime() || 0) - (new Date(a.lastChanged).getTime() || 0);
  });
  return devices;
}

export async function GET(req: Request): Promise<NextResponse<Zigbee2MqttWidgetData>> {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const z = cfg.integrations.zigbee2mqtt;
  const ha = cfg.integrations.homeAssistant;

  if (!z.enabled) {
    return NextResponse.json({ ...emptyData(), configured: false });
  }

  if (z.source === "mqtt") {
    return NextResponse.json({
      ...emptyData(),
      configured: false,
      source: "mqtt",
      error: "MQTT-Modus folgt in v1.5.0",
    });
  }

  if (!ha.baseUrl || !ha.token) {
    return NextResponse.json({
      ...emptyData(),
      configured: false,
      error: "Home Assistant nicht konfiguriert (baseUrl + token erforderlich)",
    });
  }

  const baseUrl = ha.baseUrl.replace(/\/+$/, "");

  /* Bridge state & version are independent of discovery mode — always probe
     them so the widget can show "Z2M offline" even when device discovery
     succeeds (or vice versa). */
  const [bridgeStateRes, bridgeVersionRes] = await Promise.allSettled([
    fetch(`${baseUrl}/api/states/binary_sensor.zigbee2mqtt_bridge_connection_state`, {
      headers: { authorization: `Bearer ${ha.token}` },
      signal: AbortSignal.timeout(4000),
    }),
    fetch(`${baseUrl}/api/states/sensor.zigbee2mqtt_bridge_version`, {
      headers: { authorization: `Bearer ${ha.token}` },
      signal: AbortSignal.timeout(4000),
    }),
  ]);
  let bridgeOnline: boolean | undefined;
  let bridgeVersion: string | undefined;
  if (bridgeStateRes.status === "fulfilled" && bridgeStateRes.value.ok) {
    const j = (await bridgeStateRes.value.json()) as HaState;
    bridgeOnline = j.state === "on";
  }
  if (bridgeVersionRes.status === "fulfilled" && bridgeVersionRes.value.ok) {
    const j = (await bridgeVersionRes.value.json()) as HaState;
    if (typeof j.state === "string" && j.state !== "unavailable") bridgeVersion = j.state;
  }

  /* Prefer auto mode (HA Template). Fall back to legacy ha-group only if user
     explicitly sets z.source === "ha" AND has actually set a haGroupEntity —
     "ha" without a group is a no-op default left over from v1.4.0–v1.4.5,
     so we silently treat it as auto. */
  const explicitGroup = (z.haGroupEntity || ha.zigbee2mqttGroupEntity || "").trim();
  if (z.source === "ha" && explicitGroup.length > 0) {
    return await runLegacyHaGroup(baseUrl, ha.token, explicitGroup, bridgeVersion, bridgeOnline);
  }

  const entities = await fetchZ2mEntitiesViaTemplate(baseUrl, ha.token);
  if (!entities) {
    return NextResponse.json({
      ...emptyData(),
      configured: true,
      online: false,
      source: "auto",
      ...(bridgeVersion ? { bridgeVersion } : {}),
      ...(bridgeOnline !== undefined ? { bridgeOnline } : {}),
      error: "HA-Template-API nicht erreichbar — prüfe Token/Berechtigung",
    });
  }

  if (entities.length === 0) {
    return NextResponse.json({
      ...emptyData(),
      configured: true,
      online: bridgeOnline ?? false,
      source: "auto",
      ...(bridgeVersion ? { bridgeVersion } : {}),
      ...(bridgeOnline !== undefined ? { bridgeOnline } : {}),
      error: "Keine Zigbee2MQTT-Geräte in HA gefunden",
    });
  }

  const allStates = await fetchAllStates(baseUrl, ha.token);
  if (!allStates) {
    return NextResponse.json({
      ...emptyData(),
      configured: true,
      online: false,
      source: "auto",
      error: "HA /api/states nicht erreichbar",
    });
  }
  const stateMap = new Map(allStates.map((s) => [s.entity_id, s]));

  const devices = aggregateDevices(entities, stateMap);
  const totals = {
    online: devices.filter((d) => d.online).length,
    offline: devices.filter((d) => !d.online).length,
    total: devices.length,
    lowBattery: devices.filter((d) => d.lowBattery).length,
  };

  let lastActive: Zigbee2MqttWidgetData["lastActive"];
  let mostRecent = 0;
  for (const d of devices) {
    const t = d.lastChanged ? new Date(d.lastChanged).getTime() : 0;
    if (t > mostRecent) {
      mostRecent = t;
      lastActive = { name: d.friendlyName, lastChanged: d.lastChanged };
    }
  }

  return NextResponse.json({
    configured: true,
    online: true,
    source: "auto",
    ...(bridgeVersion ? { bridgeVersion } : {}),
    ...(bridgeOnline !== undefined ? { bridgeOnline } : {}),
    totals,
    devices,
    ...(lastActive ? { lastActive } : {}),
  });
}

async function runLegacyHaGroup(
  baseUrl: string,
  token: string,
  groupId: string | undefined,
  bridgeVersion: string | undefined,
  bridgeOnline: boolean | undefined,
): Promise<NextResponse<Zigbee2MqttWidgetData>> {
  if (!groupId) {
    return NextResponse.json({
      ...emptyData(),
      configured: false,
      source: "ha",
      error: "Setze 'haGroupEntity' (z.B. 'group.zigbee_devices') oder wechsle auf Auto-Modus",
    });
  }

  try {
    const groupRes = await fetch(`${baseUrl}/api/states/${encodeURIComponent(groupId)}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!groupRes.ok) {
      return NextResponse.json({
        ...emptyData(),
        configured: true,
        online: false,
        source: "ha",
        error: `HA HTTP ${groupRes.status} — Group '${groupId}' nicht gefunden?`,
      });
    }
    const group = (await groupRes.json()) as HaState;
    const members = group.attributes?.entity_id ?? [];

    const allStates = await fetchAllStates(baseUrl, token);
    if (!allStates) {
      return NextResponse.json({
        ...emptyData(),
        configured: true,
        online: false,
        source: "ha",
        error: "HA /api/states nicht erreichbar",
      });
    }
    const stateMap = new Map(allStates.map((s) => [s.entity_id, s]));

    // Build pseudo-entity rows so we can reuse aggregateDevices()
    const entities: Z2mEntityRow[] = members.map((m) => ({
      entity_id: m,
      device_id: m, // legacy: treat each member as its own device
      friendly_name: stateMap.get(m)?.attributes?.friendly_name ?? m,
      area: null,
    }));

    const devices = aggregateDevices(entities, stateMap);
    const totals = {
      online: devices.filter((d) => d.online).length,
      offline: devices.filter((d) => !d.online).length,
      total: devices.length,
      lowBattery: devices.filter((d) => d.lowBattery).length,
    };

    return NextResponse.json({
      configured: true,
      online: true,
      source: "ha",
      ...(bridgeVersion ? { bridgeVersion } : {}),
      ...(bridgeOnline !== undefined ? { bridgeOnline } : {}),
      totals,
      devices,
    });
  } catch (err) {
    return NextResponse.json({
      ...emptyData(),
      configured: true,
      online: false,
      source: "ha",
      error: err instanceof Error ? err.message : "HA-Verbindung fehlgeschlagen",
    });
  }
}
