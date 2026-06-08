import type { APIRoute } from "astro";
import { minioListAll, minioSet, newId } from "../../../lib/minio-db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const items = await minioListAll<Record<string, any>>("speakers/");
  items.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0) || (b.created_at || "").localeCompare(a.created_at || ""));
  return new Response(JSON.stringify({ speakers: items }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, title, organization, description, photo_url, tags, story } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama pembicara wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const id = newId();
    const now = new Date().toISOString();
    const speaker = { id, name, title: title || "", organization: organization || "", description: description || "", photo_url: photo_url || "", tags: tags || "", story: story || "", is_active: 1, created_at: now, updated_at: now };
    await minioSet(`speakers/${id}.json`, speaker);
    return new Response(JSON.stringify({ speaker }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST speaker error:", err);
    return new Response(JSON.stringify({ error: "Gagal menambah pembicara" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
