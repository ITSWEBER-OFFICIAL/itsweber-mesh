import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";
import { loadUnraidInstances, type UnraidWidgetData } from "@/server/unraid/load";

export type { UnraidArrayCapacity, UnraidInstanceData, UnraidWidgetData } from "@/server/unraid/load";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const { unraid } = readConfig().integrations;
  if (!unraid || unraid.length === 0) {
    return NextResponse.json({ instances: [] } satisfies UnraidWidgetData);
  }

  const idsParam = new URL(req.url).searchParams.get("ids");
  const filterIds = idsParam ? new Set(idsParam.split(",").filter(Boolean)) : null;
  const filtered = filterIds ? unraid.filter((u) => filterIds.has(u.id)) : unraid;

  const instances = await loadUnraidInstances(filtered);
  return NextResponse.json({ instances } satisfies UnraidWidgetData);
}
