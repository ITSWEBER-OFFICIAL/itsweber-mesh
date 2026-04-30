import { type NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/widgets/cameras/snapshot?id=<cameraId>
 * Proxied server-side fetch des Kamera-Snapshots — löst CORS/Auth-Probleme im Browser.
 */
export async function GET(req: NextRequest) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return new NextResponse("Missing id", { status: 400 });
  }

  const cfg = readConfig();
  const camera = cfg.cameras.find((c) => c.id === id && c.enabled);
  if (!camera) {
    return new NextResponse("Camera not found", { status: 404 });
  }

  try {
    const res = await fetch(camera.snapshotUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/*" },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    return new NextResponse(msg, { status: 502 });
  }
}
