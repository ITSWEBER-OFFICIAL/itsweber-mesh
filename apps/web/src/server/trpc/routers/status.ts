import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { getPingResults, pingService } from "../../healthcheck/scheduler";
import { readConfig } from "../../config/store";

export const statusRouter = router({
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
