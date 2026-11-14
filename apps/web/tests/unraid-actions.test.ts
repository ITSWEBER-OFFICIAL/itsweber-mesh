import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkContainerAction,
  checkVmAction,
  containerMutation,
  vmMutation,
  isSafeId,
  runContainerAction,
  runVmAction,
} from "@/server/unraid/actions";
import { readAudit, writeAudit } from "@/server/audit";

const containers = [
  { id: "h:aaa", name: "frigate", running: true, state: "RUNNING", status: "Up", autoStart: true, updateAvailable: false },
  { id: "h:bbb", name: "tdarr", running: false, state: "EXITED", status: "Exited", autoStart: false, updateAvailable: false },
  { id: "h:ccc", name: "ITSWEBER-Mesh", running: true, state: "RUNNING", status: "Up", autoStart: true, updateAvailable: false },
];
const SELF = ["itsweber-mesh"];

describe("action rules", () => {
  it("accepts only ids that are plain Unraid ids", () => {
    expect(isSafeId("e5278ff1:a590d4da18b9")).toBe(true);
    expect(isSafeId("e5:WDC_WD60-00SF.3")).toBe(true);
    expect(isSafeId('x") { id } } mutation { docker { removeContainer(id: "y')).toBe(false);
    expect(isSafeId("")).toBe(false);
    expect(isSafeId("a b")).toBe(false);
  });

  it("refuses ids that are not in the server's list", () => {
    expect(checkContainerAction(containers, "h:zzz", "restart", SELF)).toMatchObject({ ok: false });
  });

  it("refuses to stop or restart Mesh itself", () => {
    expect(checkContainerAction(containers, "h:ccc", "stop", SELF)).toEqual({ ok: false, reason: "Mesh stoppt sich nicht selbst" });
    expect(checkContainerAction(containers, "h:ccc", "restart", SELF)).toMatchObject({ ok: false });
  });

  it("refuses actions that do not fit the current state", () => {
    expect(checkContainerAction(containers, "h:aaa", "start", SELF)).toMatchObject({ ok: false });
    expect(checkContainerAction(containers, "h:bbb", "stop", SELF)).toMatchObject({ ok: false });
    expect(checkContainerAction(containers, "h:bbb", "start", SELF)).toEqual({ ok: true, name: "tdarr" });
    expect(checkContainerAction(containers, "h:aaa", "restart", SELF)).toEqual({ ok: true, name: "frigate" });
  });

  it("applies the same rules to VMs", () => {
    const vms = [{ id: "v:1", name: "Windows", state: "SHUTOFF", running: false }];
    expect(checkVmAction(vms, "v:1", "start")).toEqual({ ok: true, name: "Windows" });
    expect(checkVmAction(vms, "v:1", "stop")).toMatchObject({ ok: false });
    expect(checkVmAction(vms, "v:2", "start")).toMatchObject({ ok: false });
  });

  it("builds only the allowed mutations", () => {
    expect(containerMutation("h:aaa", "restart")).toBe('mutation { docker { restart(id: "h:aaa") { id state } } }');
    expect(vmMutation("v:1", "stop")).toBe('mutation { vm { stop(id: "v:1") } }');
    expect(() => containerMutation('h"', "stop")).toThrow();
    // @ts-expect-error removeContainer is not an allowed operation
    expect(() => containerMutation("h:aaa", "removeContainer")).toThrow();
  });
});

describe("action run against a fake server", () => {
  const listAnswer = JSON.stringify({
    data: { docker: { containers: containers.map((c) => ({ id: c.id, names: [`/${c.name}`], state: c.state, status: c.status, autoStart: c.autoStart })) } },
  });

  it("sends exactly one mutation after reading the list", async () => {
    const sent: string[] = [];
    const call = async (q: string) => {
      sent.push(q);
      return q.startsWith("mutation") ? JSON.stringify({ data: { docker: { restart: { id: "h:aaa", state: "RUNNING" } } } }) : listAnswer;
    };
    const out = await runContainerAction(call, "h:aaa", "restart", SELF);
    expect(out).toEqual({ result: "ok", name: "frigate" });
    expect(sent.filter((q) => q.startsWith("mutation"))).toEqual(['mutation { docker { restart(id: "h:aaa") { id state } } }']);
  });

  it("sends no mutation when the action is refused", async () => {
    const sent: string[] = [];
    const call = async (q: string) => {
      sent.push(q);
      return listAnswer;
    };
    const out = await runContainerAction(call, "h:ccc", "stop", SELF);
    expect(out.result).toBe("refused");
    expect(sent.some((q) => q.startsWith("mutation"))).toBe(false);
  });

  it("reports an error answer of the server as failed", async () => {
    const call = async (q: string) => (q.startsWith("mutation") ? JSON.stringify({ errors: [{ message: "Forbidden" }] }) : listAnswer);
    expect(await runContainerAction(call, "h:bbb", "start", SELF)).toEqual({ result: "failed", name: "tdarr", detail: "Forbidden" });
  });

  it("does not act when the VM list cannot be read", async () => {
    const sent: string[] = [];
    const call = async (q: string) => {
      sent.push(q);
      return JSON.stringify({ errors: [{ message: "VMs disabled" }] });
    };
    expect((await runVmAction(call, "v:1", "start")).result).toBe("failed");
    expect(sent).toHaveLength(1);
  });
});

describe("audit log", () => {
  beforeEach(() => {
    process.env["DATA_DIR"] = fs.mkdtempSync(path.join(os.tmpdir(), "mesh-audit-"));
  });

  it("returns entries newest first and survives a broken line", () => {
    writeAudit({ user: "a", action: "container.stop", target: "x", system: "Core", result: "ok" }, new Date("2026-11-14T10:00:00Z"));
    fs.appendFileSync(path.join(process.env["DATA_DIR"] as string, "audit.log"), "kaputt\n");
    writeAudit({ user: "a", action: "container.start", target: "x", system: "Core", result: "refused", detail: "läuft bereits" }, new Date("2026-11-14T11:00:00Z"));
    const log = readAudit();
    expect(log.map((e) => e.action)).toEqual(["container.start", "container.stop"]);
    expect(log[0]?.detail).toBe("läuft bereits");
  });

  it("is empty without a file", () => {
    expect(readAudit()).toEqual([]);
  });
});
