import type { APIRoute } from "astro";
import { minioListAll, minioSet, newId } from "../../lib/minio-db";

export const GET: APIRoute = async () => {
  const settings = await minioListAll<Record<string, string>>("settings/");
  const result: Record<string, string> = {};
  for (const s of settings) {
    if (s.key) result[s.key] = s.value;
  }
  return new Response(JSON.stringify({ settings: result }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      await minioSet(`settings/${key}.json`, { key, value: String(value) });
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
