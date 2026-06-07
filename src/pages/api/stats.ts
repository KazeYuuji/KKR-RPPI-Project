import type { APIRoute } from "astro";
import { minioListAll } from "../../lib/minio-db";

export const GET: APIRoute = async () => {
  try {
    const registrants = await minioListAll<Record<string, any>>("registrants/");
    const sponsors = await minioListAll("sponsors/");
    const totalRegistrants = registrants.length;
    const checkedIn = registrants.filter(r => r.checked_in).length;
    return new Response(JSON.stringify({ totalRegistrants, checkedIn, sponsorCount: sponsors.length }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET stats error:", err);
    return new Response(JSON.stringify({ error: "Gagal memuat statistik" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
