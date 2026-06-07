import type { APIRoute } from "astro";
import { uploadBuffer } from "../../lib/minio-db";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_SIZE } from "../../lib/security";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Tidak ada file" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return new Response(JSON.stringify({ error: "Tipe file tidak diizinkan. Gunakan JPG, PNG, WebP, GIF, atau SVG" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return new Response(JSON.stringify({ error: "File terlalu besar. Maksimal 5MB" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase() : ".png";
    if (!ALLOWED_EXT.has(ext)) {
      return new Response(JSON.stringify({ error: "Ekstensi file tidak diizinkan" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadBuffer(buffer, filename, file.type);

    return new Response(JSON.stringify({ url: `/api/uploads/${filename}` }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST upload error:", err);
    return new Response(JSON.stringify({ error: "Gagal upload" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
