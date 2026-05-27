import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = getDb();
  const speakers = db.prepare("SELECT * FROM speakers ORDER BY is_active DESC, created_at DESC").all();
  return new Response(JSON.stringify({ speakers }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    const { name, title, organization, description, photo_url, tags } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama pembicara wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const stmt = db.prepare(
      "INSERT INTO speakers (name, title, organization, description, photo_url, tags) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const result = stmt.run(name, title || "", organization || "", description || "", photo_url || "", tags || "");
    const speaker = db.prepare("SELECT * FROM speakers WHERE id = ?").get(result.lastInsertRowid);
    return new Response(JSON.stringify({ speaker }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal menambah pembicara" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
