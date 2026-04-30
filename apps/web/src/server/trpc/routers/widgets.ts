import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { WidgetKindSchema, GridLayoutSchema } from "../../config/schema";
import { HOME_BOARD_ID } from "../../config/migrations";

const UpsertWidgetSchema = z.object({
  id: z.string().uuid().optional(),
  kind: WidgetKindSchema,
  label: z.string().min(1),
  enabled: z.boolean().default(true),
  refreshSec: z.number().int().min(5).default(30),
  sortOrder: z.number().int().default(0),
  settings: z.record(z.unknown()).default({}),
  linkUrl: z.string().optional(),
  gridLayout: GridLayoutSchema.optional(),
  /** Optional target board for new widgets. Existing widgets keep their boardId. */
  boardId: z.string().min(1).optional(),
});

const ReorderItemSchema = z.object({
  id: z.string().uuid(),
  sortOrder: z.number().int(),
});

export const widgetsRouter = router({
  list: protectedProcedure.query(() => {
    const cfg = readConfig();
    return [...cfg.widgetInstances].sort((a, b) => a.sortOrder - b.sortOrder);
  }),

  upsert: adminProcedure
    .input(UpsertWidgetSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.widgetInstances];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((w) => w.id === id);
      const existing = idx >= 0 ? list[idx] : undefined;
      const entry: (typeof list)[number] = {
        id,
        kind: input.kind,
        label: input.label,
        enabled: input.enabled,
        refreshSec: input.refreshSec,
        sortOrder: input.sortOrder,
        settings: input.settings,
        // Existing widgets keep their boardId; new widgets honour the
        // explicit `boardId` from the caller (edit-mode "+Widget" passes the
        // currently visible board), falling back to HOME_BOARD_ID.
        boardId: existing?.boardId ?? input.boardId ?? HOME_BOARD_ID,
        gridLayout: existing?.gridLayout ?? input.gridLayout ?? { x: 9, y: input.sortOrder * 6, w: 3, h: 6, minW: 2, minH: 3 },
      };
      if (input.linkUrl) entry.linkUrl = input.linkUrl;
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ widgetInstances: list });
      return entry;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const found = cfg.widgetInstances.some((w) => w.id === input.id);
      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Widget nicht gefunden" });
      }
      await patchConfig({ widgetInstances: cfg.widgetInstances.filter((w) => w.id !== input.id) });
    }),

  reorder: adminProcedure
    .input(z.array(ReorderItemSchema))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const updates = new Map(input.map((i) => [i.id, i]));
      const list = cfg.widgetInstances.map((w) => {
        const update = updates.get(w.id);
        if (!update) return w;
        return { ...w, sortOrder: update.sortOrder };
      });
      await patchConfig({ widgetInstances: list });
    }),

  updateLayout: adminProcedure
    .input(z.object({ id: z.string().uuid(), gridLayout: GridLayoutSchema }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.widgetInstances.map((w) =>
        w.id === input.id ? { ...w, gridLayout: input.gridLayout } : w,
      );
      await patchConfig({ widgetInstances: list });
    }),

  /**
   * Bulk variant for the edit-mode save. Sending many `updateLayout` calls in
   * parallel can collide on `proper-lockfile` retries (each call does
   * read → mutate → write under a lockfile) and the later writes can also
   * clobber concurrent edits. One round-trip writes them all atomically.
   */
  updateLayouts: adminProcedure
    .input(
      z.array(z.object({ id: z.string().uuid(), gridLayout: GridLayoutSchema })),
    )
    .mutation(async ({ input }) => {
      if (input.length === 0) return;
      const cfg = readConfig();
      const next = new Map(input.map((i) => [i.id, i.gridLayout] as const));
      const list = cfg.widgetInstances.map((w) => {
        const layout = next.get(w.id);
        return layout ? { ...w, gridLayout: layout } : w;
      });
      await patchConfig({ widgetInstances: list });
    }),
});
