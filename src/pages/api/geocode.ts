import type { APIRoute } from "astro";
import { checkRateLimit } from "../../lib/security";

const cache = new Map<string, { url: string; lat: number; lon: number; ttl: number }>();

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

function cleanPlaceName(name: string): string {
  name = name.replace(/\([^)]*\)/g, "").trim();
  name = name.replace(/^[,\s]+|[,\s]+$/g, "");
  const parts = name.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const first = parts[0];
    const city = parts.find(p => /kota|kediri|jawa|timur|kabupaten/i.test(p));
    if (city && first.length > 3) return first + ", " + city;
    return first;
  }
  return parts[0] || name;
}

async function resolveMapUrl(link: string): Promise<string> {
  try {
    let u: URL;
    try { u = new URL(link); } catch { return link; }
    if (u.protocol !== "https:") return link;
    const allowedHosts = ["maps.google.com", "www.google.com", "google.com", "maps.app.goo.gl"];
    if (!allowedHosts.some(h => u.hostname === h || u.hostname.endsWith("." + h))) return link;
    const res = await fetch(u.toString(), { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5000) });
    const loc = res.headers.get("location");
    if (loc) {
      try { new URL(loc); return loc; } catch { return link; }
    }
    return u.toString();
  } catch { return link; }
}

async function geoFromNominatim(query: string): Promise<{ url: string; lat: number; lon: number } | null> {
  const q = encodeURIComponent(query);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { "User-Agent": "KKR-RPPI/1.0" } },
  );
  const data = await res.json();
  if (data && data.length > 0) {
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    return { url: buildEmbedUrl(lat, lon), lat, lon };
  }
  return null;
}

function extractCity(text: string): string | null {
  const known = ["Kediri", "Jakarta", "Surabaya", "Malang", "Bandung", "Semarang", "Yogyakarta", "Denpasar", "Medan", "Makassar", "Palembang"];
  for (const c of known) {
    if (text.toLowerCase().includes(c.toLowerCase())) return c;
  }
  return null;
}

const FALLBACKS = [
  "Kediri",
  "Kota Kediri, Jawa Timur",
  "Kediri Jawa Timur",
];

const MAX_CACHE = 1000;

export const GET: APIRoute = async ({ url, request }) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit("geocode:" + ip, 60, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ url: "", lat: 0, lon: 0 }), {
      status: 429, headers: { "Content-Type": "application/json" },
    });
  }

  const venue = url.searchParams.get("venue") || "";
  const mapsLink = url.searchParams.get("mapsLink") || "";
  const cacheKey = mapsLink || venue || "default";
  const cacheKeyNorm = cacheKey.toLowerCase().trim();

  const cached = cache.get(cacheKeyNorm);
  if (cached && cached.ttl > Date.now()) {
    return new Response(JSON.stringify({ url: cached.url, lat: cached.lat, lon: cached.lon }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let result: { url: string; lat: number; lon: number } | null = null;
    const queries: string[] = [];

    if (mapsLink) {
      const resolved = await resolveMapUrl(mapsLink);
      const coords = extractCoords(resolved);
      if (coords) {
        result = { url: buildEmbedUrl(coords.lat, coords.lon), lat: coords.lat, lon: coords.lon };
      } else {
        const place = extractPlaceName(resolved);
        if (place) {
          queries.push(cleanPlaceName(place));
          const city = extractCity(place);
          if (city) queries.push(city);
        }
      }
    }

    if (!result && venue) {
      queries.push(venue);
      queries.push(venue + ", Kediri");
    }

    if (!result && venue) {
      const city = extractCity(venue);
      if (city) queries.push(city);
    }

    queries.push(...FALLBACKS);

    for (const q of queries) {
      if (q) {
        result = await geoFromNominatim(q);
        if (result) break;
      }
    }

    if (result) {
      if (cache.size >= MAX_CACHE) cache.clear();
      cache.set(cacheKeyNorm, { ...result, ttl: Date.now() + 86_400_000 });
      return new Response(JSON.stringify(result), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: "", lat: 0, lon: 0 }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Geocode error:", err);
    return new Response(JSON.stringify({ url: "", lat: 0, lon: 0 }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
};
