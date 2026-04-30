import { NextResponse } from "next/server";
import { request as httpRequest } from "node:http";
import { request as httpsRequest, Agent as HttpsAgent } from "node:https";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type EsphomeDirectDevice = {
  id: string;
  label: string;
  online: boolean;
  error?: string | undefined;
  name?: string | undefined;
  model?: string | undefined;
  version?: string | undefined;
  uptime?: number | undefined;
  /** "v2" = REST `/sensor/list` style, "v3" = Server-Sent-Events on `/events` */
  apiVersion?: "v2" | "v3" | undefined;
  sensors: EsphomeSensor[];
};

export type EsphomeSensor = {
  id: string;
  name: string;
  state: string;
  unit?: string | undefined;
  type: "sensor" | "binary_sensor" | "switch" | "text_sensor" | "select";
};

export type EsphomeDirectWidgetData = {
  configured: boolean;
  devices: EsphomeDirectDevice[];
  totals: { online: number; offline: number; total: number };
};

const DOMAIN_TO_TYPE: Record<string, EsphomeSensor["type"] | undefined> = {
  sensor: "sensor",
  binary_sensor: "binary_sensor",
  text_sensor: "text_sensor",
  switch: "switch",
  select: "select",
};

const insecureHttpsAgent = new HttpsAgent({ rejectUnauthorized: false });

function authHeaders(password: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (password) headers["authorization"] = `Basic ${Buffer.from(`:${password}`).toString("base64")}`;
  return headers;
}

/**
 * Stream the ESPHome /events SSE endpoint via node:http (which actually
 * yields chunks incrementally — `fetch()` in Next.js's Node runtime buffers
 * SSE responses and only releases on close, which combined with our timeout
 * means the abort kills the stream before any data arrives).
 *
 * ESPHome dumps the current state of every entity in the first ~150ms after
 * connect. We collect for a short window (default 800ms) plus disconnect
 * after seeing the second `event: ping` (heartbeat — first ping is metadata,
 * subsequent pings come ~30s apart so the second ping is a hard signal that
 * the initial dump is complete).
 */
