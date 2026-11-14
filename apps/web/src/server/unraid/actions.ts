/* Aktionen an Containern und VMs eines Unraid-Servers.
   Schutzregeln, alle vor dem Aufruf geprüft:
   - das Ziel muss in der aktuellen Liste des Servers stehen, die ID kommt nie ungeprüft vom Aufrufer
   - Mesh stoppt oder startet sich nicht selbst neu, sonst wäre die Fernbedienung weg
   - nur die hier aufgezählten Vorgänge, kein Löschen, kein hartes Abschalten
   - ein Update nur, wenn Unraid für genau diesen Container ein neues Image meldet */
import { graphqlCall, parseEndpoint, type UnraidInstanceConfig } from "./load";
import { parseContainers, parseUpdates, parseVms, withUpdates, QUERY_CONTAINERS, QUERY_UPDATES, QUERY_VM_LIST, type UnraidContainer, type UnraidVm } from "./detail";

export const CONTAINER_OPS = ["start", "stop", "restart", "update"] as const;
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
  if (op === "update") {
    return c.updateAvailable ? { ok: true, name: c.name } : { ok: false, reason: `Für ${c.name} meldet Unraid kein Update` };
  }
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
  const field = op === "update" ? "updateContainer" : op;
  return `mutation { docker { ${field}(id: "${id}") { id state } } }`;
}

export function vmMutation(id: string, op: VmOp): string {
  if (!isSafeId(id) || !VM_OPS.includes(op)) throw new Error("Ungültige Aktion");
  return `mutation { vm { ${op}(id: "${id}") } }`;
}

export type GqlCall = (query: string, timeoutMs?: number) => Promise<string>;

/** An update pulls an image and can take minutes. The request waits this long,
 *  after that the update keeps running on the server and the outcome is "started". */
export const UPDATE_WAIT_MS = 20_000;
const UPDATE_TIMEOUT_MS = 15 * 60 * 1000;

function assertNoErrors(raw: string): void {
  const json = JSON.parse(raw) as { errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "Unraid meldet einen Fehler");
}

export type ActionOutcome = {
  result: "ok" | "failed" | "refused";
  name: string;
  detail?: string;
  /** Set when the action is still running. Resolves with the final outcome for the log. */
  pending?: Promise<ActionOutcome>;
};

/** `call` is injected so the rules can be tested without a server. */
export async function runContainerAction(
  call: GqlCall,
  id: string,
  op: ContainerOp,
  self: string[] = selfNames(),
  waitMs: number = UPDATE_WAIT_MS,
): Promise<ActionOutcome> {
  let list = parseContainers(await call(QUERY_CONTAINERS));
  if (!list) return { result: "failed", name: id, detail: "Die Containerliste konnte nicht gelesen werden" };
  if (op === "update") {
    const updates = await call(QUERY_UPDATES, 12_000).then(parseUpdates, () => null);
    if (!updates) return { result: "failed", name: list.find((c) => c.id === id)?.name ?? id, detail: "Der Update-Stand konnte nicht gelesen werden" };
    list = withUpdates(list, updates);
  }
  const check = checkContainerAction(list, id, op, self);
  if (!check.ok) return { result: "refused", name: list.find((c) => c.id === id)?.name ?? id, detail: check.reason };
  const name = check.name;
  const run = (timeoutMs?: number): Promise<ActionOutcome> =>
    call(containerMutation(id, op), timeoutMs).then(
      (raw): ActionOutcome => {
        try {
          assertNoErrors(raw);
          return { result: "ok", name };
        } catch (err) {
          return { result: "failed", name, detail: err instanceof Error ? err.message : "Unbekannter Fehler" };
        }
      },
      (err): ActionOutcome => ({ result: "failed", name, detail: err instanceof Error ? err.message : "Unbekannter Fehler" }),
    );
  if (op !== "update") return run();

  const final = run(UPDATE_TIMEOUT_MS);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = await Promise.race([
    final,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), waitMs);
    }),
  ]);
  if (timer) clearTimeout(timer);
  return waited ?? { result: "ok", name, detail: "Update läuft noch", pending: final };
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
  return (query, timeoutMs) => graphqlCall(transport, u.apiKey, query, timeoutMs);
}
