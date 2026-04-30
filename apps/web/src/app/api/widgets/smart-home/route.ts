import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type SmartHomeHealthStatus = "healthy" | "warn" | "error" | "unknown";

export type SmartHomeWidgetData = {
  configured: boolean;
  online: boolean;
  version?: string;
  locationName?: string;
  baseUrl?: string;
  health: {
    status: SmartHomeHealthStatus;
    updatesAvailable: number;
    problems: number;
    notifications: number;
  };
  system?: {
    cpuPercent: number;
    memPercent: number;
    memUsedMb: number;
    memTotalMb: number;
  };
  counts?: {
    entities: number;
    automations: number;
    components: number;
  };
  error?: string;
};

type HaConfig = { version?: string; location_name?: string };
type HaTemplate = { updates_available: number; health_problems: number; persistent_notifications: number };
type SupervisorStats = { result: string; data?: { cpu_percent: number; memory_percent: number; memory_usage: number; memory_limit: number } };

function computeStatus(updates: number, problems: number, notifications: number): SmartHomeHealthStatus {
  if (problems > 0) return "error";
  if (updates > 0 || notifications > 0) return "warn";
  return "healthy";
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const ha = cfg.integrations.homeAssistant;

  const empty: SmartHomeWidgetData = {
    configured: false,
    online: false,
    health: { status: "unknown", updatesAvailable: 0, problems: 0, notifications: 0 },
  };

  if (!ha?.baseUrl || !ha?.token) {
    return NextResponse.json(empty satisfies SmartHomeWidgetData);
  }

  const base = ha.baseUrl.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${ha.token}`, "Content-Type": "application/json" };

  try {
    const templateBody = JSON.stringify({
      template: `{
        "updates_available": {{ states.update | selectattr('state','eq','on') | list | count }},
        "health_problems": {{ states | selectattr('attributes.device_class','eq','problem') | selectattr('state','eq','on') | list | count }},
        "persistent_notifications": {{ states | selectattr('entity_id','match','persistent_notification\\..*') | selectattr('state','ne','read') | list | count }}
      }`,
    });

    const [configRes, templateRes, componentsRes, supervisorRes] = await Promise.allSettled([
      fetch(`${base}/api/config`, { headers, signal: AbortSignal.timeout(5000) }),
      fetch(`${base}/api/template`, {
        method: "POST",
        headers,
        body: templateBody,
        signal: AbortSignal.timeout(6000),
      }),
      fetch(`${base}/api/components`, { headers, signal: AbortSignal.timeout(5000) }),
      fetch(`${base}/api/hassio/stats`, { headers, signal: AbortSignal.timeout(4000) }),
    ]);

    // Config (version, location)
    const config =
      configRes.status === "fulfilled" && configRes.value.ok
        ? ((await configRes.value.json()) as HaConfig)
        : {};

    // Template (updates / problems / notifications)
    let tpl: HaTemplate = { updates_available: 0, health_problems: 0, persistent_notifications: 0 };
    if (templateRes.status === "fulfilled" && templateRes.value.ok) {
      const raw = await templateRes.value.text();
      try {
        tpl = JSON.parse(raw) as HaTemplate;
      } catch {
        // template returned non-JSON, leave defaults
      }
    }

    // Components count
    let componentCount = 0;
    if (componentsRes.status === "fulfilled" && componentsRes.value.ok) {
      const comps = (await componentsRes.value.json()) as unknown[];
      componentCount = Array.isArray(comps) ? comps.length : 0;
    }

    // States for entity/automation counts
    const statesRes = await fetch(`${base}/api/states`, { headers, signal: AbortSignal.timeout(6000) });
    if (!statesRes.ok) throw new Error(`HTTP ${statesRes.status}`);
    type HaState = { entity_id: string };
    const states = (await statesRes.json()) as HaState[];
    const automations = states.filter((s) => s.entity_id.startsWith("automation.")).length;

    // Supervisor stats (HA OS / Supervised only — silent fail)
    let systemStats: SmartHomeWidgetData["system"] | undefined;
    if (supervisorRes.status === "fulfilled" && supervisorRes.value.ok) {
      try {
        const sv = (await supervisorRes.value.json()) as SupervisorStats;
        if (sv.result === "ok" && sv.data) {
          systemStats = {
            cpuPercent: Math.round(sv.data.cpu_percent * 10) / 10,
            memPercent: Math.round(sv.data.memory_percent * 10) / 10,
            memUsedMb: Math.round(sv.data.memory_usage / (1024 * 1024)),
            memTotalMb: Math.round(sv.data.memory_limit / (1024 * 1024)),
          };
        }
      } catch {
        // ignore parse errors
      }
    }

    const health: SmartHomeWidgetData["health"] = {
      status: computeStatus(tpl.updates_available, tpl.health_problems, tpl.persistent_notifications),
      updatesAvailable: tpl.updates_available,
      problems: tpl.health_problems,
      notifications: tpl.persistent_notifications,
    };

    const result: SmartHomeWidgetData = {
      configured: true,
      online: true,
      baseUrl: ha.baseUrl,
      health,
      counts: { entities: states.length, automations, components: componentCount },
    };
    if (config.version) result.version = config.version;
    if (config.location_name) result.locationName = config.location_name;
    if (systemStats) result.system = systemStats;

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      baseUrl: ha.baseUrl,
      health: { status: "unknown", updatesAvailable: 0, problems: 0, notifications: 0 },
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    } satisfies SmartHomeWidgetData);
  }
}
