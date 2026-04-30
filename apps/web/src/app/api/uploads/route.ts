import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { randomBytes } from "crypto";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = process.env["DATA_DIR"] ?? "/data";
const UPLOADS_DIR = join(DATA_DIR, "uploads");
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

export async function POST(req: NextRequest) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
    }

    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: "Nur Bilder erlaubt (jpg, png, webp, gif, avif)" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 400 });
    }

    await mkdir(UPLOADS_DIR, { recursive: true });

    const name = `${randomBytes(12).toString("hex")}${ext}`;
    await writeFile(join(UPLOADS_DIR, name), Buffer.from(bytes));

    return NextResponse.json({ url: `/api/uploads/${name}` });
  } catch (err) {
    console.error("Upload failed", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}
