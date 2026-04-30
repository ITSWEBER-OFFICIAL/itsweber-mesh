import { NextResponse } from "next/server";
import { Agent as HttpsAgent } from "node:https";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type UnifiWan = {
  ip?: string | undefined;
  ispName?: string | undefined;
  latencyMs?: number | undefined;
  xputUp?: number | undefined;
  xputDown?: number | undefined;
  uptime?: number | undefined;
  uptimePct?: number | undefined;
};

export type UnifiWidgetData = {
  configured: boolean;
  online: boolean;
  controllerUrl?: string;
  controllerHost?: string;
  siteId?: string;
  stats?: {
    devices: { total: number; online: number };
    clients: {
      total: number;
      wired: number;
      wireless: number;
      band24: number;
      band5: number;
      band6: number;
    };
    wan?: UnifiWan;
    gateway?: { cpu: string; mem: string; uptime: string; model?: string | undefined; name?: string | undefined };
    subsystems: { name: string; status: string }[];
  };
  error?: string;
};

type UnifiResponse<T> = { meta?: { rc?: string }; data?: T };
type UnifiDevice = { state?: number; name?: string; type?: string; model?: string };
type UnifiClient = { is_wired?: boolean; mac?: string; radio?: string };
type UnifiHealth = {
  subsystem: string; status: string;
  num_user?: number; num_guest?: number;
  wan_ip?: string; isp_name?: string; isp_organization?: string;
  tx_bytes_r?: number; rx_bytes_r?: number;
  "gw_system-stats"?: { cpu: string; mem: string; uptime: string };
  gw_name?: string; gw_mac?: string;
  xput_up?: number; xput_down?: number;
  latency?: number; uptime?: number; drops?: number;
  uptime_stats?: { WAN?: { availability?: number; latency_average?: number } };
};

function unifiFetch<T>(controllerUrl: string, path: string, apiKey: string, verifyTls: boolean): Promise<T> {
  const u = new URL(path, controllerUrl);
  const isHttps = u.protocol === "https:";
  const reqFn = isHttps ? httpsRequest : httpRequest;
  const httpsOpts = isHttps ? { agent: new HttpsAgent({ rejectUnauthorized: verifyTls }) } : {};

  return new Promise((resolve, reject) => {
    const req = reqFn(
      u,
      { method: "GET", headers: { "X-API-Key": apiKey, Accept: "application/json" }, ...httpsOpts },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => { data += c.toString(); });
        res.on("end", () => {
          if ((res.statusCode ?? 0) >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
          try { resolve(JSON.parse(data) as T); } catch (e) { reject(e); }
        });
      },
    );
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.on("error", reject);
    req.end();
  });
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const u = cfg.integrations.unifi;

  if (!u?.controllerUrl || !u?.apiKey) {
    return NextResponse.json({ configured: false, online: false } satisfies UnifiWidgetData);
  }

  const controllerUrl = u.controllerUrl;
  const apiKey = u.apiKey;
  const site = u.siteId || "default";
  const verifyTls = u.verifyTls ?? false;
  let host: string;
  try { host = new URL(controllerUrl).host; } catch { host = controllerUrl; }

  try {
    const [devicesRes, clientsRes, healthRes] = await Promise.all([
      unifiFetch<UnifiResponse<UnifiDevice[]>>(controllerUrl, `/proxy/network/api/s/${site}/stat/device-basic`, apiKey, verifyTls)
        .catch(() => unifiFetch<UnifiResponse<UnifiDevice[]>>(controllerUrl, `/proxy/network/api/s/${site}/stat/device`, apiKey, verifyTls)),
      unifiFetch<UnifiResponse<UnifiClient[]>>(controllerUrl, `/proxy/network/api/s/${site}/stat/sta`, apiKey, verifyTls),
      unifiFetch<UnifiResponse<UnifiHealth[]>>(controllerUrl, `/proxy/network/api/s/${site}/stat/health`, apiKey, verifyTls),
    ]);

    const devices = devicesRes.data ?? [];
    const clients = clientsRes.data ?? [];
    const health = healthRes.data ?? [];

    const wired = clients.filter((c) => c.is_wired).length;
    const wireless = clients.length - wired;
    const band24 = clients.filter((c) => c.radio === "ng").length;
    const band5  = clients.filter((c) => c.radio === "na").length;
    const band6  = clients.filter((c) => c.radio === "6e").length;
    const onlineDevices = devices.filter((d) => d.state === 1).length;

    // WAN subsystem
    const wanHealth = health.find((h) => h.subsystem === "wan");
    const wwwHealth = health.find((h) => h.subsystem === "www");
    const gwStats = wanHealth?.["gw_system-stats"];
    const gwDevice = devices.find((d) => d.type === "udm" || d.type === "ugw" || d.type === "usg");

    const wan: UnifiWan | undefined = (wanHealth || wwwHealth) ? {
      ip:        wanHealth?.wan_ip,
      ispName:   wanHealth?.isp_name || wanHealth?.isp_organization,
      latencyMs: wwwHealth?.latency,
      xputUp:    wwwHealth?.xput_up    !== undefined ? Math.round(wwwHealth.xput_up)    : undefined,
      xputDown:  wwwHealth?.xput_down  !== undefined ? Math.round(wwwHealth.xput_down)  : undefined,
      uptime:    wwwHealth?.uptime,
      uptimePct: wwwHealth?.uptime_stats?.WAN?.availability,
    } : undefined;

    const gateway = gwStats ? {
      cpu:    gwStats.cpu,
      mem:    gwStats.mem,
      uptime: gwStats.uptime,
      model:  gwDevice?.model,
      name:   wanHealth?.gw_name,
    } : undefined;

    return NextResponse.json({
      configured: true,
      online: true,
      controllerUrl,
      controllerHost: host,
      siteId: site,
      stats: {
        devices: { total: devices.length, online: onlineDevices },
        clients: { total: clients.length, wired, wireless, band24, band5, band6 },
        ...(wan     ? { wan }     : {}),
        ...(gateway ? { gateway } : {}),
        subsystems: health.map((h) => ({ name: h.subsystem, status: h.status })),
      },
    } satisfies UnifiWidgetData);
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      controllerUrl,
      controllerHost: host,
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    } satisfies UnifiWidgetData);
  }
}
