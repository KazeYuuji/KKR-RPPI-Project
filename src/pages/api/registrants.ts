import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";

export const GET: APIRoute = async () => {
  const db = getDb();
  const registrants = db.prepare("SELECT * FROM registrants ORDER BY created_at DESC").all();
  return new Response(JSON.stringify({ registrants }), {
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

    const existing = db.prepare("SELECT * FROM registrants WHERE id = ?").get(id) as any;

    if (action === "verify") {
      const newStatus = existing?.status === "Verified" ? "Pending" : "Verified";
      db.prepare("UPDATE registrants SET status = ? WHERE id = ?").run(newStatus, id);
      const registrant = db.prepare("SELECT * FROM registrants WHERE id = ?").get(id);
      return new Response(JSON.stringify({ registrant }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (action === "checkin") {
      const newVal = existing?.checked_in ? 0 : 1;
      db.prepare("UPDATE registrants SET checked_in = ? WHERE id = ?").run(newVal, id);
      const registrant = db.prepare("SELECT * FROM registrants WHERE id = ?").get(id);
      return new Response(JSON.stringify({ registrant }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "Nama wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const ticketType = ticket || "general";
    if (!existing) {
      const ticketRow = db.prepare("SELECT remaining FROM tickets WHERE id = ?").get(ticketType) as any;
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
      const tx = db.transaction(() => {
        db.prepare(
          "INSERT INTO registrants (id, name, school, email, whatsapp, participant_type, ticket, status, checked_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(id, name, school || "", email || "", whatsapp || "", participant_type || "Student", ticketType, status || "Pending", checked_in ? 1 : 0);
        db.prepare("UPDATE tickets SET remaining = remaining - 1 WHERE id = ? AND remaining > 0").run(ticketType);
      });
      tx();
    } else {
      db.prepare(
        "UPDATE registrants SET name = ?, school = ?, email = ?, whatsapp = ?, participant_type = ?, ticket = ?, status = ?, checked_in = ? WHERE id = ?"
      ).run(name, school || "", email || "", whatsapp || "", participant_type || "Student", ticketType, status || "Pending", checked_in ? 1 : 0, id);
    }

    const registrant = db.prepare("SELECT * FROM registrants WHERE id = ?").get(id);
    return new Response(JSON.stringify({ registrant }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal memproses pendaftar" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
