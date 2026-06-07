import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";

export const GET: APIRoute = async () => {
  const db = getDb();
  const result = await db.execute("SELECT * FROM settings");
  const rows = result.rows as Record<string, string>[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return new Response(JSON.stringify({ settings }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
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
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST settings error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan pengaturan" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
