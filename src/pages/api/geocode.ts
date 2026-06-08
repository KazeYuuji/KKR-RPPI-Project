import type { APIRoute } from "astro";

const cache = new Map<string, { url: string; ttl: number }>();

export const GET: APIRoute = async ({ url }) => {
  const venue = url.searchParams.get("venue") || "Kediri";
  const key = venue.toLowerCase().trim();

  const cached = cache.get(key);
  if (cached && cached.ttl > Date.now()) {
    return new Response(JSON.stringify({ url: cached.url }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const q = encodeURIComponent(venue);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { "User-Agent": "KKR-RPPI/1.0" } },
    );
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      const pad = 0.02;
      const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - pad},${lat - pad},${lon + pad},${lat + pad}&layer=mapnik&marker=${lat},${lon}`;
      cache.set(key, { url: embedUrl, ttl: Date.now() + 86_400_000 });
      return new Response(JSON.stringify({ url: embedUrl }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ url: "" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Geocode error:", err);
    return new Response(JSON.stringify({ url: "" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
};
