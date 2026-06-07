import type { APIRoute } from "astro";
import { minioListAll, minioSet, minioGet, minioDelete, newId } from "../../lib/minio-db";

export const GET: APIRoute = async () => {
  const tickets = await minioListAll<Record<string, any>>("tickets/");
  tickets.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  return new Response(JSON.stringify({ tickets }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (body.action === "delete") {
      await minioDelete(`tickets/${body.id}.json`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (body.action === "create") {
      const id = "ticket-" + newId();
      await minioSet(`tickets/${id}.json`, { id, name: body.name || "Tiket Baru", remaining: body.remaining || 0 });
      return new Response(JSON.stringify({ id, success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const tickets = Array.isArray(body) ? body : [body];
    for (const t of tickets) {
      if (t.id) {
        await minioSet(`tickets/${t.id}.json`, { id: t.id, name: t.name, remaining: t.remaining });
      }
    }
    const updated = await minioListAll<Record<string, any>>("tickets/");
    updated.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    return new Response(JSON.stringify({ tickets: updated }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST tickets error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan tiket" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
