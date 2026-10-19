import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

const UPLOAD_ROOT = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "uploads",
);

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function resolveSafePath(segments: string[]): string | null {
  const joined = segments.join("/");
  const normalized = path.normalize(joined);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return null;
  }
  const full = path.join(UPLOAD_ROOT, normalized);
  const relative = path.relative(UPLOAD_ROOT, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return full;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  if (!key?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fullPath = resolveSafePath(key);
  if (!fullPath || !existsSync(/* turbopackIgnore: true */ fullPath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = statSync(/* turbopackIgnore: true */ fullPath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const stream = createReadStream(/* turbopackIgnore: true */ fullPath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
