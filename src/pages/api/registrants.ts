import type { APIRoute } from "astro";
import { minioListAll, minioGet, minioSet } from "../../lib/minio-db";
import { getAdminFromRequest } from "../../lib/auth";
import { sanitizeString, sanitizeEmail, sanitizePhone, sanitizeId, isValidId, isValidOrigin, checkRateLimit } from "../../lib/security";

const REG_PREFIX = "registrants/";

function sanitizeTicketId(val: unknown): string {
  if (typeof val !== "string") return "general";
  return val.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) || "general";
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    const registrants = await minioListAll<Record<string, any>>(REG_PREFIX);
    registrants.sort((a, b) => {
      const da = a.created_at || "";
      const db = b.created_at || "";
      return da > db ? -1 : da < db ? 1 : 0;
    });
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
    const { id, name, school, email, whatsapp, participant_type, ticket, action } = body;
    if (!id || !isValidId(id)) {
      return new Response(JSON.stringify({ error: "ID pendaftar tidak valid" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const sanitizedId = sanitizeId(id);
    if (!sanitizedId) {
      return new Response(JSON.stringify({ error: "ID pendaftar tidak valid" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const existing = await minioGet<Record<string, any>>(`${REG_PREFIX}${sanitizedId}.json`);

    if (action === "checkin") {
      const admin = getAdminFromRequest(request);
      if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

      if (existing?.checked_in) {
        return new Response(JSON.stringify({ error: "Tiket ini sudah check-in sebelumnya dan tidak dapat digunakan lagi" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const updated = { ...(existing || {}), checked_in: 1, id: sanitizedId };
      await minioSet(`${REG_PREFIX}${sanitizedId}.json`, updated);
      return new Response(JSON.stringify({ registrant: updated }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "Nama wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (!existing) {
      const settings = await minioListAll<Record<string, any>>("settings/");
      const deadlineSetting = settings.find(s => s.key === "regDeadlineISO");
      if (deadlineSetting?.value) {
        let deadlineStr = deadlineSetting.value;
        if (!deadlineStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(deadlineStr)) deadlineStr += '+07:00';
        if (Date.now() > new Date(deadlineStr).getTime()) {
          return new Response(JSON.stringify({ error: "Maaf, batas waktu pendaftaran telah berakhir" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
      }

      const ticketType = sanitizeTicketId(ticket);
      const ticketData = await minioGet<Record<string, any>>(`tickets/${ticketType}.json`);
      if (!ticketData) {
        return new Response(JSON.stringify({ error: "Jenis tiket tidak ditemukan" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      if ((ticketData.remaining || 0) <= 0) {
        return new Response(JSON.stringify({ error: "Maaf, tiket sudah habis!" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    const registrantData = {
      id: sanitizedId, name: sanitizeString(name, 200),
      school: sanitizeString(school, 200),
      email: sanitizeEmail(email),
      whatsapp: sanitizePhone(whatsapp),
      participant_type: sanitizeString(participant_type, 50) || "Student",
      ticket: sanitizeTicketId(ticket),
      checked_in: existing?.checked_in ? 1 : 0,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await minioSet(`${REG_PREFIX}${sanitizedId}.json`, registrantData);

    // Atomic-like ticket decrement: re-read ticket right before writing to minimize race window
    if (!existing) {
      const ticketType = sanitizeTicketId(ticket);
      const ticketData = await minioGet<Record<string, any>>(`tickets/${ticketType}.json`);
      if (ticketData && (ticketData.remaining || 0) > 0) {
        await minioSet(`tickets/${ticketType}.json`, { ...ticketData, remaining: (ticketData.remaining || 0) - 1 });
      } else {
        // Rollback: delete the registrant if ticket was already sold out
        await minioSet(`${REG_PREFIX}${sanitizedId}.json`, { ...registrantData, ticket_rollback: true });
        return new Response(JSON.stringify({ error: "Maaf, tiket sudah habis saat diproses" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ registrant: registrantData }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST registrants error:", err);
    return new Response(JSON.stringify({ error: "Gagal memproses pendaftar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
