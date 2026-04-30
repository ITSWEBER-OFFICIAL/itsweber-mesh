import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { InfraNodeKindSchema, GridLayoutSchema } from "../../config/schema";
import { HOME_BOARD_ID } from "../../config/migrations";

const UpsertInfraNodeSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  kind: InfraNodeKindSchema.default("unraid"),
  ip: z.string().optional(),
  linkUrl: z.string().optional(),
  versionOverride: z.string().optional(),
  primary: z.boolean().default(false),
  badge: z.string().default("PRIMARY"),
  chips: z.array(z.string()).default([]),
  iconEmoji: z.string().default("⚡"),
  integrationRef: z
    .object({ kind: z.literal("unraid"), id: z.string().uuid() })
    .nullable()
    .default(null),
  glancesRef: z
    .object({ kind: z.literal("glances"), id: z.string().uuid() })
    .nullable()
    .default(null),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

export const infraNodesRouter = router({
  list: protectedProcedure.query(() => {
    const cfg = readConfig();
    return [...cfg.infraNodes].sort((a, b) => a.sortOrder - b.sortOrder);
  }),

  upsert: adminProcedure
    .input(UpsertInfraNodeSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.infraNodes];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((n) => n.id === id);
      const existing = idx >= 0 ? list[idx] : undefined;
      const entry = {
        ...input, id,
        boardId: existing?.boardId ?? HOME_BOARD_ID,
        gridLayout: existing?.gridLayout ?? { x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 },
      };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ infraNodes: list });
      return entry;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ infraNodes: cfg.infraNodes.filter((n) => n.id !== input.id) });
    }),

  reorder: adminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.infraNodes.map((n) => {
        const found = input.find((i) => i.id === n.id);
        return found ? { ...n, sortOrder: found.sortOrder } : n;
      });
      await patchConfig({ infraNodes: list });
    }),

  updateLayout: adminProcedure
    .input(z.object({ id: z.string().uuid(), gridLayout: GridLayoutSchema }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.infraNodes.map((n) =>
        n.id === input.id ? { ...n, gridLayout: input.gridLayout } : n,
      );
      await patchConfig({ infraNodes: list });
    }),
});
