import type { APIRoute } from "astro";
import { pgList, pgGet, pgSet, queryOne, pgGetSettings } from "../../lib/pg-db";
import { newId } from "../../lib/minio-db";
import { getAdminFromRequest } from "../../lib/auth";
import { sanitizeString, sanitizeEmail, sanitizePhone, sanitizeId, isValidId, isValidOrigin, checkRateLimit } from "../../lib/security";

function sanitizeTicketId(val: unknown): string {
  if (typeof val !== "string") return "general";
  return val.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) || "general";
}

// Retry ticket decrement to mitigate race condition
async function decrementTicket(ticketType: string): Promise<boolean> {
  const result = await queryOne<{ remaining: number }>(
    "UPDATE tickets SET remaining = remaining - 1 WHERE id = $1 AND remaining > 0 RETURNING remaining",
    [ticketType]
  );
  return result !== null;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    const registrants = await pgList<Record<string, any>>("registrants", "created_at DESC");
    return new Response(JSON.stringify({ registrants }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET registrants error:", err);
    return new Response(JSON.stringify({ error: "Gagal mengambil data pendaftar" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, whatsapp, ticket, action } = body;

    // Rate limit registrations per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit("register-post:" + ip, 10, 60_000);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Terlalu banyak percobaan pendaftaran. Coba lagi nanti." }), { status: 429, headers: { "Content-Type": "application/json" } });
    }

    if (action === "checkin") {
      const id = sanitizeId(body.id);
      if (!id) return new Response(JSON.stringify({ error: "ID pendaftar tidak valid" }), { status: 400, headers: { "Content-Type": "application/json" } });
      const admin = getAdminFromRequest(request);
      if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
      const existing = await pgGet<Record<string, any>>("registrants", id);
      if (!existing) return new Response(JSON.stringify({ error: "Pendaftar tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
      if (existing?.checked_in) return new Response(JSON.stringify({ error: "Tiket ini sudah check-in sebelumnya" }), { status: 400, headers: { "Content-Type": "application/json" } });
      await pgSet("registrants", { ...existing, checked_in: 1, id });
      return new Response(JSON.stringify({ registrant: { ...existing, checked_in: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Server-generated ID
    const sanitizedId = newId();

    if (!name) {
      return new Response(JSON.stringify({ error: "Nama wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const registrantData = {
      id: sanitizedId, name: sanitizeString(name, 200),
      email: sanitizeEmail(email),
      whatsapp: sanitizePhone(whatsapp),
      ticket: sanitizeTicketId(ticket),
      checked_in: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const settings = await pgGetSettings();
    const deadlineStr = settings.regDeadlineISO;
    if (deadlineStr) {
      let ds = deadlineStr;
      if (!ds.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(ds)) ds += '+07:00';
      if (Date.now() > new Date(ds).getTime()) {
        return new Response(JSON.stringify({ error: "Maaf, batas waktu pendaftaran telah berakhir" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    // Ticket availability check + atomic decrement
    const ticketType = sanitizeTicketId(ticket);
    const ticketData = await pgGet<Record<string, any>>("tickets", ticketType);
    if (!ticketData) {
      return new Response(JSON.stringify({ error: "Jenis tiket tidak ditemukan" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if ((ticketData.remaining || 0) <= 0) {
      return new Response(JSON.stringify({ error: "Maaf, tiket sudah habis!" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Decrement ticket (atomic)
    const decremented = await decrementTicket(ticketType);
    if (!decremented) {
      return new Response(JSON.stringify({ error: "Maaf, tiket sudah habis saat diproses" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Write registrant
    await pgSet("registrants", registrantData);

    return new Response(JSON.stringify({ registrant: registrantData }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST registrants error:", err);
    return new Response(JSON.stringify({ error: "Gagal memproses pendaftar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
