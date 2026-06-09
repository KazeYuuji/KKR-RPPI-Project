import type { APIRoute } from "astro";
import { minioListAll, minioSet, newId } from "../../../lib/minio-db";
import { getAdminFromRequest } from "../../../lib/auth";
import { isValidOrigin, sanitizeString, checkRateLimit } from "../../../lib/security";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const items = await minioListAll<Record<string, any>>("altar_servers/");
    items.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0) || (b.created_at || "").localeCompare(a.created_at || ""));
    return new Response(JSON.stringify({ altarServers: items }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("GET altar-servers error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat data" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("altar-post:" + (admin?.id || "unknown"), 30, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    const { name, title, organization, description, photo_url, tags } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama pelayan altar wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const id = newId();
    const now = new Date().toISOString();
    const altarServer = { id, name: sanitizeString(name, 200), title: sanitizeString(title, 200), organization: sanitizeString(organization, 200), description: sanitizeString(description, 2000), photo_url: sanitizeString(photo_url, 500), tags: sanitizeString(tags, 500), is_active: 1, created_at: now, updated_at: now };
    await minioSet(`altar_servers/${id}.json`, altarServer);
    return new Response(JSON.stringify({ altarServer }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST altar-server error:", err);
    return new Response(JSON.stringify({ error: "Gagal menambah pelayan altar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
