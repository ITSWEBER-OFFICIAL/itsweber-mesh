import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { GridLayoutSchema } from "../../config/schema";
import { HOME_BOARD_ID } from "../../config/migrations";

const UpsertCameraSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  snapshotUrl: z.string().min(1),
  linkUrl: z.string().optional(),
  refreshSec: z.number().int().min(2).default(10),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

export const camerasRouter = router({
  list: protectedProcedure.query(() => {
    const cfg = readConfig();
    return [...cfg.cameras].sort((a, b) => a.sortOrder - b.sortOrder);
  }),

  upsert: adminProcedure
    .input(UpsertCameraSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.cameras];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((c) => c.id === id);
      const existing = idx >= 0 ? list[idx] : undefined;
      const entry: (typeof list)[number] = {
        id,
        label: input.label,
        snapshotUrl: input.snapshotUrl,
        refreshSec: input.refreshSec,
        sortOrder: input.sortOrder,
        enabled: input.enabled,
        boardId: existing?.boardId ?? HOME_BOARD_ID,
        gridLayout: existing?.gridLayout ?? { x: 0, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
      };
      if (input.linkUrl) entry.linkUrl = input.linkUrl;
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ cameras: list });
      return entry;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ cameras: cfg.cameras.filter((c) => c.id !== input.id) });
    }),

  reorder: adminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.cameras.map((c) => {
        const found = input.find((i) => i.id === c.id);
        return found ? { ...c, sortOrder: found.sortOrder } : c;
      });
      await patchConfig({ cameras: list });
    }),

  updateLayout: adminProcedure
    .input(z.object({ id: z.string().uuid(), gridLayout: GridLayoutSchema }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.cameras.map((c) =>
        c.id === input.id ? { ...c, gridLayout: input.gridLayout } : c,
      );
      await patchConfig({ cameras: list });
    }),
});
