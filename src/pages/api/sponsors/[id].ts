import type { APIRoute } from "astro";
import { minioGet, minioSet, minioDelete } from "../../../lib/minio-db";
import { getAdminFromRequest } from "../../../lib/auth";
import { isValidOrigin, sanitizeString, sanitizeUrl, checkRateLimit } from "../../../lib/security";

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
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("sponsor-put:" + (admin?.id || "unknown"), 30, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    const existing = await minioGet<Record<string, any>>(`sponsors/${id}.json`);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const updated = {
      ...existing,
      name: body.name !== undefined ? sanitizeString(body.name, 200) : existing.name,
      website: body.website !== undefined ? sanitizeUrl(body.website, 500) : existing.website,
      description: body.description !== undefined ? sanitizeString(body.description, 2000) : existing.description,
      logo_url: body.logo_url !== undefined ? sanitizeUrl(body.logo_url, 500) : existing.logo_url,
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

export const DELETE: APIRoute = async ({ params, request }) => {
  const { id } = params;
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

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
