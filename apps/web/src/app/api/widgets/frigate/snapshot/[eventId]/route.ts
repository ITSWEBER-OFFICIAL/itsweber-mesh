import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const { eventId } = await params;
  const cfg = readConfig();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const instances = cfg.integrations.frigate;
  const f = id ? instances.find((i) => i.id === id) : instances[0];

  if (!f?.baseUrl) {
    return new NextResponse("Not configured", { status: 503 });
  }

  const baseUrl = f.baseUrl.replace(/\/$/, "");

  try {
    const upstream = await fetch(`${baseUrl}/api/events/${eventId}/snapshot.jpg`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return new NextResponse("Upstream error", { status: upstream.status });

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 502 });
  }
}
