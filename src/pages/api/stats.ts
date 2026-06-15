import type { APIRoute } from "astro";
import { query, queryOne } from "../../lib/pg-db";

let statsCache: { data: string; ttl: number } | null = null;

export const GET: APIRoute = async () => {
  try {
    if (statsCache && statsCache.ttl > Date.now()) {
      return new Response(statsCache.data, {
        status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=30" },
      });
    }
    const [totalReg, checkedInResult, sponsorCountResult] = await Promise.all([
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM registrants"),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM registrants WHERE checked_in = 1"),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM sponsors"),
    ]);
    const totalRegistrants = parseInt(totalReg?.count || "0", 10);
    const checkedIn = parseInt(checkedInResult?.count || "0", 10);
    const sponsorCount = parseInt(sponsorCountResult?.count || "0", 10);
    const data = JSON.stringify({ totalRegistrants, checkedIn, sponsorCount });
    statsCache = { data, ttl: Date.now() + 30_000 };
    return new Response(data, {
      status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=30" },
    });
  } catch (err) {
    console.error("GET stats error:", err);
    if (statsCache) {
      return new Response(statsCache.data, {
        status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=0", "Warning": "299 - stale cache" },
      });
    }
    return new Response(JSON.stringify({ error: "Gagal memuat statistik" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
