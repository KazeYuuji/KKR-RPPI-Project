import type { APIRoute } from "astro";
import { minioListAll } from "../../lib/minio-db";

let statsCache: { data: string; ttl: number } | null = null;

export const GET: APIRoute = async () => {
  try {
    if (statsCache && statsCache.ttl > Date.now()) {
      return new Response(statsCache.data, {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const registrants = await minioListAll<Record<string, any>>("registrants/");
    const sponsors = await minioListAll("sponsors/");
    const totalRegistrants = registrants.length;
    const checkedIn = registrants.filter(r => r.checked_in).length;
    const data = JSON.stringify({ totalRegistrants, checkedIn, sponsorCount: sponsors.length });
    statsCache = { data, ttl: Date.now() + 30_000 };
    return new Response(data, {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET stats error:", err);
    if (statsCache) {
      return new Response(statsCache.data, {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Gagal memuat statistik" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
