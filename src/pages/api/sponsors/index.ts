import type { APIRoute } from "astro";
import { pgList, pgSet } from "../../../lib/pg-db";
import { newId } from "../../../lib/minio-db";
import { getAdminFromRequest } from "../../../lib/auth";
import { isValidOrigin, sanitizeString, sanitizeUrl, checkRateLimit } from "../../../lib/security";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const items = await pgList<Record<string, any>>("sponsors", "is_active DESC, created_at DESC");
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
    const sponsor = { id, name: sanitizeString(name, 200), website: sanitizeUrl(website, 500), description: sanitizeString(description, 2000), logo_url: sanitizeUrl(logo_url, 500), is_active: 1, created_at: now, updated_at: now };
    await pgSet("sponsors", sponsor);
    return new Response(JSON.stringify({ sponsor }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST sponsor error:", err);
    return new Response(JSON.stringify({ error: "Gagal menambah sponsor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
