import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  try {
    const result = await db.execute("SELECT * FROM sponsors WHERE id = ?", [id]);
    const sponsor = result.rows[0] as Record<string, any> | undefined;
    if (!sponsor) {
      return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ sponsor }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal memuat sponsor" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const db = getDb();
  const { id } = params;
  try {
    const body = await request.json();
    const existingResult = await db.execute("SELECT * FROM sponsors WHERE id = ?", [id]);
    const existing = existingResult.rows[0] as Record<string, any> | undefined;
    if (!existing) {
      return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    await db.execute(
      "UPDATE sponsors SET name = ?, website = ?, tier = ?, description = ?, logo_url = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?",
      [
        body.name || existing.name,
        body.website ?? existing.website,
        body.tier || existing.tier,
        body.description ?? existing.description,
        body.logo_url ?? existing.logo_url,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
        id
      ]
    );
    const sponsor = await db.execute("SELECT * FROM sponsors WHERE id = ?", [id]);
    return new Response(JSON.stringify({ sponsor: sponsor.rows[0] }), {
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
  const existingResult = await db.execute("SELECT * FROM sponsors WHERE id = ?", [id]);
  if (!existingResult.rows[0]) {
    return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }
  await db.execute("DELETE FROM sponsors WHERE id = ?", [id]);
  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
