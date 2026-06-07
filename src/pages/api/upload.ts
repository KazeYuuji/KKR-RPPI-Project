import type { APIRoute } from "astro";
import { uploadBuffer } from "../../lib/minio";

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Tidak ada file" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : ".png";
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    await uploadBuffer(buffer, filename, contentType);
    return new Response(JSON.stringify({ url: `/api/uploads/${filename}` }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST upload error:", err);
    return new Response(JSON.stringify({ error: "Gagal upload" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
