import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";
import { loadGameserverStatus } from "@/server/gameserver";

export type { GameserverStatus, GameServer } from "@/server/gameserver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;
  const status = await loadGameserverStatus(readConfig().integrations.gameserver.statusUrl);
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
