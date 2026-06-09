import type { APIRoute } from "astro";
import { downloadFromMinIO } from "../../../lib/minio-db";
import path from "node:path";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export const GET: APIRoute = async ({ params }) => {
  const filePath = params.path as string;
  if (!filePath || filePath.includes("..") || filePath.includes("~") || filePath.startsWith("/")) {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const result = await downloadFromMinIO(`uploads/${filePath}`);
    if (!result) {
      return new Response("Not found", { status: 404 });
    }
    const contentType = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    }[ext] || "application/octet-stream";
    return new Response(result.buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
