import type { APIRoute } from "astro";
import { query } from "../../lib/pg-db";

let lastState = "";

export const GET: APIRoute = async ({ request }) => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(`data: connected\n\n`);

      const interval = setInterval(async () => {
        try {
          const rows = await query<{ state_hash: string }>(
            `SELECT MD5(CONCAT(
              COALESCE((SELECT COUNT(*)::text || '-' || COALESCE(MAX(id)::text,'0') || '-' || COALESCE(SUM(CASE WHEN checked_in THEN 1 ELSE 0 END)::text,'0') FROM registrants), ''),
              COALESCE((SELECT COUNT(*)::text || '-' || COALESCE(MAX(id)::text,'0') FROM tickets), ''),
              COALESCE((SELECT COUNT(*)::text || '-' || COALESCE(MAX(id)::text,'0') FROM speakers), ''),
              COALESCE((SELECT COUNT(*)::text || '-' || COALESCE(MAX(id)::text,'0') FROM sponsors), ''),
              COALESCE((SELECT COUNT(*)::text || '-' || COALESCE(MAX(id)::text,'0') FROM altar_servers), ''),
              COALESCE((SELECT COUNT(*)::text FROM settings), '')
            )) as state_hash`
          );
          const hash = rows[0]?.state_hash || "";

          if (hash !== lastState) {
            lastState = hash;
            controller.enqueue(`data: refresh\n\n`);
          }
        } catch (e) {
          // silent
        }
      }, 2000);

      // keepalive ping every 30s to prevent proxy timeouts
      const keepalive = setInterval(() => {
        try { controller.enqueue(`: keepalive\n\n`); } catch {}
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(keepalive);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      "Connection": "keep-alive",
    },
  });
};
