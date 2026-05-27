import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const PUT: APIRoute = async ({ params, request }) => {
  const db = getDb();
  const { id } = params;
  try {
    const body = await request.json();
    const existing = db.prepare("SELECT * FROM speakers WHERE id = ?").get(id);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    db.prepare(
      "UPDATE speakers SET name = ?, title = ?, organization = ?, description = ?, photo_url = ?, tags = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(
      body.name || existing.name,
      body.title ?? existing.title,
      body.organization ?? existing.organization,
      body.description ?? existing.description,
      body.photo_url ?? existing.photo_url,
      body.tags ?? existing.tags,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
      id
    );
    const speaker = db.prepare("SELECT * FROM speakers WHERE id = ?").get(id);
    return new Response(JSON.stringify({ speaker }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal memperbarui pembicara" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  const existing = db.prepare("SELECT * FROM speakers WHERE id = ?").get(id);
  if (!existing) {
    return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }
  db.prepare("DELETE FROM speakers WHERE id = ?").run(id);
  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
