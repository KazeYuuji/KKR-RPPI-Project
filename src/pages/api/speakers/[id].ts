import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  try {
    const result = await db.execute("SELECT * FROM speakers WHERE id = ?", [id]);
    const speaker = result.rows[0] as Record<string, any> | undefined;
    if (!speaker) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ speaker }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET speaker error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat pembicara" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const db = getDb();
  const { id } = params;
  try {
    const body = await request.json();
    const existingResult = await db.execute("SELECT * FROM speakers WHERE id = ?", [id]);
    const existing = existingResult.rows[0] as Record<string, any> | undefined;
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    await db.execute(
      "UPDATE speakers SET name = ?, title = ?, organization = ?, description = ?, photo_url = ?, tags = ?, story = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?",
      [
        body.name || existing.name,
        body.title ?? existing.title,
        body.organization ?? existing.organization,
        body.description ?? existing.description,
        body.photo_url ?? existing.photo_url,
        body.tags ?? existing.tags,
        body.story ?? existing.story,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
        id
      ]
    );
    const speaker = await db.execute("SELECT * FROM speakers WHERE id = ?", [id]);
    return new Response(JSON.stringify({ speaker: speaker.rows[0] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("PUT speaker error:", err);
    return new Response(JSON.stringify({ error: "Gagal memperbarui pembicara" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  try {
    const existingResult = await db.execute("SELECT * FROM speakers WHERE id = ?", [id]);
    if (!existingResult.rows[0]) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    await db.execute("DELETE FROM speakers WHERE id = ?", [id]);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("DELETE speaker error:", err);
    return new Response(JSON.stringify({ error: "Gagal menghapus pembicara" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
