import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export const GET: APIRoute = async ({ params }) => {
  const filePath = params.path as string;
  if (!filePath || filePath.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const fullPath = path.join(UPLOADS_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
  const buffer = fs.readFileSync(fullPath);
  return new Response(buffer, {
    status: 200,
    headers: { "Content-Type": mime[ext] || "application/octet-stream", "Cache-Control": "public, max-age=31536000" },
  });
};
