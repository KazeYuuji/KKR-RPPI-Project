import type { APIRoute } from "astro";
import { minioListAll, minioSet, newId } from "../../../lib/minio-db";
import { getAdminFromRequest } from "../../../lib/auth";
import { isValidOrigin, sanitizeString, checkRateLimit } from "../../../lib/security";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const items = await minioListAll<Record<string, any>>("sponsors/");
    items.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0) || (b.created_at || "").localeCompare(a.created_at || ""));
    return new Response(JSON.stringify({ sponsors: items }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("GET sponsors error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat data" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("sponsor-post:" + (admin?.id || "unknown"), 30, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    const { name, website, description, logo_url } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama sponsor wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const id = newId();
    const now = new Date().toISOString();
    const sponsor = { id, name: sanitizeString(name, 200), website: sanitizeString(website, 500), description: sanitizeString(description, 2000), logo_url: sanitizeString(logo_url, 500), is_active: 1, created_at: now, updated_at: now };
    await minioSet(`sponsors/${id}.json`, sponsor);
    return new Response(JSON.stringify({ sponsor }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST sponsor error:", err);
    return new Response(JSON.stringify({ error: "Gagal menambah sponsor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
