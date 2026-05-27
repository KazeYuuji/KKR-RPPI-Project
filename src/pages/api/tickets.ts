import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";

export const GET: APIRoute = async () => {
  const db = getDb();
  const tickets = db.prepare("SELECT * FROM tickets ORDER BY id").all();
  return new Response(JSON.stringify({ tickets }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    if (body.action === "delete") {
      db.prepare("DELETE FROM tickets WHERE id = ?").run(body.id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (body.action === "create") {
      const id = "ticket-" + Date.now().toString(36).toLowerCase();
      db.prepare("INSERT INTO tickets (id, name, remaining, expiry_date) VALUES (?, ?, ?, ?)").run(
        id, body.name || "Tiket Baru", body.remaining || 0, body.expiry_date || ""
      );
      return new Response(JSON.stringify({ id, success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const upsert = db.prepare(
      "INSERT INTO tickets (id, name, remaining, expiry_date) VALUES (?, ?, ?, ?)"
        + " ON CONFLICT(id) DO UPDATE SET name = excluded.name, remaining = excluded.remaining, expiry_date = excluded.expiry_date"
    );
    const tx = db.transaction((entries: any[]) => {
      for (const t of entries) {
        upsert.run(t.id, t.name, t.remaining, t.expiry_date);
      }
    });
    const tickets = Array.isArray(body) ? body : [body];
    tx(tickets);
    const updated = db.prepare("SELECT * FROM tickets ORDER BY id").all();
    return new Response(JSON.stringify({ tickets: updated }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal menyimpan tiket" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
