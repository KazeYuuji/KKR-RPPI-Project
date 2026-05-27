import { g as getDb } from './db_4_NgtA8M.mjs';

const prerender = false;
const GET = async () => {
  const db = getDb();
  const result = await db.execute("SELECT * FROM speakers ORDER BY is_active DESC, created_at DESC");
  return new Response(JSON.stringify({ speakers: result.rows }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
const POST = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    const { name, title, organization, description, photo_url, tags } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama pembicara wajib diisi" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const result = await db.execute(
      "INSERT INTO speakers (name, title, organization, description, photo_url, tags) VALUES (?, ?, ?, ?, ?, ?)",
      [name, title || "", organization || "", description || "", photo_url || "", tags || ""]
    );
    const speaker = await db.execute("SELECT * FROM speakers WHERE id = ?", [result.lastInsertRowid]);
    return new Response(JSON.stringify({ speaker: speaker.rows[0] }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal menambah pembicara" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
