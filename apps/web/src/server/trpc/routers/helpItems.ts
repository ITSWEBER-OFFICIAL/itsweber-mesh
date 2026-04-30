import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { defaultConfig } from "../../config/defaults";

const UpsertHelpItemSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1),
  answer: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

export const helpItemsRouter = router({
  list: protectedProcedure.query(() => {
    const cfg = readConfig();
    const items = cfg.helpItems.length > 0 ? cfg.helpItems : defaultConfig.helpItems;
    return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  }),

  upsert: adminProcedure
    .input(UpsertHelpItemSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const base = cfg.helpItems.length > 0 ? cfg.helpItems : defaultConfig.helpItems;
      const list = [...base];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((h) => h.id === id);
      const entry = { ...input, id };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ helpItems: list });
      return entry;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const base = cfg.helpItems.length > 0 ? cfg.helpItems : defaultConfig.helpItems;
      await patchConfig({ helpItems: base.filter((h) => h.id !== input.id) });
    }),

  reorder: adminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const base = cfg.helpItems.length > 0 ? cfg.helpItems : defaultConfig.helpItems;
      const list = base.map((h) => {
        const found = input.find((i) => i.id === h.id);
        return found ? { ...h, sortOrder: found.sortOrder } : h;
      });
      await patchConfig({ helpItems: list });
    }),
});
