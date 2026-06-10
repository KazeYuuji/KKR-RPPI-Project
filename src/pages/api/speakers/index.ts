import type { APIRoute } from "astro";
import { minioListAll, minioSet, newId } from "../../../lib/minio-db";
import { getAdminFromRequest } from "../../../lib/auth";
import { isValidOrigin, sanitizeString, sanitizeUrl, checkRateLimit } from "../../../lib/security";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const items = await minioListAll<Record<string, any>>("speakers/");
    items.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0) || (b.created_at || "").localeCompare(a.created_at || ""));
    return new Response(JSON.stringify({ speakers: items }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("GET speakers error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat data" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("speaker-post:" + (admin?.id || "unknown"), 30, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    const { name, title, organization, description, photo_url, tags, story } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama pembicara wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const id = newId();
    const now = new Date().toISOString();
    const speaker = { id, name: sanitizeString(name, 200), title: sanitizeString(title, 200), organization: sanitizeString(organization, 200), description: sanitizeString(description, 2000), photo_url: sanitizeUrl(photo_url, 500), tags: sanitizeString(tags, 500), story: sanitizeString(story, 5000), is_active: 1, created_at: now, updated_at: now };
    await minioSet(`speakers/${id}.json`, speaker);
    return new Response(JSON.stringify({ speaker }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST speaker error:", err);
    return new Response(JSON.stringify({ error: "Gagal menambah pembicara" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
