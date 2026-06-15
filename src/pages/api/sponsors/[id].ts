import type { APIRoute } from "astro";
import { pgGet, pgSet, pgDelete } from "../../../lib/pg-db";
import { getAdminFromRequest } from "../../../lib/auth";
import { sanitizeString, sanitizeUrl, checkRateLimit } from "../../../lib/security";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  try {
    const sponsor = await pgGet<Record<string, any>>("sponsors", id!);
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

    const rl = checkRateLimit("sponsor-put:" + (admin?.id || "unknown"), 30, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    const existing = await pgGet<Record<string, any>>("sponsors", id!);
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
    await pgSet("sponsors", updated);
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

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "unknown";
    const rl = checkRateLimit("sponsor-delete:" + ip, 20, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const existing = await pgGet("sponsors", id!);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    await pgDelete("sponsors", id!);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("DELETE sponsor error:", err);
    return new Response(JSON.stringify({ error: "Gagal menghapus sponsor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
