import type { APIRoute } from "astro";
import { minioListAll, minioSet, minioGet, minioDelete, newId } from "../../../lib/minio-db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const items = await minioListAll<Record<string, any>>("altar_servers/");
  items.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0) || (b.created_at || "").localeCompare(a.created_at || ""));
  return new Response(JSON.stringify({ altarServers: items }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, title, organization, description, photo_url, tags } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama pelayan altar wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const id = newId();
    const now = new Date().toISOString();
    const altarServer = { id, name, title: title || "", organization: organization || "", description: description || "", photo_url: photo_url || "", tags: tags || "", is_active: 1, created_at: now, updated_at: now };
    await minioSet(`altar_servers/${id}.json`, altarServer);
    return new Response(JSON.stringify({ altarServer }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST altar-server error:", err);
    return new Response(JSON.stringify({ error: "Gagal menambah pelayan altar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