function fetchSensorsV3(opts: {
  baseUrl: string;
  password: string | undefined;
}): Promise<{ sensors: EsphomeSensor[]; info: { name?: string; uptime?: number } } | null> {
  return new Promise((resolve) => {
    let url: URL;
    try { url = new URL("/events", opts.baseUrl); }
    catch { resolve(null); return; }

    const isHttps = url.protocol === "https:";
    const reqFn = isHttps ? httpsRequest : httpRequest;
    const reqOpts: Parameters<typeof httpRequest>[1] = {
      method: "GET",
      headers: {
        accept: "text/event-stream",
        "cache-control": "no-cache",
        ...authHeaders(opts.password),
      },
      ...(isHttps ? { agent: insecureHttpsAgent } : {}),
    };

    const sensors = new Map<string, EsphomeSensor>();
    const info: { name?: string; uptime?: number } = {};
    let buffer = "";
    let pingsSeen = 0;
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      try { req.destroy(); } catch { /* ignore */ }
      resolve({ sensors: Array.from(sensors.values()), info });
    };
    const finishNull = () => {
      if (resolved) return;
      resolved = true;
      try { req.destroy(); } catch { /* ignore */ }
      resolve(null);
    };

    const req = reqFn(url, reqOpts, (res) => {
      if ((res.statusCode ?? 0) >= 400) { finishNull(); return; }

      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        if (resolved) return;
        buffer += chunk;
        // SSE messages are delimited by a blank line (LF LF or CR LF CR LF)
        let sep = -1;
        while (true) {
          const lflf = buffer.indexOf("\n\n");
          const crlfcrlf = buffer.indexOf("\r\n\r\n");
          if (lflf === -1 && crlfcrlf === -1) break;
          let cutLen = 2;
          if (crlfcrlf !== -1 && (lflf === -1 || crlfcrlf < lflf)) {
            sep = crlfcrlf;
            cutLen = 4;
          } else {
            sep = lflf;
            cutLen = 2;
          }
          const message = buffer.slice(0, sep);
          buffer = buffer.slice(sep + cutLen);

          let event = "";
          let dataLine = "";
          for (const line of message.split(/\r?\n/)) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
          }
          if (!dataLine) continue;

          if (event === "ping") {
            try {
              const parsed = JSON.parse(dataLine) as { title?: string; uptime?: number };
              if (parsed.title) info.name = parsed.title;
              if (typeof parsed.uptime === "number") info.uptime = parsed.uptime;
            } catch { /* ignore */ }
            pingsSeen++;
            // First ping = initial metadata, comes immediately. The state-dump
            // follows within ~50–200ms. Wait one short tick after first ping
            // for state events to arrive, then close.
            if (pingsSeen === 1) {
              setTimeout(() => finish(), 600);
            } else if (pingsSeen >= 2) {
              finish();
            }
          } else if (event === "state") {
            try {
              const parsed = JSON.parse(dataLine) as {
                id?: string;
                domain?: string;
                name?: string;
                state?: string;
                value?: string | number | boolean;
                uom?: string;
              };
              const type = DOMAIN_TO_TYPE[parsed.domain ?? ""];
              if (!type || !parsed.id) continue;
              sensors.set(parsed.id, {
                id: parsed.id,
                name: parsed.name ?? parsed.id,
                state:
                  typeof parsed.state === "string" && parsed.state.length > 0
                    ? parsed.state
                    : String(parsed.value ?? ""),
                unit: parsed.uom,
                type,
              });
            } catch { /* ignore parse errors */ }
          }
        }
      });
      res.on("end", finish);
      res.on("error", finish);
    });

    req.on("error", finishNull);
    req.setTimeout(4000, finishNull);
    // Hard cap — never wait longer than 1500ms total, even if no ping arrives
    setTimeout(() => finish(), 1500);
    req.end();
  });
}

