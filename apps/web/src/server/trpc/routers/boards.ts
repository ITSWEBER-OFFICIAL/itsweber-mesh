import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { BoardSchema } from "../../config/schema";
import { HOME_BOARD_ID } from "../../config/migrations";

const UpsertBoardSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche"),
  name: z.string().min(1),
  icon: z.string().optional(),
  isHome: z.boolean().default(false),
  layout: z.enum(["flat", "sections"]).default("flat"),
  sortOrder: z.number().int().default(0),
});

export const boardsRouter = router({
  list: protectedProcedure.query(() => {
    const cfg = readConfig();
    return [...cfg.boards].sort((a, b) => a.sortOrder - b.sortOrder);
  }),

  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ input }) => {
      const cfg = readConfig();
      return cfg.boards.find((b) => b.slug === input.slug) ?? null;
    }),

  upsert: adminProcedure
    .input(UpsertBoardSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.boards];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((b) => b.id === id);

      // Slug uniqueness check (allow same slug for same id)
      const slugConflict = list.find((b) => b.slug === input.slug && b.id !== id);
      if (slugConflict) {
        throw new TRPCError({ code: "CONFLICT", message: `Slug '${input.slug}' ist bereits vergeben` });
      }

      const board = BoardSchema.parse({ ...input, id });

      // If this board is set as home, unset all others
      let updated = list.map((b) => b.id === id ? board : { ...b, isHome: input.isHome ? false : b.isHome });
      if (idx >= 0) {
        updated = updated;
      } else {
        updated = [...list.filter((b) => b.id !== id), board].map((b) =>
          b.id === id ? board : { ...b, isHome: input.isHome ? false : b.isHome },
        );
      }

      await patchConfig({ boards: updated });
      return board;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();

      if (input.id === HOME_BOARD_ID) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Das Standard-Home-Board kann nicht gelöscht werden" });
      }
      if (cfg.boards.length <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mindestens ein Board muss vorhanden sein" });
      }

      const board = cfg.boards.find((b) => b.id === input.id);
      if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board nicht gefunden" });
      if (board.isHome) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Home-Board kann nicht gelöscht werden. Setze zuerst ein anderes Board als Home." });
      }

      await patchConfig({ boards: cfg.boards.filter((b) => b.id !== input.id) });
    }),

  setHome: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const board = cfg.boards.find((b) => b.id === input.id);
      if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board nicht gefunden" });

      const updated = cfg.boards.map((b) => ({ ...b, isHome: b.id === input.id }));
      await patchConfig({ boards: updated });
      return updated.find((b) => b.id === input.id)!;
    }),

  reorder: adminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const updates = new Map(input.map((i) => [i.id, i.sortOrder]));
      const updated = cfg.boards.map((b) => ({
        ...b,
        sortOrder: updates.has(b.id) ? updates.get(b.id)! : b.sortOrder,
      }));
      await patchConfig({ boards: updated });
    }),
});
