import type { APIRoute } from "astro";
import { minioGet, minioSet, minioDelete } from "../../../lib/minio-db";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  try {
    const sponsor = await minioGet<Record<string, any>>(`sponsors/${id}.json`);
    if (!sponsor) {
      return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ sponsor }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("GET sponsor error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat sponsor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params;
  try {
    const body = await request.json();
    const existing = await minioGet<Record<string, any>>(`sponsors/${id}.json`);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const updated = {
      ...existing,
      name: body.name ?? existing.name,
      website: body.website ?? existing.website,
      description: body.description ?? existing.description,
      logo_url: body.logo_url ?? existing.logo_url,
      is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
      updated_at: new Date().toISOString(),
    };
    await minioSet(`sponsors/${id}.json`, updated);
    return new Response(JSON.stringify({ sponsor: updated }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("PUT sponsor error:", err);
    return new Response(JSON.stringify({ error: "Gagal memperbarui sponsor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  try {
    const existing = await minioGet(`sponsors/${id}.json`);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    await minioDelete(`sponsors/${id}.json`);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("DELETE sponsor error:", err);
    return new Response(JSON.stringify({ error: "Gagal menghapus sponsor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
