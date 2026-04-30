import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { HOME_BOARD_ID } from "../../config/migrations";

const PingTargetSchema = z.object({
  kind: z.enum(["http", "tcp", "none"]),
  url: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().optional(),
  expectStatus: z.array(z.number()).default([200, 204, 301, 302, 401]),
  timeoutMs: z.number().int().default(3000),
});

const UpsertNetworkDeviceSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  sub: z.string().optional(),
  iconEmoji: z.string().default("🌐"),
  url: z.string().optional(),
  healthCheck: PingTargetSchema.default({
    kind: "none",
    expectStatus: [200, 204, 301, 302, 401],
    timeoutMs: 3000,
  }),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

export const networkDevicesRouter = router({
  list: protectedProcedure.query(() => {
    const cfg = readConfig();
    return [...cfg.networkDevices].sort((a, b) => a.sortOrder - b.sortOrder);
  }),

  upsert: adminProcedure
    .input(UpsertNetworkDeviceSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = [...cfg.networkDevices];
      const id = input.id ?? uuidv4();
      const idx = list.findIndex((d) => d.id === id);
      const existing = idx >= 0 ? list[idx] : undefined;
      const entry = {
        ...input, id,
        boardId: existing?.boardId ?? HOME_BOARD_ID,
      };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      await patchConfig({ networkDevices: list });
      return entry;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      await patchConfig({ networkDevices: cfg.networkDevices.filter((d) => d.id !== input.id) });
    }),

  reorder: adminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ input }) => {
      const cfg = readConfig();
      const list = cfg.networkDevices.map((d) => {
        const found = input.find((i) => i.id === d.id);
        return found ? { ...d, sortOrder: found.sortOrder } : d;
      });
      await patchConfig({ networkDevices: list });
    }),
});
