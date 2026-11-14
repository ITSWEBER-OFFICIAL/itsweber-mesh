import { describe, it, expect } from "vitest";
import { checkContainerAction, containerMutation, runContainerAction } from "@/server/unraid/actions";
import { parseUpdates, withUpdates } from "@/server/unraid/detail";

const SELF = ["itsweber-mesh"];
const list = [
  { id: "h:aaa", name: "frigate", running: true, state: "RUNNING", status: "Up", autoStart: true, updateAvailable: true },
  { id: "h:bbb", name: "heimdall", running: true, state: "RUNNING", status: "Up", autoStart: true, updateAvailable: false },
  { id: "h:ccc", name: "ITSWEBER-Mesh", running: true, state: "RUNNING", status: "Up", autoStart: true, updateAvailable: true },
];
const listAnswer = JSON.stringify({
  data: { docker: { containers: list.map((c) => ({ id: c.id, names: [`/${c.name}`], state: c.state, status: c.status, autoStart: c.autoStart })) } },
});
const updatesAnswer = JSON.stringify({
  data: { docker: { containerUpdateStatuses: [
    { name: "frigate", updateStatus: "UPDATE_AVAILABLE" },
    { name: "heimdall", updateStatus: "UP_TO_DATE" },
    { name: "ITSWEBER-Mesh", updateStatus: "UPDATE_AVAILABLE" },
    { name: "alt", updateStatus: "UNKNOWN" },
  ] } },
});

describe("container updates", () => {
  it("reads which containers have a newer image", () => {
    const updates = parseUpdates(updatesAnswer);
    expect([...(updates ?? [])].sort()).toEqual(["ITSWEBER-Mesh", "frigate"]);
    expect(parseUpdates(JSON.stringify({ errors: [{ message: "x" }] }))).toBeNull();
    const merged = withUpdates(list.map((c) => ({ ...c, updateAvailable: false })), updates);
    expect(merged.map((c) => c.updateAvailable)).toEqual([true, false, true]);
  });

  it("updates only when Unraid reports an update, and never Mesh itself", () => {
    expect(checkContainerAction(list, "h:aaa", "update", SELF)).toEqual({ ok: true, name: "frigate" });
    expect(checkContainerAction(list, "h:bbb", "update", SELF)).toMatchObject({ ok: false });
    expect(checkContainerAction(list, "h:ccc", "update", SELF)).toEqual({ ok: false, reason: "Mesh stoppt sich nicht selbst" });
    expect(containerMutation("h:aaa", "update")).toBe('mutation { docker { updateContainer(id: "h:aaa") { id state } } }');
  });

  it("does not update when the update state cannot be read", async () => {
    const sent: string[] = [];
    const call = async (q: string) => {
      sent.push(q);
      return q.includes("containerUpdateStatuses") ? JSON.stringify({ errors: [{ message: "registry down" }] }) : listAnswer;
    };
    expect((await runContainerAction(call, "h:aaa", "update", SELF)).result).toBe("failed");
    expect(sent.some((q) => q.startsWith("mutation"))).toBe(false);
  });

  it("reports a quick update as done", async () => {
    const call = async (q: string) =>
      q.startsWith("mutation") ? JSON.stringify({ data: { docker: { updateContainer: { id: "h:aaa", state: "RUNNING" } } } }) : q.includes("containerUpdateStatuses") ? updatesAnswer : listAnswer;
    expect(await runContainerAction(call, "h:aaa", "update", SELF)).toEqual({ result: "ok", name: "frigate" });
  });

  it("reports a long update as started and delivers the real end later", async () => {
    let finish: (raw: string) => void = () => {};
    const call = (q: string): Promise<string> => {
      if (q.startsWith("mutation")) return new Promise((resolve) => { finish = resolve; });
      return Promise.resolve(q.includes("containerUpdateStatuses") ? updatesAnswer : listAnswer);
    };
    const out = await runContainerAction(call, "h:aaa", "update", SELF, 20);
    expect(out).toMatchObject({ result: "ok", name: "frigate", detail: "Update läuft noch" });
    expect(out.pending).toBeInstanceOf(Promise);
    finish(JSON.stringify({ errors: [{ message: "pull failed" }] }));
    expect(await out.pending).toEqual({ result: "failed", name: "frigate", detail: "pull failed" });
  });
});
