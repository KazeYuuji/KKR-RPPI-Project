import { g as getDb } from './db_4_NgtA8M.mjs';

const prerender = false;
const GET = async () => {
  const db = getDb();
  const result = await db.execute("SELECT * FROM sponsors ORDER BY is_active DESC, created_at DESC");
  return new Response(JSON.stringify({ sponsors: result.rows }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
const POST = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    const { name, website, tier, description, logo_url } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama sponsor wajib diisi" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const result = await db.execute(
      "INSERT INTO sponsors (name, website, tier, description, logo_url) VALUES (?, ?, ?, ?, ?)",
      [name, website || "", tier || "bronze", description || "", logo_url || ""]
    );
    const sponsor = await db.execute("SELECT * FROM sponsors WHERE id = ?", [result.lastInsertRowid]);
    return new Response(JSON.stringify({ sponsor: sponsor.rows[0] }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal menambah sponsor" }), {
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
