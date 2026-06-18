import type { APIRoute } from "astro";
import { query } from "../../lib/pg-db";

export const GET: APIRoute = async ({ request }) => {
  let lastCount = -1;
  let lastMaxId = -1;
  let lastCheckedSum = -1;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(`data: connected\n\n`);

      const interval = setInterval(async () => {
        try {
          const rows = await query<{ count: string; max_id: string; checked_sum: string }>(
            `SELECT COUNT(*) as count, COALESCE(MAX(id), 0) as max_id, COALESCE(SUM(CASE WHEN checked_in THEN 1 ELSE 0 END), 0) as checked_sum FROM registrants`
          );
          const row = rows[0];
          const count = parseInt(row.count);
          const maxId = parseInt(row.max_id);
          const checkedSum = parseInt(row.checked_sum);

          if (count !== lastCount || maxId !== lastMaxId || checkedSum !== lastCheckedSum) {
            lastCount = count;
            lastMaxId = maxId;
            lastCheckedSum = checkedSum;
            controller.enqueue(`data: refresh\n\n`);
          }
        } catch (e) {
          // silent
        }
      }, 2000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
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
