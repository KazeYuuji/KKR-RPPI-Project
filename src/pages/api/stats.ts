import type { APIRoute } from "astro";
import { query, queryOne } from "../../lib/pg-db";

export const GET: APIRoute = async () => {
  try {
    const [totalReg, checkedInResult, sponsorCountResult] = await Promise.all([
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM registrants"),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM registrants WHERE checked_in = 1"),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM sponsors"),
    ]);
    const totalRegistrants = parseInt(totalReg?.count || "0", 10);
    const checkedIn = parseInt(checkedInResult?.count || "0", 10);
    const sponsorCount = parseInt(sponsorCountResult?.count || "0", 10);
    const data = JSON.stringify({ totalRegistrants, checkedIn, sponsorCount });
    return new Response(data, {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET stats error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat statistik" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
