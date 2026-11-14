import { connect } from "node:tls";
import pLimit from "p-limit";
import type { Config } from "@/server/config/schema";
import { loadUnraidInstances } from "@/server/unraid/load";
import {
  certHints,
  certHosts,
  haUpdateHints,
  unraidHints,
  sortHints,
  type CertProbe,
  type HaUpdateEntity,
  type Hint,
  type SourceState,
} from "./build";

export type HintsResult = { hints: Hint[]; sources: SourceState[]; checkedAt: number };

/* Certificates change rarely: one probe per host every six hours is enough. */
const CERT_TTL_MS = 6 * 60 * 60 * 1000;
const CERT_RETRY_MS = 10 * 60 * 1000;
const certCache = new Map<string, { at: number; probe: CertProbe }>();

function probeCert(hostPort: string): Promise<CertProbe> {
  const [host = hostPort, port] = hostPort.split(":");
  return new Promise((resolve) => {
    let done = false;
    const finish = (probe: CertProbe) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(probe);
    };
    // rejectUnauthorized stays off on purpose: an expired certificate must be
    // read and reported, not turned into a connection error. No data is sent.
    const socket = connect({ host, port: port ? Number(port) : 443, servername: host, rejectUnauthorized: false, timeout: 5000 }, () => {
      const cert = socket.getPeerCertificate();
      const validTo = cert?.valid_to ? Date.parse(cert.valid_to) : NaN;
      finish(Number.isFinite(validTo) ? { host: hostPort, ok: true, validTo } : { host: hostPort, ok: false, error: "Kein Zertifikat" });
    });
    socket.on("timeout", () => finish({ host: hostPort, ok: false, error: "Zeitüberschreitung" }));
    socket.on("error", (e) => finish({ host: hostPort, ok: false, error: e.message }));
  });
}

async function probeCerts(hosts: string[], now: number): Promise<CertProbe[]> {
  const limit = pLimit(6);
  return Promise.all(
    hosts.map((h) =>
      limit(async () => {
        const hit = certCache.get(h);
        if (hit && now - hit.at < (hit.probe.ok ? CERT_TTL_MS : CERT_RETRY_MS)) return hit.probe;
        const probe = await probeCert(h);
        certCache.set(h, { at: now, probe });
        return probe;
      }),
    ),
  );
}

async function loadHaUpdates(ha: Config["integrations"]["homeAssistant"]): Promise<HaUpdateEntity[] | null> {
  if (!ha?.baseUrl || !ha?.token) return null;
  const res = await fetch(`${ha.baseUrl.replace(/\/$/, "")}/api/states`, {
    headers: { Authorization: `Bearer ${ha.token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const all = (await res.json()) as HaUpdateEntity[];
  return all.filter((e) => e.entity_id.startsWith("update."));
}

/** Collects the hints of all sources. A failing source never hides the others,
 *  it is listed in `sources` so the view can say what could not be checked. */
export async function collectHints(cfg: Config, now: number = Date.now()): Promise<HintsResult> {
  const hints: Hint[] = [];
  const sources: SourceState[] = [];

  const hosts = certHosts(cfg.services.filter((s) => s.enabled).flatMap((s) => [s.url, s.urlExternal, s.urlInternal]));
  const [certs, ha, unraid] = await Promise.allSettled([
    probeCerts(hosts, now),
    loadHaUpdates(cfg.integrations.homeAssistant),
    cfg.integrations.unraid.length > 0 ? loadUnraidInstances(cfg.integrations.unraid) : Promise.resolve(null),
  ]);

  if (certs.status === "fulfilled") {
    hints.push(...certHints(certs.value, now));
    const failed = certs.value.filter((p) => !p.ok).length;
    sources.push({ source: "certs", ok: true, note: `${certs.value.length - failed} von ${certs.value.length} Zertifikaten geprüft` });
  } else {
    sources.push({ source: "certs", ok: false, note: "Zertifikate nicht geprüft" });
  }

  if (ha.status === "fulfilled") {
    if (ha.value) {
      hints.push(...haUpdateHints(ha.value));
      sources.push({ source: "homeAssistant", ok: true });
    }
  } else {
    sources.push({ source: "homeAssistant", ok: false, note: "Home Assistant antwortet nicht, Updates unbekannt" });
  }

  if (unraid.status === "fulfilled") {
    if (unraid.value) {
      hints.push(...unraidHints(unraid.value));
      sources.push({ source: "unraid", ok: true });
    }
  } else {
    sources.push({ source: "unraid", ok: false, note: "Unraid nicht abgefragt" });
  }

  return { hints: sortHints(hints), sources, checkedAt: now };
}
