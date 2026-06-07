import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  try {
    const result = await db.execute("SELECT * FROM altar_servers WHERE id = ?", [id]);
    const altar = result.rows[0] as Record<string, any> | undefined;
    if (!altar) {
      return new Response(JSON.stringify({ error: "Pelayan altar tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ altarServer: altar }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET altar-server error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat pelayan altar" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const db = getDb();
  const { id } = params;
  try {
    const body = await request.json();
    const existingResult = await db.execute("SELECT * FROM altar_servers WHERE id = ?", [id]);
    const existing = existingResult.rows[0] as Record<string, any> | undefined;
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pelayan altar tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    await db.execute(
      "UPDATE altar_servers SET name = ?, title = ?, organization = ?, description = ?, photo_url = ?, tags = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?",
      [
        body.name || existing.name,
        body.title ?? existing.title,
        body.organization ?? existing.organization,
        body.description ?? existing.description,
        body.photo_url ?? existing.photo_url,
        body.tags ?? existing.tags,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
        id
      ]
    );
    const altar = await db.execute("SELECT * FROM altar_servers WHERE id = ?", [id]);
    return new Response(JSON.stringify({ altarServer: altar.rows[0] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("PUT altar-server error:", err);
    return new Response(JSON.stringify({ error: "Gagal memperbarui pelayan altar" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  const existingResult = await db.execute("SELECT * FROM altar_servers WHERE id = ?", [id]);
  if (!existingResult.rows[0]) {
    return new Response(JSON.stringify({ error: "Pelayan altar tidak ditemukan" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }
  await db.execute("DELETE FROM altar_servers WHERE id = ?", [id]);
  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
