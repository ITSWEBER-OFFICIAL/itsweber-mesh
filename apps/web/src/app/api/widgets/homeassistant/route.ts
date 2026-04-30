import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

type HaEntity = {
  entity_id: string;
  state: string;
  attributes: { friendly_name?: string; unit_of_measurement?: string; device_class?: string };
};

export type HaDomainSummary = {
  /** lights: counts of bulbs/switches with domain `light` */
  lights: { on: number; off: number };
  /** binary_sensor with device_class door|window — open == state "on" */
  doors: { open: number; closed: number };
  windows: { open: number; closed: number };
  /** binary_sensor with device_class motion — currently triggered */
  motion: { active: number; total: number };
  /** persons + device_trackers home/away */
  people: { home: number; away: number };
  /** climate.* entities running */
  climate: { active: number; total: number };
  /** average temperature across all temperature sensors with units */
  avgTemperatureC?: number;
  /** sum of current power-draw sensors (W) */
  totalPowerW?: number;
  /** automations currently in idle state */
  automations: { on: number; total: number };
};

export type HaWidgetData = {
  configured: boolean;
  online: boolean;
  baseUrl?: string;
  entityCount?: number;
  summary?: HaDomainSummary;
  /** Curated highlight list (max 12) — persons, doors, motion, top sensors. */
  entities?: HaEntity[];
  error?: string;
};

const TEMPERATURE_UNITS = new Set(["°C", "°F", "C", "F"]);

function isTemperatureSensor(e: HaEntity): boolean {
  if (!e.entity_id.startsWith("sensor.")) return false;
  if (e.attributes.device_class === "temperature") return true;
  const u = e.attributes.unit_of_measurement;
  return !!u && TEMPERATURE_UNITS.has(u);
}

function isPowerSensor(e: HaEntity): boolean {
  if (!e.entity_id.startsWith("sensor.")) return false;
  if (e.attributes.device_class === "power") return true;
  return e.attributes.unit_of_measurement === "W";
}

function buildSummary(all: HaEntity[]): HaDomainSummary {
  const lights = { on: 0, off: 0 };
  const doors = { open: 0, closed: 0 };
  const windows = { open: 0, closed: 0 };
  const motion = { active: 0, total: 0 };
  const people = { home: 0, away: 0 };
  const climate = { active: 0, total: 0 };
  const automations = { on: 0, total: 0 };

  let tempSum = 0;
  let tempCount = 0;
  let powerSum = 0;
  let powerCount = 0;

  for (const e of all) {
    if (e.state === "unavailable" || e.state === "unknown") continue;

    if (e.entity_id.startsWith("light.")) {
      if (e.state === "on") lights.on++;
      else lights.off++;
    } else if (e.entity_id.startsWith("binary_sensor.")) {
      const cls = e.attributes.device_class;
      if (cls === "door") {
        if (e.state === "on") doors.open++;
        else doors.closed++;
      } else if (cls === "window") {
        if (e.state === "on") windows.open++;
        else windows.closed++;
      } else if (cls === "motion") {
        motion.total++;
        if (e.state === "on") motion.active++;
      }
    } else if (e.entity_id.startsWith("person.") || e.entity_id.startsWith("device_tracker.")) {
      if (e.state === "home") people.home++;
      else if (e.state === "not_home" || e.state === "away") people.away++;
    } else if (e.entity_id.startsWith("climate.")) {
      climate.total++;
      if (e.state !== "off") climate.active++;
    } else if (e.entity_id.startsWith("automation.")) {
      automations.total++;
      if (e.state === "on") automations.on++;
    } else if (isTemperatureSensor(e)) {
      const v = parseFloat(e.state);
      if (Number.isFinite(v) && v > -50 && v < 100) {
        tempSum += v;
        tempCount++;
      }
    }

    if (isPowerSensor(e)) {
      const v = parseFloat(e.state);
      if (Number.isFinite(v) && v >= 0) {
        powerSum += v;
        powerCount++;
      }
    }
  }

  const out: HaDomainSummary = {
    lights, doors, windows, motion, people, climate, automations,
  };
  if (tempCount > 0) out.avgTemperatureC = Math.round((tempSum / tempCount) * 10) / 10;
  if (powerCount > 0) out.totalPowerW = Math.round(powerSum);
  return out;
}

function pickHighlights(all: HaEntity[]): HaEntity[] {
  const result: HaEntity[] = [];

  // 1) People (always include)
  for (const e of all) {
    if (e.entity_id.startsWith("person.")) result.push(e);
  }

  // 2) Active doors/windows + active motion (only the open/triggered ones)
  for (const e of all) {
    if (!e.entity_id.startsWith("binary_sensor.")) continue;
    const cls = e.attributes.device_class;
    if ((cls === "door" || cls === "window" || cls === "motion") && e.state === "on") {
      result.push(e);
    }
  }

  // 3) Lights that are on
  const onLights = all.filter((e) => e.entity_id.startsWith("light.") && e.state === "on");
  for (const l of onLights.slice(0, 4)) result.push(l);

  // 4) Top temperature sensors (cap to 3)
  const tempSensors = all
    .filter(isTemperatureSensor)
    .filter((e) => e.state !== "unavailable" && e.state !== "unknown");
  for (const t of tempSensors.slice(0, 3)) result.push(t);

  // Cap total
  return result.slice(0, 12);
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const ha = cfg.integrations.homeAssistant;

  if (!ha?.baseUrl || !ha?.token) {
    return NextResponse.json({ configured: false, online: false } satisfies HaWidgetData);
  }

  try {
    const base = ha.baseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/states`, {
      headers: { Authorization: `Bearer ${ha.token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const all = (await res.json()) as HaEntity[];

    return NextResponse.json({
      configured: true,
      online: true,
      baseUrl: base,
      entityCount: all.length,
      summary: buildSummary(all),
      entities: pickHighlights(all),
    } satisfies HaWidgetData);
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      baseUrl: ha.baseUrl.replace(/\/$/, ""),
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    } satisfies HaWidgetData);
  }
}
