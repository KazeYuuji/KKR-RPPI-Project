import { g as getDb } from './db_4_NgtA8M.mjs';

const prerender = false;
const PUT = async ({ params, request }) => {
  const db = getDb();
  const { id } = params;
  try {
    const body = await request.json();
    const existingResult = await db.execute("SELECT * FROM speakers WHERE id = ?", [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    await db.execute(
      "UPDATE speakers SET name = ?, title = ?, organization = ?, description = ?, photo_url = ?, tags = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?",
      [
        body.name || existing.name,
        body.title ?? existing.title,
        body.organization ?? existing.organization,
        body.description ?? existing.description,
        body.photo_url ?? existing.photo_url,
        body.tags ?? existing.tags,
        body.is_active !== void 0 ? body.is_active ? 1 : 0 : existing.is_active,
        id
      ]
    );
    const speaker = await db.execute("SELECT * FROM speakers WHERE id = ?", [id]);
    return new Response(JSON.stringify({ speaker: speaker.rows[0] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal memperbarui pembicara" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
const DELETE = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  const existingResult = await db.execute("SELECT * FROM speakers WHERE id = ?", [id]);
  if (!existingResult.rows[0]) {
    return new Response(JSON.stringify({ error: "Pembicara tidak ditemukan" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  await db.execute("DELETE FROM speakers WHERE id = ?", [id]);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  DELETE,
  PUT,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
