import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { router, protectedProcedure, adminProcedure } from "../init";
import { readConfig, writeConfig } from "../../config/store";
import { ServiceSchema, GridLayoutSchema } from "../../config/schema";

const ServiceUpsertSchema = ServiceSchema.omit({ id: true }).partial().extend({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  url: z.string().url(),
  category: ServiceSchema.shape.category,
  pingTarget: ServiceSchema.shape.pingTarget,
});

export const servicesRouter = router({
  list: protectedProcedure.query(() => {
    const config = readConfig();
    return config.services.sort((a, b) => a.sortOrder - b.sortOrder);
  }),

  upsert: adminProcedure
    .input(ServiceUpsertSchema)
    .mutation(async ({ input }) => {
      const config = readConfig();
      const id = input.id ?? uuidv4();
      const existing = config.services.findIndex((s) => s.id === id);
      const existingService = existing >= 0 ? config.services[existing] : undefined;

      const service = ServiceSchema.parse({
        id,
        name: input.name,
        description: input.description,
        url: input.url,
        category: input.category,
        icon: input.icon ?? "globe",
        color: input.color,
        pingTarget: input.pingTarget,
        sortOrder: input.sortOrder ?? config.services.length * 10,
        enabled: input.enabled ?? true,
        boardId: input.boardId ?? existingService?.boardId,
        gridLayout: input.gridLayout ?? existingService?.gridLayout,
        pinnedToHome: input.pinnedToHome ?? existingService?.pinnedToHome ?? false,
      });

      if (existing >= 0) {
        config.services[existing] = service;
      } else {
        config.services.push(service);
      }

      await writeConfig(config);
      return service;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const config = readConfig();
      config.services = config.services.filter((s) => s.id !== input.id);
      await writeConfig(config);
    }),

  reorder: adminProcedure
    .input(z.array(z.string().uuid()))
    .mutation(async ({ input }) => {
      const config = readConfig();
      input.forEach((id, index) => {
        const svc = config.services.find((s) => s.id === id);
        if (svc) svc.sortOrder = index * 10;
      });
      await writeConfig(config);
    }),

  updateLayout: adminProcedure
    .input(z.object({ id: z.string().uuid(), gridLayout: GridLayoutSchema }))
    .mutation(async ({ input }) => {
      const config = readConfig();
      const svc = config.services.find((s) => s.id === input.id);
      if (svc) svc.gridLayout = input.gridLayout;
      await writeConfig(config);
    }),
});
