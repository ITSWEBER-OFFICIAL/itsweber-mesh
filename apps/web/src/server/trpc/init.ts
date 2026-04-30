import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { readConfig } from "../config/store";
import { getStrategy, type AuthUser } from "../auth";

export type TRPCContext = {
  /** Parsed cookies from the incoming request */
  cookies: Map<string, string>;
  /** Optional fetch Request object (only for fetch adapter) */
  req?: Request;
  /** Resolved at middleware time when admin procedures are called */
  user?: AuthUser;
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

/** Any authenticated user — passes for open mode, requires a valid session in all other modes. */
const authedMiddleware = t.middleware(async ({ ctx, next }) => {
  const config = readConfig();
  const strategy = getStrategy(config.auth);
  const result = await strategy.verify(ctx.req, ctx.cookies);
  if (!result.ok) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: result.reason });
  }
  return next({ ctx: { ...ctx, user: result.user } });
});

/** Admin-only — requires a valid session AND role === "admin". Open mode always passes (role is "admin"). */
const adminOnlyMiddleware = t.middleware(async ({ ctx, next }) => {
  const config = readConfig();
  const strategy = getStrategy(config.auth);
  const result = await strategy.verify(ctx.req, ctx.cookies);
  if (!result.ok) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: result.reason });
  }
  if (result.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin-Berechtigung erforderlich" });
  }
  return next({ ctx: { ...ctx, user: result.user } });
});

export const router = t.router;
export const publicProcedure = t.procedure;
/** Any authenticated user may call this procedure. */
export const protectedProcedure = t.procedure.use(authedMiddleware);
/** Only admin role may call this procedure. */
export const adminProcedure = t.procedure.use(adminOnlyMiddleware);
