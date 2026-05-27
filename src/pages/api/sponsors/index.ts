import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = getDb();
  const sponsors = db.prepare("SELECT * FROM sponsors ORDER BY is_active DESC, created_at DESC").all();
  return new Response(JSON.stringify({ sponsors }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    const { name, website, tier, description, logo_url } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama sponsor wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const stmt = db.prepare(
      "INSERT INTO sponsors (name, website, tier, description, logo_url) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(name, website || "", tier || "bronze", description || "", logo_url || "");
    const sponsor = db.prepare("SELECT * FROM sponsors WHERE id = ?").get(result.lastInsertRowid);
    return new Response(JSON.stringify({ sponsor }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal menambah sponsor" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
