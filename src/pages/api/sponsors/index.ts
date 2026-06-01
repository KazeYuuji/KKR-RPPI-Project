import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = getDb();
  const result = await db.execute("SELECT * FROM sponsors ORDER BY is_active DESC, created_at DESC");
  return new Response(JSON.stringify({ sponsors: result.rows }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    const { name, website, description, logo_url } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama sponsor wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const result = await db.execute(
      "INSERT INTO sponsors (name, website, description, logo_url) VALUES (?, ?, ?, ?)",
      [name, website || "", description || "", logo_url || ""]
    );
    const sponsor = await db.execute("SELECT * FROM sponsors WHERE id = ?", [result.lastInsertRowid]);
    return new Response(JSON.stringify({ sponsor: sponsor.rows[0] }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal menambah sponsor" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
