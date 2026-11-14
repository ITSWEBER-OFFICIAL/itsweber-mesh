import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { getPingResults, pingService } from "../../healthcheck/scheduler";
import { readConfig } from "../../config/store";
import { isInternalUrl } from "../../config/migrations";

/** Client address as seen by the reverse proxy. No proxy header means direct access from the LAN. */
export function clientIsInternal(headers: Headers | undefined): boolean {
  const ip = headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || headers?.get("x-real-ip")?.trim() || "";
  if (!ip) return true;
  const host = ip.includes(":") && !ip.includes(".") ? "[" + ip + "]" : ip.replace(/^::ffff:/i, "");
  return isInternalUrl("http://" + host) === true;
}

export const statusRouter = router({
  /** v18: decides whether internal or external addresses are offered. Display only, never a security decision. */
  network: protectedProcedure.query(({ ctx }) => ({ internal: clientIsInternal(ctx.req?.headers) })),

  all: protectedProcedure.query(() => {
    return getPingResults();
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) => {
      const results = getPingResults();
      return results[input.id] ?? null;
    }),

  ping: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const config = readConfig();
      const service = config.services.find((s) => s.id === input.id);
      if (!service) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Service ${input.id} nicht gefunden` });
      }
      return await pingService(service);
    }),
});
