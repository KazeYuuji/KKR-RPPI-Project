import type { APIRoute } from "astro";
import { minioGet, minioSet, minioDelete } from "../../../lib/minio-db";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  try {
    const speaker = await minioGet<Record<string, any>>(`speakers/${id}.json`);
    if (!speaker) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ speaker }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("GET speaker error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat pembicara" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params;
  try {
    const body = await request.json();
    const existing = await minioGet<Record<string, any>>(`speakers/${id}.json`);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const updated = {
      ...existing,
      name: body.name || existing.name,
      title: body.title ?? existing.title,
      organization: body.organization ?? existing.organization,
      description: body.description ?? existing.description,
      photo_url: body.photo_url ?? existing.photo_url,
      tags: body.tags ?? existing.tags,
      story: body.story ?? existing.story,
      is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
      updated_at: new Date().toISOString(),
    };
    await minioSet(`speakers/${id}.json`, updated);
    return new Response(JSON.stringify({ speaker: updated }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("PUT speaker error:", err);
    return new Response(JSON.stringify({ error: "Gagal memperbarui pembicara" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  try {
    const existing = await minioGet(`speakers/${id}.json`);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    await minioDelete(`speakers/${id}.json`);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("DELETE speaker error:", err);
    return new Response(JSON.stringify({ error: "Gagal menghapus pembicara" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
