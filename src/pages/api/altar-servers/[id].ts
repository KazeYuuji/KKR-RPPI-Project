import type { APIRoute } from "astro";
import { minioGet, minioSet, minioDelete } from "../../../lib/minio-db";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  try {
    const altar = await minioGet<Record<string, any>>(`altar_servers/${id}.json`);
    if (!altar) {
      return new Response(JSON.stringify({ error: "Pelayan altar tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ altarServer: altar }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("GET altar-server error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat pelayan altar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params;
  try {
    const body = await request.json();
    const existing = await minioGet<Record<string, any>>(`altar_servers/${id}.json`);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pelayan altar tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const updated = {
      ...existing,
      name: body.name ?? existing.name,
      title: body.title ?? existing.title,
      organization: body.organization ?? existing.organization,
      description: body.description ?? existing.description,
      photo_url: body.photo_url ?? existing.photo_url,
      tags: body.tags ?? existing.tags,
      is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
      updated_at: new Date().toISOString(),
    };
    await minioSet(`altar_servers/${id}.json`, updated);
    return new Response(JSON.stringify({ altarServer: updated }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("PUT altar-server error:", err);
    return new Response(JSON.stringify({ error: "Gagal memperbarui pelayan altar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  try {
    const existing = await minioGet(`altar_servers/${id}.json`);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pelayan altar tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    await minioDelete(`altar_servers/${id}.json`);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("DELETE altar-server error:", err);
    return new Response(JSON.stringify({ error: "Gagal menghapus pelayan altar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
