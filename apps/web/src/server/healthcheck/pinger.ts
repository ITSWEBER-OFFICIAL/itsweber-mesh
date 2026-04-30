import type { Service } from "../config/schema";

export type PingStatus = "online" | "offline" | "unknown";

export type PingResult = {
  status: PingStatus;
  latencyMs: number | null;
  checkedAt: string;
  statusCode?: number;
  error?: string;
};

function nodeBuiltin<T>(specifier: string): T {
  const loadBuiltin = process.getBuiltinModule as ((id: string) => T) | undefined;
  if (loadBuiltin) return loadBuiltin(specifier);

  const loadRequire = new Function("return typeof require === 'function' ? require : null") as
    () => NodeJS.Require | null;
  const requireFn = loadRequire();
  if (!requireFn) {
    throw new Error(`Node.js ${specifier} module is unavailable in this runtime.`);
  }
  return requireFn(specifier) as T;
}

/** Normalises a URL: ensures it has a scheme, auto-upgrades schemeless HTTPS hosts. */
function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  // No scheme — default to https so SNI works correctly
  return `https://${trimmed}`;
}

export async function pingHttp(
  url: string,
  expectStatus: number[],
  timeoutMs: number
): Promise<PingResult> {
  const normUrl = normaliseUrl(url);
  const start = Date.now();
  const checkedAt = new Date().toISOString();

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: PingResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const isHttps = normUrl.startsWith("https://");
    const { request: httpsRequest, Agent } = nodeBuiltin<typeof import("https")>("https");
    const { request: httpRequest } = nodeBuiltin<typeof import("http")>("http");
    const reqFn = isHttps ? httpsRequest : httpRequest;

    // Per-request agent with correct servername for SNI — required for reverse proxies
    // that serve multiple vhosts (e.g. Nginx Proxy Manager, Traefik).
    // SNI is for hostnames only; skip it for IP literals (IPv4 / bracketed IPv6) — TLS spec
    // forbids IP-literal SNI and some servers reject it.
    let hostname = "";
    try { hostname = new URL(normUrl).hostname; } catch { /* ignore */ }
    const isIpLiteral =
      hostname === "" ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
      hostname.includes(":") ||
      hostname.startsWith("[");
    const extraOpts = isHttps
      ? {
          agent: new Agent(
            isIpLiteral
              ? { rejectUnauthorized: false }
              : { rejectUnauthorized: false, servername: hostname },
          ),
        }
      : {};

    let req: import("http").ClientRequest | undefined;

    const timer = setTimeout(() => {
      req?.destroy();
      settle({ status: "offline", latencyMs: null, checkedAt, error: "timeout" });
    }, timeoutMs);

    try {
      req = reqFn(
        normUrl,
        // Use GET — HEAD is rejected by some services (e.g. HA returns 405)
        { method: "GET", ...extraOpts },
        (res) => {
          res.resume(); // Drain immediately so the socket is freed
          const latencyMs = Date.now() - start;
          const statusCode = res.statusCode ?? 0;
          settle({
            status: expectStatus.includes(statusCode) ? "online" : "offline",
            latencyMs,
            checkedAt,
            statusCode,
          });
        }
      );

      req.on("error", (err) => {
        settle({ status: "offline", latencyMs: null, checkedAt, error: err.message });
      });

      req.end();
    } catch (err) {
      settle({
        status: "offline",
        latencyMs: null,
        checkedAt,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  });
}

export async function pingTcp(
  host: string,
  port: number,
  timeoutMs: number
): Promise<PingResult> {
  const start = Date.now();
  const checkedAt = new Date().toISOString();

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: PingResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const { createConnection } = nodeBuiltin<typeof import("net")>("net");
    const socket = createConnection({ host, port });

    const timer = setTimeout(() => {
      settle({ status: "offline", latencyMs: null, checkedAt, error: "timeout" });
    }, timeoutMs);

    socket.on("connect", () => {
      clearTimeout(timer);
      settle({ status: "online", latencyMs: Date.now() - start, checkedAt });
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      settle({ status: "offline", latencyMs: null, checkedAt, error: err.message });
    });
  });
}

export type PingTargetLike = {
  kind: "http" | "tcp" | "none";
  url?: string | undefined;
  host?: string | undefined;
  port?: number | undefined;
  expectStatus: number[];
  timeoutMs: number;
};

export async function pingTarget(target: PingTargetLike, fallbackUrl?: string): Promise<PingResult> {
  if (target.kind === "none") {
    return { status: "unknown", latencyMs: null, checkedAt: new Date().toISOString() };
  }
  if (target.kind === "http") {
    const url = target.url ?? fallbackUrl ?? "";
    if (!url) return { status: "unknown", latencyMs: null, checkedAt: new Date().toISOString() };
    return pingHttp(url, target.expectStatus, target.timeoutMs);
  }
  if (target.kind === "tcp") {
    return pingTcp(target.host ?? "", target.port ?? 80, target.timeoutMs);
  }
  return { status: "unknown", latencyMs: null, checkedAt: new Date().toISOString() };
}

export async function pingService(service: Service): Promise<PingResult> {
  return pingTarget(service.pingTarget, service.url);
}
