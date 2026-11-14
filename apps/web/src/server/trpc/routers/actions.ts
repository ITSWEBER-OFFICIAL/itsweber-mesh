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

function instance(id: string) {
  const u = readConfig().integrations.unraid.find((x) => x.id === id);
  if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Der Server ist nicht mehr eingerichtet" });
  return u;
}

function finish(user: string, action: string, system: string, outcome: ActionOutcome): { name: string } {
  writeAudit({ user, action, target: outcome.name, system, result: outcome.result, ...(outcome.detail ? { detail: outcome.detail } : {}) });
  logger.info({ user, action, target: outcome.name, system, result: outcome.result }, "action");
  if (outcome.result === "refused") throw new TRPCError({ code: "PRECONDITION_FAILED", message: outcome.detail ?? "Abgelehnt" });
  if (outcome.result === "failed") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: outcome.detail ?? "Fehlgeschlagen" });
  return { name: outcome.name };
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

  log: adminProcedure.query(() => readAudit(100)),
});
