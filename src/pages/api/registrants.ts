import type { APIRoute } from "astro";
import { minioListAll, minioGet, minioSet } from "../../lib/minio-db";

const REG_PREFIX = "registrants/";

export const GET: APIRoute = async () => {
  try {
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
    const { id, name, school, email, whatsapp, participant_type, ticket, checked_in, action } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: "ID wajib diisi" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const existing = await minioGet<Record<string, any>>(`${REG_PREFIX}${id}.json`);

    if (action === "checkin") {
      if (existing?.checked_in) {
        return new Response(JSON.stringify({ error: "Tiket ini sudah check-in sebelumnya dan tidak dapat digunakan lagi" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const updated = { ...(existing || {}), checked_in: 1, id };
      await minioSet(`${REG_PREFIX}${id}.json`, updated);
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

      const ticketType = ticket || "general";
      const ticketData = await minioGet<Record<string, any>>(`tickets/${ticketType}.json`);
      if (!ticketData) {
        return new Response(JSON.stringify({ error: "Jenis tiket tidak ditemukan" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      if ((ticketData.remaining || 0) <= 0) {
        return new Response(JSON.stringify({ error: "Maaf, tiket sudah habis!" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      // decrement ticket
      await minioSet(`tickets/${ticketType}.json`, { ...ticketData, remaining: (ticketData.remaining || 0) - 1 });
    }

    const registrantData = {
      id, name, school: school || "", email: email || "", whatsapp: whatsapp || "",
      participant_type: participant_type || "Student", ticket: ticket || "general",
      checked_in: checked_in ? 1 : 0,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await minioSet(`${REG_PREFIX}${id}.json`, registrantData);
    return new Response(JSON.stringify({ registrant: registrantData }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST registrants error:", err);
    return new Response(JSON.stringify({ error: "Gagal memproses pendaftar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
