import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { request as httpRequest } from "node:http";
import { request as httpsRequest, Agent as HttpsAgent } from "node:https";
import { requireApiAuth } from "@/server/auth/api-auth";

const insecureHttpsAgent = new HttpsAgent({ rejectUnauthorized: false });

export const dynamic = "force-dynamic";

/* Core query — must always succeed. */
const QUERY_CORE = `{
  online
  info {
    cpu { brand cores threads }
    memory { layout { size type clockSpeed } }
    os { hostname uptime kernel }
    versions { core { unraid } }
  }
  array {
    state
    capacity {
      kilobytes { free used total }
      disks { free used total }
    }
  }
}`;

/* Optional queries — each fired independently. Failure of one
   doesn't break the rest (e.g. VMs disabled, Docker not running). */
const QUERY_DOCKER = `{ docker { containers { state names } } }`;
const QUERY_VMS = `{ vms { domain { state } } }`;
const QUERY_SERVICES = `{ services { name online uptime { timestamp } } }`;

const SOCKET_PATH = process.env["UNRAID_SOCKET"] ?? "/var/run/unraid-api.sock";

export type UnraidArrayCapacity = {
  /** TB used, computed from kilobytes */
  usedTb: number;
  /** TB total */
  totalTb: number;
  /** % used (0..100) */
  percent: number;
  diskCount: { used: number; free: number; total: number };
};

export type UnraidInstanceData = {
  online: boolean;
  hostname?: string;
  bootedAt?: string;
  unraidVersion?: string;
  cpu?: { brand: string; cores: number; threads: number };
  /** Total physical RAM in GB (sum of memory.layout[].size) */
  memoryTotalGb?: number;
  array?: {
    state: string;
    capacity?: UnraidArrayCapacity;
  };
  containers?: { running: number; total: number };
  vms?: { running: number; total: number };
  services?: { name: string; online: boolean }[];
};

export type UnraidWidgetData = {
  instances: ({
    id: string;
    label: string;
    endpoint: string;
    /** Navigable URL for linking — undefined for socket-based instances */
    webUrl?: string;
    online: true;
    data: UnraidInstanceData;
  } | {
    id: string;
    label: string;
    endpoint: string;
    webUrl?: string;
    online: false;
    error: string;
  })[];
};

type Transport =
  | { kind: "socket"; socketPath: string }
  | { kind: "http"; host: string; port: number; protocol: "http:" | "https:" };

function parseEndpoint(endpoint: string): Transport {
  const trimmed = endpoint.trim();

  // Explicit socket request: "socket", "unix:..", "socket://..", or empty.
  if (
    !trimmed ||
    trimmed === "socket" ||
    trimmed.startsWith("unix:") ||
    trimmed.startsWith("socket://")
  ) {
    return { kind: "socket", socketPath: SOCKET_PATH };
  }

  // Loopback endpoints → use the mounted socket if available.
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(trimmed)) {
    return { kind: "socket", socketPath: SOCKET_PATH };
  }

  try {
    const u = new URL(trimmed);
    return {
      kind: "http",
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80,
      protocol: u.protocol === "https:" ? "https:" : "http:",
    };
  } catch {
    return { kind: "socket", socketPath: SOCKET_PATH };
  }
}

function graphqlCall(transport: Transport, apiKey: string, query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "x-api-key": apiKey,
    };

    const reqFn = transport.kind === "http" && transport.protocol === "https:"
      ? httpsRequest
      : httpRequest;

    const options = transport.kind === "socket"
      ? { socketPath: transport.socketPath, path: "/graphql", method: "POST", headers }
      : transport.protocol === "https:"
      ? { host: transport.host, port: transport.port, path: "/graphql", method: "POST", headers, agent: insecureHttpsAgent }
      : { host: transport.host, port: transport.port, path: "/graphql", method: "POST", headers };

    const req = reqFn(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => resolve(data));
    });
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

type GqlResponse = {
  data?: {
    online?: boolean;
    info?: {
      cpu?: { brand: string; cores: number; threads: number };
      memory?: { layout?: { size: number; type?: string; clockSpeed?: number }[] };
      os?: { hostname?: string; uptime?: string; kernel?: string };
      versions?: { core?: { unraid?: string } };
    };
    array?: {
      state: string;
      capacity?: {
        kilobytes?: { free: string; used: string; total: string };
        disks?: { free: string; used: string; total: string };
      };
      parities?: { name: string; size: number | string; status: string }[];
      caches?: { name: string; size: number | string; status: string }[];
    };
    docker?: { containers?: { state: string; names: string[] }[] };
    vms?: { domain?: { state: string }[] };
    services?: { name: string; online: boolean }[];
  };
  errors?: { message: string }[];
};

