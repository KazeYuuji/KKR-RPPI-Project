import type { APIRoute } from "astro";
import { minioGet, minioSet, minioDelete } from "../../../lib/minio-db";
import { getAdminFromRequest } from "../../../lib/auth";
import { isValidOrigin, sanitizeString, checkRateLimit } from "../../../lib/security";

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
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("speaker-put:" + (admin?.id || "unknown"), 30, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    const existing = await minioGet<Record<string, any>>(`speakers/${id}.json`);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const updated = {
      ...existing,
      name: body.name !== undefined ? sanitizeString(body.name, 200) : existing.name,
      title: body.title !== undefined ? sanitizeString(body.title, 200) : existing.title,
      organization: body.organization !== undefined ? sanitizeString(body.organization, 200) : existing.organization,
      description: body.description !== undefined ? sanitizeString(body.description, 2000) : existing.description,
      photo_url: body.photo_url !== undefined ? sanitizeString(body.photo_url, 500) : existing.photo_url,
      tags: body.tags !== undefined ? sanitizeString(body.tags, 500) : existing.tags,
      story: body.story !== undefined ? sanitizeString(body.story, 5000) : existing.story,
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

export const DELETE: APIRoute = async ({ params, request }) => {
  const { id } = params;
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

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
