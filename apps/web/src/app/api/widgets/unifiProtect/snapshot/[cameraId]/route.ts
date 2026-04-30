import { NextResponse } from "next/server";
import { Agent as HttpsAgent } from "node:https";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cameraId: string }> },
) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const { cameraId } = await params;
  const cfg = readConfig();
  const p = cfg.integrations.unifiProtect;

  if (!p?.enabled || !p?.baseUrl || !p?.apiKey) {
    return new NextResponse("Not configured", { status: 503 });
  }

  const { baseUrl, apiKey, verifyTls = false } = p;
  const u = new URL(`/proxy/protect/integration/v1/cameras/${cameraId}/snapshot`, baseUrl);
  const isHttps = u.protocol === "https:";
  const reqFn = isHttps ? httpsRequest : httpRequest;
  const httpsOpts = isHttps ? { agent: new HttpsAgent({ rejectUnauthorized: verifyTls }) } : {};

  return new Promise<NextResponse>((resolve) => {
    const req = reqFn(
      u,
      { method: "GET", headers: { "X-API-Key": apiKey, Accept: "image/jpeg" }, ...httpsOpts },
      (res) => {
        if ((res.statusCode ?? 0) >= 400) {
          resolve(new NextResponse("Upstream error", { status: res.statusCode ?? 502 }));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve(new NextResponse(body, {
            status: 200,
            headers: {
              "Content-Type": res.headers["content-type"] ?? "image/jpeg",
              "Cache-Control": "no-store",
            },
          }));
        });
      },
    );
    req.setTimeout(10000, () => { req.destroy(); resolve(new NextResponse("Timeout", { status: 504 })); });
    req.on("error", () => resolve(new NextResponse("Error", { status: 502 })));
    req.end();
  });
}