function parseCore(raw: string): UnraidInstanceData {
  const json = JSON.parse(raw) as GqlResponse;
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "GraphQL error");

  const d = json.data ?? {};
  const result: UnraidInstanceData = { online: !!d.online };

  if (d.info?.cpu) {
    result.cpu = { brand: d.info.cpu.brand, cores: d.info.cpu.cores, threads: d.info.cpu.threads };
  }

  if (d.info?.memory?.layout && d.info.memory.layout.length > 0) {
    const totalBytes = d.info.memory.layout.reduce((sum, m) => sum + (m.size ?? 0), 0);
    result.memoryTotalGb = Math.round((totalBytes / (1024 ** 3)) * 10) / 10;
  }

  if (d.info?.os) {
    if (d.info.os.hostname) result.hostname = d.info.os.hostname;
    if (d.info.os.uptime) result.bootedAt = d.info.os.uptime;
  }

  const ver = d.info?.versions?.core?.unraid;
  if (ver) result.unraidVersion = ver;

  if (d.array) {
    const arr: UnraidInstanceData["array"] = { state: d.array.state };
    if (d.array.capacity?.kilobytes && d.array.capacity?.disks) {
      const used = parseInt(d.array.capacity.kilobytes.used, 10);
      const total = parseInt(d.array.capacity.kilobytes.total, 10);
      const usedTb = Math.round((used / (1024 ** 3)) * 100) / 100;
      const totalTb = Math.round((total / (1024 ** 3)) * 100) / 100;
      const percent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
      arr.capacity = {
        usedTb,
        totalTb,
        percent,
        diskCount: {
          used: parseInt(d.array.capacity.disks.used, 10),
          free: parseInt(d.array.capacity.disks.free, 10),
          total: parseInt(d.array.capacity.disks.total, 10),
        },
      };
    }
    result.array = arr;
  }

  return result;
}

function mergeOptional(base: UnraidInstanceData, raw: string, key: "docker" | "vms" | "services"): void {
  try {
    const json = JSON.parse(raw) as GqlResponse;
    if (json.errors?.length) return;
    const d = json.data ?? {};

    if (key === "docker" && d.docker?.containers) {
      const total = d.docker.containers.length;
      const running = d.docker.containers.filter((c) => c.state === "RUNNING").length;
      base.containers = { running, total };
    }
    if (key === "vms" && d.vms?.domain) {
      const total = d.vms.domain.length;
      const running = d.vms.domain.filter((v) => v.state === "RUNNING").length;
      base.vms = { running, total };
    }
    if (key === "services" && d.services) {
      base.services = d.services.map((s) => ({ name: s.name, online: s.online }));
    }
  } catch {
    /* ignore — optional */
  }
}

function endpointToWebUrl(endpoint: string): string | undefined {
  const trimmed = endpoint.trim();
  if (!trimmed || trimmed === "socket" || trimmed.startsWith("unix:") || trimmed.startsWith("socket://")) return undefined;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(trimmed)) return undefined;
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}`;
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const { unraid } = cfg.integrations;

  if (!unraid || unraid.length === 0) {
    return NextResponse.json({ instances: [] } satisfies UnraidWidgetData);
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const filterIds = idsParam ? new Set(idsParam.split(",").filter(Boolean)) : null;
  const filtered = filterIds ? unraid.filter((u) => filterIds.has(u.id)) : unraid;

  const instances: UnraidWidgetData["instances"] = await Promise.all(
    filtered.map(async (u) => {
      try {
        const transport = parseEndpoint(u.endpoint);
        const coreRaw = await graphqlCall(transport, u.apiKey, QUERY_CORE);
        const data = parseCore(coreRaw);

        // Optional sub-queries — failure of any one is non-fatal.
        const [dockerR, vmsR, servicesR] = await Promise.allSettled([
          graphqlCall(transport, u.apiKey, QUERY_DOCKER),
          graphqlCall(transport, u.apiKey, QUERY_VMS),
          graphqlCall(transport, u.apiKey, QUERY_SERVICES),
        ]);
        if (dockerR.status === "fulfilled") mergeOptional(data, dockerR.value, "docker");
        if (vmsR.status === "fulfilled") mergeOptional(data, vmsR.value, "vms");
        if (servicesR.status === "fulfilled") mergeOptional(data, servicesR.value, "services");

        const webUrl = endpointToWebUrl(u.endpoint);
        const onlineResult: UnraidWidgetData["instances"][number] = { id: u.id, label: u.label, endpoint: u.endpoint, online: true, data };
        if (webUrl) onlineResult.webUrl = webUrl;
        return onlineResult;
      } catch (err) {
        const webUrl = endpointToWebUrl(u.endpoint);
        const offlineResult: UnraidWidgetData["instances"][number] = {
          id: u.id,
          label: u.label,
          endpoint: u.endpoint,
          online: false,
          error: err instanceof Error ? err.message : "Verbindungsfehler",
        };
        if (webUrl) offlineResult.webUrl = webUrl;
        return offlineResult;
      }
    }),
  );

  return NextResponse.json({ instances } satisfies UnraidWidgetData);
}