/* web_server v2: REST endpoints. Kept as fallback for older firmwares. */
async function fetchSensorsV2(
  baseUrl: string,
  password: string | undefined,
  type: EsphomeSensor["type"],
  signal: AbortSignal,
): Promise<EsphomeSensor[]> {
  const url = baseUrl.replace(/\/+$/, "");
  const endpoint = type === "binary_sensor" ? "binary_sensor" : type === "text_sensor" ? "text_sensor" : type;
  try {
    const res = await fetch(`${url}/${endpoint}/list`, {
      headers: { accept: "application/json", ...authHeaders(password) },
      signal,
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.trim()) return [];
    type ListItem = {
      id?: string;
      name?: string;
      state?: string | number | boolean;
      value?: string | number | boolean;
      unit_of_measurement?: string;
    };
    const json = JSON.parse(text) as Record<string, ListItem[]> | ListItem[];
    const list: ListItem[] = Array.isArray(json) ? json : Object.values(json).flat();
    return list.map((item): EsphomeSensor => ({
      id: item.id ?? "",
      name: item.name ?? item.id ?? "",
      state: String(item.state ?? item.value ?? ""),
      unit: typeof item.unit_of_measurement === "string" ? item.unit_of_measurement : undefined,
      type,
    }));
  } catch {
    return [];
  }
}

async function fetchDeviceInfo(
  baseUrl: string,
  password: string | undefined,
  signal: AbortSignal,
): Promise<{ name?: string | undefined; model?: string | undefined; version?: string | undefined; uptime?: number | undefined; v3Hint: boolean }> {
  const url = baseUrl.replace(/\/+$/, "");
  try {
    const res = await fetch(`${url}/`, {
      headers: { accept: "application/json", ...authHeaders(password) },
      signal,
    });
    if (!res.ok) return { v3Hint: false };
    const text = await res.text();

    if (/oi\.esphome\.io\/v3\//.test(text) || /<esp-app><\/esp-app>/.test(text)) {
      return { v3Hint: true };
    }

    if (text.trim().startsWith("{")) {
      const json = JSON.parse(text) as Record<string, unknown>;
      const result: { name?: string | undefined; model?: string | undefined; version?: string | undefined; uptime?: number | undefined; v3Hint: boolean } = { v3Hint: false };
      if (typeof json["friendly_name"] === "string") result.name = json["friendly_name"];
      if (typeof json["model"] === "string") result.model = json["model"];
      if (typeof json["esphome_version"] === "string") result.version = json["esphome_version"];
      if (typeof json["uptime"] === "number") result.uptime = json["uptime"];
      return result;
    }
    return { v3Hint: false };
  } catch {
    return { v3Hint: false };
  }
}

async function pollDevice(cfg: {
  id: string;
  label: string;
  baseUrl: string;
  password?: string | undefined;
  enabled: boolean;
}): Promise<EsphomeDirectDevice> {
  if (!cfg.enabled) {
    return { id: cfg.id, label: cfg.label, online: false, error: "Deaktiviert", sensors: [] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const info = await fetchDeviceInfo(cfg.baseUrl, cfg.password, controller.signal);

    if (info.v3Hint) {
      const v3 = await fetchSensorsV3({ baseUrl: cfg.baseUrl, password: cfg.password });
      if (v3 && (v3.sensors.length > 0 || v3.info.name)) {
        const result: EsphomeDirectDevice = {
          id: cfg.id,
          label: cfg.label,
          online: true,
          apiVersion: "v3",
          sensors: v3.sensors,
        };
        if (v3.info.name) result.name = v3.info.name;
        if (typeof v3.info.uptime === "number") result.uptime = v3.info.uptime;
        return result;
      }
      // SSE silent — fall through to v2 attempt before declaring offline
    }

    const [sensors, binarySensors, textSensors] = await Promise.all([
      fetchSensorsV2(cfg.baseUrl, cfg.password, "sensor", controller.signal),
      fetchSensorsV2(cfg.baseUrl, cfg.password, "binary_sensor", controller.signal),
      fetchSensorsV2(cfg.baseUrl, cfg.password, "text_sensor", controller.signal),
    ]);

    const allSensors = [...sensors, ...binarySensors, ...textSensors];
    const reachable = info.name !== undefined || allSensors.length > 0 || info.v3Hint;

    const result: EsphomeDirectDevice = {
      id: cfg.id,
      label: cfg.label,
      online: reachable,
      apiVersion: info.v3Hint ? "v3" : "v2",
      sensors: allSensors,
    };
    if (!reachable) result.error = "Keine ESPHome-Antwort";
    if (info.name) result.name = info.name;
    if (info.model) result.model = info.model;
    if (info.version) result.version = info.version;
    if (typeof info.uptime === "number") result.uptime = info.uptime;
    return result;
  } catch (err) {
    return {
      id: cfg.id,
      label: cfg.label,
      online: false,
      error: err instanceof Error ? err.message : "Verbindungsfehler",
      sensors: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request): Promise<NextResponse<EsphomeDirectWidgetData>> {
  const deny = await requireApiAuth(request);
  if (deny) return deny;

  const cfg = readConfig();
  const selectedIds = new URL(request.url).searchParams
    .get("ids")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const selectedSet = selectedIds && selectedIds.length > 0 ? new Set(selectedIds) : null;
  const instances = selectedSet
    ? cfg.integrations.esphome.filter((instance) => selectedSet.has(instance.id))
    : cfg.integrations.esphome;

  if (instances.length === 0) {
    return NextResponse.json({
      configured: false,
      devices: [],
      totals: { online: 0, offline: 0, total: 0 },
    });
  }

  const results = await Promise.all(instances.map(pollDevice));

  return NextResponse.json({
    configured: true,
    devices: results,
    totals: {
      online: results.filter((d) => d.online).length,
      offline: results.filter((d) => !d.online).length,
      total: results.length,
    },
  });
}
