import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { UserPasswordStrategy } from "../../auth";
import type { AuthUser } from "../../config/schema";

const CreateUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
  email: z.string().email().optional(),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});

const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1).max(64).optional(),
  password: z.string().min(8).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
});

/** Strip passwordHash before sending to client */
function sanitize(user: AuthUser) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export const usersRouter = router({
  list: adminProcedure.query(() => {
    const cfg = readConfig();
    return cfg.auth.users.map(sanitize);
  }),

  create: adminProcedure
    .input(CreateUserSchema)
    .mutation(async ({ input }) => {
      const cfg = readConfig();

      const usernameConflict = cfg.auth.users.find((u) => u.username === input.username);
      if (usernameConflict) {
        throw new TRPCError({ code: "CONFLICT", message: `Benutzername '${input.username}' ist bereits vergeben` });
      }

      const passwordHash = await UserPasswordStrategy.hashPassword(input.password);
      const user: AuthUser = {
        id: uuidv4(),
        username: input.username,
        passwordHash,
        role: input.role,
        createdAt: new Date().toISOString(),
        ...(input.email !== undefined ? { email: input.email } : {}),
      };

      await patchConfig({ auth: { ...cfg.auth, users: [...cfg.auth.users, user] } });
      return sanitize(user);
    }),

  update: adminProcedure
    .input(UpdateUserSchema)
    .mutation(async ({ input, ctx }) => {
      const cfg = readConfig();
      const idx = cfg.auth.users.findIndex((u) => u.id === input.id);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Benutzer nicht gefunden" });

      const current = cfg.auth.users[idx]!;

      // Self-lockout protection: admin cannot demote themselves to viewer/editor
      if (ctx.user?.id === current.id && input.role && input.role !== "admin" && current.role === "admin") {
        const otherAdmins = cfg.auth.users.filter((u) => u.id !== current.id && u.role === "admin");
        if (otherAdmins.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Du kannst dich nicht selbst degradieren — du bist der letzte Admin",
          });
        }
      }

      // Username uniqueness check
      if (input.username && input.username !== current.username) {
        const conflict = cfg.auth.users.find((u) => u.username === input.username && u.id !== input.id);
        if (conflict) {
          throw new TRPCError({ code: "CONFLICT", message: `Benutzername '${input.username}' ist bereits vergeben` });
        }
      }

      const passwordHash = input.password
        ? await UserPasswordStrategy.hashPassword(input.password)
        : current.passwordHash;

      const emailPatch = input.email !== undefined ? { email: input.email } : {};
      const updated: AuthUser = {
        ...current,
        ...emailPatch,
        username: input.username ?? current.username,
        passwordHash,
        role: input.role ?? current.role,
      };

      const users = [...cfg.auth.users];
      users[idx] = updated;
      await patchConfig({ auth: { ...cfg.auth, users } });
      return sanitize(updated);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const cfg = readConfig();
      const user = cfg.auth.users.find((u) => u.id === input.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Benutzer nicht gefunden" });

      // Self-delete protection
      if (ctx.user?.id === user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Du kannst dich nicht selbst löschen" });
      }

      // Last admin protection
      if (user.role === "admin") {
        const otherAdmins = cfg.auth.users.filter((u) => u.id !== input.id && u.role === "admin");
        if (otherAdmins.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Der letzte Admin-Benutzer kann nicht gelöscht werden",
          });
        }
      }

      await patchConfig({ auth: { ...cfg.auth, users: cfg.auth.users.filter((u) => u.id !== input.id) } });
    }),
});
