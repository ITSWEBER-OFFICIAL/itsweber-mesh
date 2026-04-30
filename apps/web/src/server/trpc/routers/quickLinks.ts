import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";

const UpsertQuickLinkSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  url: z.string().min(1),
  iconEmoji: z.string().default("🔗"),
  target: z.enum(["_blank", "_self"]).default("_blank"),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

export const quickLinksRouter = router({
  list: protectedProcedure.query(() => {
    const cfg = readConfig();
    return [...cfg.quickLinks].sort((a, b) => a.sortOrder - b.sortOrder);
  }),

  upsert: adminProcedure
    .input(UpsertQuickLinkSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.quickLinks];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((q) => q.id === id);
      const entry = { ...input, id };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ quickLinks: list });
      return entry;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ quickLinks: cfg.quickLinks.filter((q) => q.id !== input.id) });
    }),

  reorder: adminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.quickLinks.map((q) => {
        const found = input.find((i) => i.id === q.id);
        return found ? { ...q, sortOrder: found.sortOrder } : q;
      });
      await patchConfig({ quickLinks: list });
    }),
});
