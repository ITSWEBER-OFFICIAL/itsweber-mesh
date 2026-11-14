/* Aktionen an Containern und VMs eines Unraid-Servers.
   Schutzregeln, alle vor dem Aufruf geprüft:
   - das Ziel muss in der aktuellen Liste des Servers stehen, die ID kommt nie ungeprüft vom Aufrufer
   - Mesh stoppt oder startet sich nicht selbst neu, sonst wäre die Fernbedienung weg
   - nur die hier aufgezählten Vorgänge, kein Löschen, kein Update, kein hartes Abschalten */
import { graphqlCall, parseEndpoint, type UnraidInstanceConfig } from "./load";
import { parseContainers, parseVms, QUERY_CONTAINERS, QUERY_VM_LIST, type UnraidContainer, type UnraidVm } from "./detail";

export const CONTAINER_OPS = ["start", "stop", "restart"] as const;
export const VM_OPS = ["start", "stop"] as const;
export type ContainerOp = (typeof CONTAINER_OPS)[number];
export type VmOp = (typeof VM_OPS)[number];

export type ActionCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Unraid IDs are "<hash>:<hash or name>". Anything else never reaches a query. */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9:_.\-]{0,199}$/;

export function isSafeId(id: string): boolean {
  return ID_RE.test(id);
}

/** Names under which this Mesh instance may run as a container. */
export function selfNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return [env["HOST_CONTAINERNAME"], env["HOSTNAME"]].filter((v): v is string => !!v).map((v) => v.toLowerCase());
}

export function checkContainerAction(list: UnraidContainer[], id: string, op: ContainerOp, self: string[]): ActionCheck {
  if (!isSafeId(id)) return { ok: false, reason: "Ungültige Kennung" };
  const c = list.find((x) => x.id === id);
  if (!c) return { ok: false, reason: "Der Container steht nicht mehr in der Liste des Servers" };
  const isSelf = self.includes(c.name.toLowerCase()) || self.some((s) => s.length >= 12 && c.id.includes(s));
  if (isSelf && op !== "start") return { ok: false, reason: "Mesh stoppt sich nicht selbst" };
  if (op === "start" && c.running) return { ok: false, reason: `${c.name} läuft bereits` };
  if (op !== "start" && !c.running) return { ok: false, reason: `${c.name} läuft nicht` };
  return { ok: true, name: c.name };
}

export function checkVmAction(list: UnraidVm[], id: string, op: VmOp): ActionCheck {
  if (!isSafeId(id)) return { ok: false, reason: "Ungültige Kennung" };
  const v = list.find((x) => x.id === id);
  if (!v) return { ok: false, reason: "Die VM steht nicht mehr in der Liste des Servers" };
  if (op === "start" && v.running) return { ok: false, reason: `${v.name} läuft bereits` };
  if (op === "stop" && !v.running) return { ok: false, reason: `${v.name} läuft nicht` };
  return { ok: true, name: v.name };
}

export function containerMutation(id: string, op: ContainerOp): string {
  if (!isSafeId(id) || !CONTAINER_OPS.includes(op)) throw new Error("Ungültige Aktion");
  return `mutation { docker { ${op}(id: "${id}") { id state } } }`;
}

export function vmMutation(id: string, op: VmOp): string {
  if (!isSafeId(id) || !VM_OPS.includes(op)) throw new Error("Ungültige Aktion");
  return `mutation { vm { ${op}(id: "${id}") } }`;
}

export type GqlCall = (query: string) => Promise<string>;

function assertNoErrors(raw: string): void {
  const json = JSON.parse(raw) as { errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "Unraid meldet einen Fehler");
}

export type ActionOutcome = { result: "ok" | "failed" | "refused"; name: string; detail?: string };

/** `call` is injected so the rules can be tested without a server. */
export async function runContainerAction(call: GqlCall, id: string, op: ContainerOp, self: string[] = selfNames()): Promise<ActionOutcome> {
  const list = parseContainers(await call(QUERY_CONTAINERS));
  if (!list) return { result: "failed", name: id, detail: "Die Containerliste konnte nicht gelesen werden" };
  const check = checkContainerAction(list, id, op, self);
  if (!check.ok) return { result: "refused", name: list.find((c) => c.id === id)?.name ?? id, detail: check.reason };
  try {
    assertNoErrors(await call(containerMutation(id, op)));
    return { result: "ok", name: check.name };
  } catch (err) {
    return { result: "failed", name: check.name, detail: err instanceof Error ? err.message : "Unbekannter Fehler" };
  }
}

export async function runVmAction(call: GqlCall, id: string, op: VmOp): Promise<ActionOutcome> {
  const list = parseVms(await call(QUERY_VM_LIST));
  if (!list) return { result: "failed", name: id, detail: "Die VM-Liste konnte nicht gelesen werden" };
  const check = checkVmAction(list, id, op);
  if (!check.ok) return { result: "refused", name: list.find((v) => v.id === id)?.name ?? id, detail: check.reason };
  try {
    assertNoErrors(await call(vmMutation(id, op)));
    return { result: "ok", name: check.name };
  } catch (err) {
    return { result: "failed", name: check.name, detail: err instanceof Error ? err.message : "Unbekannter Fehler" };
  }
}

export function callerFor(u: UnraidInstanceConfig): GqlCall {
  const transport = parseEndpoint(u.endpoint);
  return (query) => graphqlCall(transport, u.apiKey, query);
}
