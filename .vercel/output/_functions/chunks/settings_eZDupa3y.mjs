import { g as getDb } from './db_4_NgtA8M.mjs';

const GET = async () => {
  const db = getDb();
  const result = await db.execute("SELECT * FROM settings");
  const rows = result.rows;
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return new Response(JSON.stringify({ settings }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
const POST = async ({ request }) => {
  const db = getDb();
  try {
    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      await db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, String(value)]
      );
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal menyimpan pengaturan" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
