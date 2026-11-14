import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../init";
import { readConfig } from "../../config/store";
import { readAudit, writeAudit } from "../../audit";
import { logger } from "../../logger";
import {
  CONTAINER_OPS,
  VM_OPS,
  callerFor,
  runContainerAction,
  runVmAction,
  type ActionOutcome,
} from "../../unraid/actions";
import { haApi, runHaUpdate } from "../../ha-update";

function instance(id: string) {
  const u = requireLogin().integrations.unraid.find((x) => x.id === id);
  if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Der Server ist nicht mehr eingerichtet" });
  return u;
}

function requireLogin(): ReturnType<typeof readConfig> {
  const cfg = readConfig();
  // Without a login everyone counts as admin. Reading is fine then, switching things is not.
  if (cfg.auth.mode === "open") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Aktionen gehen nur mit eingeschalteter Anmeldung" });
  }
  return cfg;
}

function finish(user: string, action: string, system: string, outcome: ActionOutcome): { name: string; pending: boolean } {
  // A long update reports "started" now and writes its real end to the log later.
  void outcome.pending?.then((end) => {
    writeAudit({ user, action: `${action}.done`, target: end.name, system, result: end.result, ...(end.detail ? { detail: end.detail } : {}) });
    logger.info({ user, action, target: end.name, system, result: end.result }, "action finished");
  });
  writeAudit({ user, action, target: outcome.name, system, result: outcome.result, ...(outcome.detail ? { detail: outcome.detail } : {}) });
  logger.info({ user, action, target: outcome.name, system, result: outcome.result }, "action");
  if (outcome.result === "refused") throw new TRPCError({ code: "PRECONDITION_FAILED", message: outcome.detail ?? "Abgelehnt" });
  if (outcome.result === "failed") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: outcome.detail ?? "Fehlgeschlagen" });
  return { name: outcome.name, pending: Boolean(outcome.pending) };
}

export const actionsRouter = router({
  container: adminProcedure
    .input(z.object({ instanceId: z.string().uuid(), containerId: z.string().min(1).max(200), op: z.enum(CONTAINER_OPS) }))
    .mutation(async ({ input, ctx }) => {
      const u = instance(input.instanceId);
      const outcome = await runContainerAction(callerFor(u), input.containerId, input.op).catch(
        (err): ActionOutcome => ({ result: "failed", name: input.containerId, detail: err instanceof Error ? err.message : "Server nicht erreichbar" }),
      );
      return finish(ctx.user?.name ?? "unbekannt", `container.${input.op}`, u.label, outcome);
    }),

  vm: adminProcedure
    .input(z.object({ instanceId: z.string().uuid(), vmId: z.string().min(1).max(200), op: z.enum(VM_OPS) }))
    .mutation(async ({ input, ctx }) => {
      const u = instance(input.instanceId);
      const outcome = await runVmAction(callerFor(u), input.vmId, input.op).catch(
        (err): ActionOutcome => ({ result: "failed", name: input.vmId, detail: err instanceof Error ? err.message : "Server nicht erreichbar" }),
      );
      return finish(ctx.user?.name ?? "unbekannt", `vm.${input.op}`, u.label, outcome);
    }),

  haUpdate: adminProcedure
    .input(z.object({ entityId: z.string().min(8).max(130) }))
    .mutation(async ({ input, ctx }) => {
      const ha = requireLogin().integrations.homeAssistant;
      if (!ha?.baseUrl || !ha?.token) throw new TRPCError({ code: "NOT_FOUND", message: "Home Assistant ist nicht eingerichtet" });
      const outcome = await runHaUpdate(haApi(ha.baseUrl, ha.token), input.entityId);
      return finish(ctx.user?.name ?? "unbekannt", "ha.update", "Home Assistant", outcome);
    }),

  log: adminProcedure.query(() => readAudit(100)),
});
