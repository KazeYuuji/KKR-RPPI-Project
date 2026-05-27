import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const PUT: APIRoute = async ({ params, request }) => {
  const db = getDb();
  const { id } = params;
  try {
    const body = await request.json();
    const existing = db.prepare("SELECT * FROM sponsors WHERE id = ?").get(id);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    db.prepare(
      "UPDATE sponsors SET name = ?, website = ?, tier = ?, description = ?, logo_url = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(
      body.name || existing.name,
      body.website ?? existing.website,
      body.tier || existing.tier,
      body.description ?? existing.description,
      body.logo_url ?? existing.logo_url,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
      id
    );
    const sponsor = db.prepare("SELECT * FROM sponsors WHERE id = ?").get(id);
    return new Response(JSON.stringify({ sponsor }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal memperbarui sponsor" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  const existing = db.prepare("SELECT * FROM sponsors WHERE id = ?").get(id);
  if (!existing) {
    return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }
  db.prepare("DELETE FROM sponsors WHERE id = ?").run(id);
  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
