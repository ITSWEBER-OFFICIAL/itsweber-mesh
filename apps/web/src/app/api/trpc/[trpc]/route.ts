import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/root";
import type { TRPCContext } from "@/server/trpc/init";
import { parseCookies } from "@/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function createContext(req: Request): TRPCContext {
  return {
    req,
    cookies: parseCookies(req.headers.get("cookie")),
  };
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
  });

export { handler as GET, handler as POST };
