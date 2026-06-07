import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";
import { saveJSONToMinIO } from "../../lib/minio";

export const GET: APIRoute = async () => {
  const db = getDb();
  const result = await db.execute("SELECT * FROM registrants ORDER BY created_at DESC");
  return new Response(JSON.stringify({ registrants: result.rows }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    const { id, name, school, email, whatsapp, participant_type, ticket, checked_in, action } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: "ID wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const existingResult = await db.execute("SELECT * FROM registrants WHERE id = ?", [id]);
    const existing = existingResult.rows[0] as Record<string, any> | undefined;

    if (action === "checkin") {
      if (existing?.checked_in) {
        return new Response(JSON.stringify({ error: "Tiket ini sudah check-in sebelumnya dan tidak dapat digunakan lagi" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      await db.execute("UPDATE registrants SET checked_in = 1 WHERE id = ?", [id]);
      const r = await db.execute("SELECT * FROM registrants WHERE id = ?", [id]);
      return new Response(JSON.stringify({ registrant: r.rows[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "Nama wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Check registration deadline
    if (!existing) {
      const deadlineResult = await db.execute("SELECT value FROM settings WHERE key = 'regDeadlineISO'");
      const deadlineRow = deadlineResult.rows[0] as Record<string, any> | undefined;
      if (deadlineRow?.value) {
        let deadlineStr = deadlineRow.value;
        // Naive ISO format (no Z or offset) — assume WIB (UTC+7)
        if (!deadlineStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(deadlineStr)) {
          deadlineStr += '+07:00';
        }
        const deadline = new Date(deadlineStr).getTime();
        if (Date.now() > deadline) {
          return new Response(JSON.stringify({ error: "Maaf, batas waktu pendaftaran telah berakhir" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    const ticketType = ticket || "general";
    if (!existing) {
      const ticketResult = await db.execute("SELECT remaining FROM tickets WHERE id = ?", [ticketType]);
      const ticketRow = ticketResult.rows[0] as Record<string, any> | undefined;
      if (!ticketRow) {
        return new Response(JSON.stringify({ error: "Jenis tiket tidak ditemukan" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      if (ticketRow.remaining <= 0) {
        return new Response(JSON.stringify({ error: "Maaf, tiket sudah habis!" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      await db.execute(
        "INSERT INTO registrants (id, name, school, email, whatsapp, participant_type, ticket, checked_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name, school || "", email || "", whatsapp || "", participant_type || "Student", ticketType, checked_in ? 1 : 0]
      );
      await db.execute("UPDATE tickets SET remaining = remaining - 1 WHERE id = ? AND remaining > 0", [ticketType]);
    } else {
      await db.execute(
        "UPDATE registrants SET name = ?, school = ?, email = ?, whatsapp = ?, participant_type = ?, ticket = ?, checked_in = ? WHERE id = ?",
        [name, school || "", email || "", whatsapp || "", participant_type || "Student", ticketType, checked_in ? 1 : 0, id]
      );
    }

    const r = await db.execute("SELECT * FROM registrants WHERE id = ?", [id]);
    saveJSONToMinIO(r.rows[0], `backups/registrants/${id}.json`).catch(e => console.error("MinIO backup error:", e));
    return new Response(JSON.stringify({ registrant: r.rows[0] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST registrants error:", err);
    return new Response(JSON.stringify({ error: "Gagal memproses pendaftar" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
