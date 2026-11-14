/* Detaildaten eines Unraid-Servers für die Seite je Server und für die Hinweise:
   Platten, Container, VMs und die ungelesenen Warnungen von Unraid selbst.
   Jede Teilabfrage läuft einzeln, ein Fehler in einer nimmt die anderen nicht mit. */
import { graphqlCall, parseEndpoint, type UnraidInstanceConfig } from "./load";

export type UnraidDisk = {
  name: string;
  device: string | null;
  role: "data" | "parity" | "cache";
  status: string;
  ok: boolean;
  tempC: number | null;
  errors: number;
  spinning: boolean | null;
  sizeTb: number | null;
  /** Fill level in percent, only for disks with a file system. */
  usedPercent: number | null;
};

export type UnraidContainer = {
  id: string;
  name: string;
  running: boolean;
  state: string;
  status: string;
  autoStart: boolean;
};

export type UnraidVm = { id: string; name: string; state: string; running: boolean };

export type UnraidNotice = {
  id: string;
  level: "alert" | "warning";
  title: string;
  subject: string;
  description: string;
  timestamp: string | null;
};

export type UnraidDetail = {
  id: string;
  label: string;
  online: boolean;
  disks: UnraidDisk[] | null;
  containers: UnraidContainer[] | null;
  vms: UnraidVm[] | null;
  notices: UnraidNotice[] | null;
};

const DISK_FIELDS = "name device size status temp numErrors fsSize fsUsed isSpinning";
export const QUERY_DISKS = `{ array { disks { ${DISK_FIELDS} } parities { ${DISK_FIELDS} } caches { ${DISK_FIELDS} } } }`;
export const QUERY_CONTAINERS = `{ docker { containers { id names state status autoStart } } }`;
export const QUERY_VM_LIST = `{ vms { domain { id name state } } }`;
export const QUERY_NOTICES = `{ notifications { warningsAndAlerts { id title subject description importance timestamp } } }`;

type RawDisk = {
  name?: string | null;
  device?: string | null;
  size?: number | string | null;
  status?: string | null;
  temp?: number | null;
  numErrors?: number | string | null;
  fsSize?: number | string | null;
  fsUsed?: number | string | null;
  isSpinning?: boolean | null;
};

function dataOf<T>(raw: string): T | null {
  try {
    const json = JSON.parse(raw) as { data?: T; errors?: unknown[] };
    if (json.errors?.length || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function toDisk(d: RawDisk, role: UnraidDisk["role"]): UnraidDisk {
  const sizeKb = num(d.size);
  const fsSize = num(d.fsSize);
  const fsUsed = num(d.fsUsed);
  const status = d.status ?? "UNKNOWN";
  return {
    name: d.name ?? "?",
    device: d.device ?? null,
    role,
    status,
    ok: status === "DISK_OK",
    tempC: num(d.temp),
    errors: num(d.numErrors) ?? 0,
    spinning: d.isSpinning ?? null,
    sizeTb: sizeKb ? Math.round((sizeKb / 1024 ** 3) * 10) / 10 : null,
    usedPercent: fsSize && fsUsed !== null && fsSize > 0 ? Math.round((fsUsed / fsSize) * 100) : null,
  };
}

export function parseDisks(raw: string): UnraidDisk[] | null {
  const d = dataOf<{ array?: { disks?: RawDisk[]; parities?: RawDisk[]; caches?: RawDisk[] } }>(raw);
  if (!d?.array) return null;
  // Empty slots (DISK_NP) are not disks.
  const present = (x: RawDisk) => x.status !== "DISK_NP";
  return [
    ...(d.array.parities ?? []).filter(present).map((x) => toDisk(x, "parity")),
    ...(d.array.disks ?? []).filter(present).map((x) => toDisk(x, "data")),
    ...(d.array.caches ?? []).filter(present).map((x) => toDisk(x, "cache")),
  ];
}

export function parseContainers(raw: string): UnraidContainer[] | null {
  const d = dataOf<{ docker?: { containers?: { id: string; names?: string[]; state: string; status?: string; autoStart?: boolean }[] } }>(raw);
  if (!d?.docker?.containers) return null;
  return d.docker.containers
    .map((c) => ({
      id: c.id,
      name: (c.names?.[0] ?? c.id).replace(/^\//, ""),
      running: c.state === "RUNNING",
      state: c.state,
      status: c.status ?? "",
      autoStart: c.autoStart ?? false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
}

export function parseVms(raw: string): UnraidVm[] | null {
  const d = dataOf<{ vms?: { domain?: { id: string; name?: string | null; state: string }[] } }>(raw);
  if (!d?.vms?.domain) return null;
  return d.vms.domain
    .map((v) => ({ id: v.id, name: v.name ?? v.id, state: v.state, running: v.state === "RUNNING" }))
    .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
}

export function parseNotices(raw: string): UnraidNotice[] | null {
  const d = dataOf<{
    notifications?: { warningsAndAlerts?: { id: string; title: string; subject: string; description: string; importance: string; timestamp?: string | null }[] };
  }>(raw);
  if (!d?.notifications?.warningsAndAlerts) return null;
  return d.notifications.warningsAndAlerts
    .filter((n) => n.importance === "ALERT" || n.importance === "WARNING")
    .map((n) => ({
      id: n.id,
      level: n.importance === "ALERT" ? ("alert" as const) : ("warning" as const),
      title: n.title,
      subject: n.subject,
      description: n.description,
      timestamp: n.timestamp ?? null,
    }));
}

export async function loadUnraidDetail(u: UnraidInstanceConfig): Promise<UnraidDetail> {
  const transport = parseEndpoint(u.endpoint);
  const [disks, containers, vms, notices] = await Promise.allSettled([
    graphqlCall(transport, u.apiKey, QUERY_DISKS),
    graphqlCall(transport, u.apiKey, QUERY_CONTAINERS),
    graphqlCall(transport, u.apiKey, QUERY_VM_LIST),
    graphqlCall(transport, u.apiKey, QUERY_NOTICES),
  ]);
  const val = <T,>(r: PromiseSettledResult<string>, parse: (raw: string) => T | null): T | null =>
    r.status === "fulfilled" ? parse(r.value) : null;
  return {
    id: u.id,
    label: u.label,
    online: [disks, containers, vms, notices].some((r) => r.status === "fulfilled"),
    disks: val(disks, parseDisks),
    containers: val(containers, parseContainers),
    vms: val(vms, parseVms),
    notices: val(notices, parseNotices),
  };
}
