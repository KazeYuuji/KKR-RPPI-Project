import type { APIRoute } from "astro";
import { pgGet, execute } from "../../../lib/pg-db";
import { getAdminFromRequest } from "../../../lib/auth";
import { sanitizeId, checkRateLimit } from "../../../lib/security";

export const prerender = false;

export const DELETE: APIRoute = async ({ params, request }) => {
  const id = sanitizeId(params.id);
  if (!id) {
    return new Response(JSON.stringify({ error: "ID tidak valid" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit("registrant-delete:" + ip, 20, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const existing = await pgGet<Record<string, any>>("registrants", id);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Peserta tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const ticketType = existing.ticket || "general";

    // Delete registrant
    await execute("DELETE FROM registrants WHERE id = $1", [id]);

    // Increment ticket remaining
    await execute("UPDATE tickets SET remaining = remaining + 1 WHERE id = $1", [ticketType]);

    return new Response(JSON.stringify({ success: true, ticketType }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("DELETE registrant error:", err);
    return new Response(JSON.stringify({ error: "Gagal menghapus peserta" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
