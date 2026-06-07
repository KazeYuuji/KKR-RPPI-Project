import type { APIRoute } from "astro";
import { minioListAll, minioSet, minioGet, minioDelete, newId } from "../../../lib/minio-db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const items = await minioListAll<Record<string, any>>("sponsors/");
  items.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0) || (b.created_at || "").localeCompare(a.created_at || ""));
  return new Response(JSON.stringify({ sponsors: items }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, website, description, logo_url } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama sponsor wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const id = newId();
    const now = new Date().toISOString();
    const sponsor = { id, name, website: website || "", description: description || "", logo_url: logo_url || "", is_active: 1, created_at: now, updated_at: now };
    await minioSet(`sponsors/${id}.json`, sponsor);
    return new Response(JSON.stringify({ sponsor }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST sponsor error:", err);
    return new Response(JSON.stringify({ error: "Gagal menambah sponsor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
