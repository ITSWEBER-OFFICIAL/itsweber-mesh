import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { SearchEngineSchema } from "../../config/schema";

const UpsertEngineSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(64),
  urlTemplate: z.string().min(1).includes("{q}", { message: "URL muss {q} als Platzhalter enthalten" }),
  icon: z.string().optional(),
  hotkey: z.string().max(8).optional(),
});

export const searchRouter = router({
  getConfig: protectedProcedure.query(() => {
    const cfg = readConfig();
    return cfg.search;
  }),

  upsertEngine: adminProcedure
    .input(UpsertEngineSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const engines = [...cfg.search.engines];
      const id = input.id ?? uuidv4();
      const idx = engines.findIndex((e) => e.id === id);

      const engine = SearchEngineSchema.parse({ ...input, id });
      if (idx >= 0) {
        engines[idx] = engine;
      } else {
        engines.push(engine);
      }
      await patchConfig({ search: { ...cfg.search, engines } });
      return engine;
    }),

  deleteEngine: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const engine = cfg.search.engines.find((e) => e.id === input.id);
      if (!engine) throw new TRPCError({ code: "NOT_FOUND", message: "Suchmaschine nicht gefunden" });
      if (cfg.search.defaultEngineId === input.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Standard-Suchmaschine kann nicht gelöscht werden. Ändere zuerst die Standard-Suchmaschine." });
      }
      const engines = cfg.search.engines.filter((e) => e.id !== input.id);
      await patchConfig({ search: { ...cfg.search, engines } });
    }),

  setDefault: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      if (!cfg.search.engines.find((e) => e.id === input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Suchmaschine nicht gefunden" });
      }
      await patchConfig({ search: { ...cfg.search, defaultEngineId: input.id } });
    }),

  updateSettings: adminProcedure
    .input(z.object({ localFirst: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const search = { ...cfg.search };
      if (input.localFirst !== undefined) search.localFirst = input.localFirst;
      await patchConfig({ search });
      return search;
    }),
});
