import type { APIRoute } from "astro";
import { pgList, pgGet, pgSet, pgDelete, query } from "../../lib/pg-db";
import { newId } from "../../lib/minio-db";
import { getAdminFromRequest } from "../../lib/auth";
import { sanitizeId, sanitizeString, isValidOrigin, checkRateLimit } from "../../lib/security";

export const GET: APIRoute = async () => {
  try {
    const tickets = await pgList<Record<string, any>>("tickets", "id ASC");
    return new Response(JSON.stringify({ tickets }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET tickets error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat tiket" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("ticket-post:" + (admin?.id || "unknown"), 30, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    if (body.action === "delete") {
      const id = sanitizeId(body.id);
      if (!id) return new Response(JSON.stringify({ error: "ID tidak valid" }), { status: 400, headers: { "Content-Type": "application/json" } });
      await pgDelete("tickets", id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (body.action === "create") {
      const id = "ticket-" + newId();
      const remaining = typeof body.remaining === "number" ? Math.max(0, Math.floor(body.remaining)) : 0;
      await pgSet("tickets", { id, name: sanitizeString(body.name, 200) || "Tiket Baru", remaining });
      return new Response(JSON.stringify({ id, success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const tix = Array.isArray(body) ? body : [body];
    for (const t of tix) {
      const id = sanitizeId(t.id);
      if (id) {
        const remaining = typeof t.remaining === "number" ? Math.max(0, Math.floor(t.remaining)) : 0;
        await pgSet("tickets", { id, name: sanitizeString(t.name, 200), remaining });
      }
    }
    const updated = await pgList<Record<string, any>>("tickets", "id ASC");
    return new Response(JSON.stringify({ tickets: updated }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST tickets error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan tiket" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
