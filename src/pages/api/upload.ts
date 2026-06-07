import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

const UPLOADS_DIR = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), "data", "uploads");

export const POST: APIRoute = async ({ request }) => {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Tidak ada file" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const ext = path.extname(file.name) || ".png";
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    return new Response(JSON.stringify({ url: `/api/uploads/${filename}` }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST upload error:", err);
    return new Response(JSON.stringify({ error: "Gagal upload" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
