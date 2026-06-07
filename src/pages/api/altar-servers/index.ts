import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = getDb();
  const result = await db.execute("SELECT * FROM altar_servers ORDER BY is_active DESC, created_at DESC");
  return new Response(JSON.stringify({ altarServers: result.rows }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    const { name, title, organization, description, photo_url, tags } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama pelayan altar wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const result = await db.execute(
      "INSERT INTO altar_servers (name, title, organization, description, photo_url, tags) VALUES (?, ?, ?, ?, ?, ?)",
      [name, title || "", organization || "", description || "", photo_url || "", tags || ""]
    );
    const altar = await db.execute("SELECT * FROM altar_servers WHERE id = ?", [result.lastInsertRowid]);
    return new Response(JSON.stringify({ altarServer: altar.rows[0] }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST altar-server error:", err);
    return new Response(JSON.stringify({ error: "Gagal menambah pelayan altar" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
