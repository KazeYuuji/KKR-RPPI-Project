import type { APIRoute } from "astro";

const cache = new Map<string, { url: string; ttl: number }>();

function buildEmbedUrl(lat: number, lon: number): string {
  const pad = 0.02;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - pad},${lat - pad},${lon + pad},${lat + pad}&layer=mapnik&marker=${lat},${lon}`;
}

function extractCoords(text: string): { lat: number; lon: number } | null {
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
  const llMatch = text.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lon: parseFloat(llMatch[2]) };
  const qCoords = text.match(/[?&]q=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
  if (qCoords) return { lat: parseFloat(qCoords[1]), lon: parseFloat(qCoords[2]) };
  return null;
}

function extractPlaceName(text: string): string | null {
  const placeMatch = text.match(/\/place\/([^/?]+)/);
  if (placeMatch) return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
  const qMatch = text.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    const val = decodeURIComponent(qMatch[1].replace(/\+/g, " "));
    if (!/^-?\d/.test(val)) return val;
  }
  return null;
}

async function resolveMapUrl(link: string): Promise<string> {
  try {
    const res = await fetch(link, { method: "HEAD", redirect: "follow" });
    return res.url || link;
  } catch { return link; }
}

async function geoFromNominatim(query: string): Promise<string> {
  const q = encodeURIComponent(query);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { "User-Agent": "KKR-RPPI/1.0" } },
  );
  const data = await res.json();
  if (data && data.length > 0) {
    return buildEmbedUrl(parseFloat(data[0].lat), parseFloat(data[0].lon));
  }
  return "";
}

export const GET: APIRoute = async ({ url }) => {
  const venue = url.searchParams.get("venue") || "";
  const mapsLink = url.searchParams.get("mapsLink") || "";
  const cacheKey = mapsLink || venue || "default";
  const cacheKeyNorm = cacheKey.toLowerCase().trim();

  const cached = cache.get(cacheKeyNorm);
  if (cached && cached.ttl > Date.now()) {
    return new Response(JSON.stringify({ url: cached.url }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1) If mapsLink is provided, try to extract coords or place name from it
    if (mapsLink) {
      const resolved = await resolveMapUrl(mapsLink);
      const coords = extractCoords(resolved);
      if (coords) {
        const embedUrl = buildEmbedUrl(coords.lat, coords.lon);
        cache.set(cacheKeyNorm, { url: embedUrl, ttl: Date.now() + 86_400_000 });
        return new Response(JSON.stringify({ url: embedUrl }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      const place = extractPlaceName(resolved);
      if (place) {
        const embedUrl = await geoFromNominatim(place);
        if (embedUrl) {
          cache.set(cacheKeyNorm, { url: embedUrl, ttl: Date.now() + 86_400_000 });
          return new Response(JSON.stringify({ url: embedUrl }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // 2) Fall back to venue name geocoding
    if (venue) {
      const embedUrl = await geoFromNominatim(venue);
      if (embedUrl) {
        cache.set(cacheKeyNorm, { url: embedUrl, ttl: Date.now() + 86_400_000 });
        return new Response(JSON.stringify({ url: embedUrl }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
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
