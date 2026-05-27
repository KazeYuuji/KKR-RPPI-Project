import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";

export const GET: APIRoute = async () => {
  const db = getDb();
  const result = await db.execute("SELECT * FROM tickets ORDER BY id");
  return new Response(JSON.stringify({ tickets: result.rows }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    if (body.action === "delete") {
      await db.execute("DELETE FROM tickets WHERE id = ?", [body.id]);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (body.action === "create") {
      const id = "ticket-" + Date.now().toString(36).toLowerCase();
      await db.execute("INSERT INTO tickets (id, name, remaining) VALUES (?, ?, ?)", [
        id, body.name || "Tiket Baru", body.remaining || 0
      ]);
      return new Response(JSON.stringify({ id, success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const tickets = Array.isArray(body) ? body : [body];
    for (const t of tickets) {
      await db.execute(
        "INSERT INTO tickets (id, name, remaining) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, remaining = excluded.remaining",
        [t.id, t.name, t.remaining]
      );
    }
    const updated = await db.execute("SELECT * FROM tickets ORDER BY id");
    return new Response(JSON.stringify({ tickets: updated.rows }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal menyimpan tiket" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
