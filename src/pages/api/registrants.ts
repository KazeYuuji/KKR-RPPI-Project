import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";

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
    const { id, name, school, email, whatsapp, participant_type, ticket, status, checked_in, action } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: "ID wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const existingResult = await db.execute("SELECT * FROM registrants WHERE id = ?", [id]);
    const existing = existingResult.rows[0] as Record<string, any> | undefined;

    if (action === "verify") {
      const newStatus = existing?.status === "Verified" ? "Pending" : "Verified";
      await db.execute("UPDATE registrants SET status = ? WHERE id = ?", [newStatus, id]);
      const r = await db.execute("SELECT * FROM registrants WHERE id = ?", [id]);
      return new Response(JSON.stringify({ registrant: r.rows[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (action === "checkin") {
      const newVal = existing?.checked_in ? 0 : 1;
      await db.execute("UPDATE registrants SET checked_in = ? WHERE id = ?", [newVal, id]);
      const r = await db.execute("SELECT * FROM registrants WHERE id = ?", [id]);
      return new Response(JSON.stringify({ registrant: r.rows[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "Nama wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
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
        "INSERT INTO registrants (id, name, school, email, whatsapp, participant_type, ticket, status, checked_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name, school || "", email || "", whatsapp || "", participant_type || "Student", ticketType, status || "Pending", checked_in ? 1 : 0]
      );
      await db.execute("UPDATE tickets SET remaining = remaining - 1 WHERE id = ? AND remaining > 0", [ticketType]);
    } else {
      await db.execute(
        "UPDATE registrants SET name = ?, school = ?, email = ?, whatsapp = ?, participant_type = ?, ticket = ?, status = ?, checked_in = ? WHERE id = ?",
        [name, school || "", email || "", whatsapp || "", participant_type || "Student", ticketType, status || "Pending", checked_in ? 1 : 0, id]
      );
    }

    const r = await db.execute("SELECT * FROM registrants WHERE id = ?", [id]);
    return new Response(JSON.stringify({ registrant: r.rows[0] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal memproses pendaftar" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
