import { NextResponse } from "next/server";
import { Agent as HttpsAgent } from "node:https";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type PortainerContainer = {
  id: string;
  name: string;
  image: string;
  state: string;   // "running" | "exited" | "paused" | ...
  status: string;  // "Up 3 hours", "Exited (0) 2 days ago", ...
  cpuPct?: number | undefined;
  memMb?: number | undefined;
  memLimitMb?: number | undefined;
};

export type PortainerStack = {
  name: string;
  status: number; // 1 = active, 2 = inactive
};

export type PortainerWidgetData = {
  configured: boolean;
  online: boolean;
  endpointName?: string | undefined;
  containers?: PortainerContainer[];
  stacks?: PortainerStack[];
  summary?: {
    total: number;
    running: number;
    stopped: number;
    paused: number;
  };
  error?: string;
};

type RawContainer = {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
};

type RawStack = {
  Name: string;
  Status: number;
};

type RawEndpoint = {
  Id: number;
  Name: string;
};

function portainerFetch<T>(baseUrl: string, path: string, apiKey: string, verifyTls: boolean): Promise<T> {
  const u = new URL(path, baseUrl);
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
    req.setTimeout(6000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.on("error", reject);
    req.end();
  });
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const instances = cfg.integrations.portainer;
  const p = id ? instances.find((i) => i.id === id) : instances[0];

  if (!p?.baseUrl || !p?.apiKey) {
    return NextResponse.json({ configured: false, online: false } satisfies PortainerWidgetData);
  }

  const baseUrl = p.baseUrl.replace(/\/$/, "");
  const apiKey = p.apiKey;
  const endpointId = p.endpointId ?? 1;
  const verifyTls = p.verifyTls ?? false;

  try {
    const [containersRaw, stacksRaw, endpointsRaw] = await Promise.all([
      portainerFetch<RawContainer[]>(baseUrl, `/api/endpoints/${endpointId}/docker/containers/json?all=1`, apiKey, verifyTls),
      portainerFetch<RawStack[]>(baseUrl, `/api/stacks`, apiKey, verifyTls).catch(() => [] as RawStack[]),
      portainerFetch<RawEndpoint[]>(baseUrl, `/api/endpoints`, apiKey, verifyTls).catch(() => [] as RawEndpoint[]),
    ]);

    const endpointName = endpointsRaw.find((e) => e.Id === endpointId)?.Name;

    const containers: PortainerContainer[] = containersRaw.map((c) => ({
      id: c.Id.slice(0, 12),
      name: (c.Names[0] ?? c.Id).replace(/^\//, ""),
      image: c.Image.split(":")[0]?.split("/").pop() ?? c.Image,
      state: c.State,
      status: c.Status,
    }));

    const running = containers.filter((c) => c.state === "running").length;
    const stopped = containers.filter((c) => c.state === "exited").length;
    const paused  = containers.filter((c) => c.state === "paused").length;

    const stacks: PortainerStack[] = stacksRaw.map((s) => ({
      name: s.Name,
      status: s.Status,
    }));

    return NextResponse.json({
      configured: true,
      online: true,
      ...(endpointName ? { endpointName } : {}),
      containers,
      stacks,
      summary: { total: containers.length, running, stopped, paused },
    } satisfies PortainerWidgetData);
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    } satisfies PortainerWidgetData);
  }
}
