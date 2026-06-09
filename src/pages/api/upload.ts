import type { APIRoute } from "astro";
import { uploadBuffer } from "../../lib/minio-db";
import { getAdminFromRequest } from "../../lib/auth";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_SIZE, isValidOrigin, checkRateLimit } from "../../lib/security";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/jpeg": [new Uint8Array([0xFF, 0xD8, 0xFF])],
  "image/png": [new Uint8Array([0x89, 0x50, 0x4E, 0x47])],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  "image/gif": [new Uint8Array([0x47, 0x49, 0x46, 0x38])],
};

function checkMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  return signatures.some(sig => {
    if (buffer.length < sig.length) return false;
    return sig.every((b, i) => buffer[i] === b);
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("upload-post:" + (admin?.id || "unknown"), 20, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Tidak ada file" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return new Response(JSON.stringify({ error: "Tipe file tidak diizinkan. Gunakan JPG, PNG, WebP, atau GIF" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return new Response(JSON.stringify({ error: "File terlalu besar. Maksimal 5MB" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase() : ".png";
    if (!ALLOWED_EXT.has(ext)) {
      return new Response(JSON.stringify({ error: "Ekstensi file tidak diizinkan" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!checkMagicBytes(new Uint8Array(buffer), file.type)) {
      return new Response(JSON.stringify({ error: "File tidak valid atau rusak" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    await uploadBuffer(buffer, filename, file.type);

    return new Response(JSON.stringify({ url: `/api/uploads/${filename}` }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST upload error:", err);
    return new Response(JSON.stringify({ error: "Gagal upload" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
