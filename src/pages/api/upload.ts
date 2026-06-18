import type { APIRoute } from "astro";
import sharp from "sharp";
import { uploadBuffer } from "../../lib/minio-db";
import { getAdminFromRequest } from "../../lib/auth";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_SIZE, checkRateLimit } from "../../lib/security";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif"]);

const MAGIC_BYTES: Record<string, ((buffer: Uint8Array) => boolean)[]> = {
  "image/jpeg": [(b => b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF)],
  "image/png": [(b => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47)],
  "image/gif": [(b => b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)],
};

function checkMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  const checks = MAGIC_BYTES[mimeType];
  if (!checks) return false;
  return checks.some(fn => fn(buffer));
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("upload-post:" + (admin?.id || "unknown"), 20, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
    if (!isNaN(contentLength) && contentLength > MAX_UPLOAD_SIZE + 1024) {
      return new Response(JSON.stringify({ error: "File terlalu besar. Maksimal 5MB" }), { status: 413, headers: { "Content-Type": "application/json" } });
    }

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
    if (!ALLOWED_EXT.has(ext) && ext !== ".webp") {
      return new Response(JSON.stringify({ error: "Ekstensi file tidak diizinkan" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!checkMagicBytes(new Uint8Array(buffer), file.type)) {
      return new Response(JSON.stringify({ error: "File tidak valid atau rusak" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Auto-remove solid backgrounds from logos
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Sample all four corners to detect background color
    const cs = Math.min(10, Math.floor(info.width / 12), Math.floor(info.height / 12));
    const corners = [
      { x: 0, y: 0 }, { x: info.width - cs, y: 0 },
      { x: 0, y: info.height - cs }, { x: info.width - cs, y: info.height - cs }
    ];
    let bgR = 0, bgG = 0, bgB = 0, count = 0;
    for (const c of corners) {
      for (let y = Math.max(0, c.y); y < Math.min(info.height, c.y + cs); y++) {
        for (let x = Math.max(0, c.x); x < Math.min(info.width, c.x + cs); x++) {
          const idx = (y * info.width + x) * 4;
          bgR += data[idx]; bgG += data[idx+1]; bgB += data[idx+2]; count++;
        }
      }
    }
    bgR /= count; bgG /= count; bgB /= count;
    const tolerance = 55;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - bgR) < tolerance && Math.abs(data[i+1] - bgG) < tolerance && Math.abs(data[i+2] - bgB) < tolerance) {
        data[i+3] = 0;
      }
    }
    const webpBuffer = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
    await uploadBuffer(webpBuffer, filename, "image/webp");

    return new Response(JSON.stringify({ url: `/api/uploads/${filename}` }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("POST upload error:", err?.message || err, err?.stack || "");
    const msg = err?.message?.includes("connect") || err?.message?.includes("ECONN") || err?.message?.includes("ENOTFOUND") || err?.code === "NetworkingError"
      ? "Gagal terhubung ke server penyimpanan. Coba lagi."
      : err?.message?.includes("status 403") || err?.message?.includes("AccessDenied")
        ? "Akses penyimpanan ditolak. Periksa kredensial MinIO."
        : err?.message?.includes("NoSuchBucket")
          ? "Bucket penyimpanan tidak ditemukan."
          : "Gagal upload";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
