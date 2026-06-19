import type { APIRoute } from "astro";
import { pgGet, pgGetSettings } from "../../../lib/pg-db";
import QRCode from "qrcode";
import sharp from "sharp";
import { isValidId } from "../../../lib/security";

export const prerender = false;

const PW = 500;
const PH = 780;

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildSvg(name: string, ticketId: string, year: string, date: string, time: string, qrDataUri: string): string {
  return `<svg width="${PW}" height="${PH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4C1D95"/>
      <stop offset="100%" stop-color="#9F1239"/>
    </linearGradient>
    <linearGradient id="gb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>
  <rect width="${PW}" height="${PH}" fill="url(#bg)"/>
  <circle cx="430" cy="720" r="100" fill="#FBBF24" opacity="0.06"/>
  <circle cx="60" cy="60" r="100" fill="#FBBF24" opacity="0.06"/>
  <text x="250" y="85" font-size="36" fill="#ffffff" text-anchor="middle">KKR RPPI</text>
  <text x="250" y="118" font-size="16" fill="#FBBF24" text-anchor="middle" font-weight="bold">${year}</text>
  <line x1="50" y1="145" x2="450" y2="145" stroke="#D1C4D9" stroke-width="1" opacity="0.3"/>
  <text x="40" y="180" font-size="11" fill="#D1C4D9">Nama</text>
  <text x="40" y="215" font-size="24" fill="#ffffff" font-weight="bold">${name}</text>
  <text x="40" y="265" font-size="11" fill="#D1C4D9">ID Tiket</text>
  <text x="40" y="295" font-size="14" fill="#ffffff" font-family="monospace">${ticketId}</text>
  <line x1="50" y1="318" x2="450" y2="318" stroke="#D1C4D9" stroke-width="1" opacity="0.3"/>
  <text x="40" y="350" font-size="11" fill="#D1C4D9">Tanggal</text>
  <text x="40" y="375" font-size="13" fill="#ffffff" font-weight="bold">${date}</text>
  <text x="270" y="350" font-size="11" fill="#D1C4D9">Waktu</text>
  <text x="270" y="375" font-size="13" fill="#ffffff" font-weight="bold">${time}</text>
  <line x1="50" y1="400" x2="450" y2="400" stroke="#D1C4D9" stroke-width="1" opacity="0.3"/>
  <text x="250" y="445" font-size="12" fill="#FBBF24" text-anchor="middle" font-weight="bold">Scan QR Code untuk Check-in</text>
  <rect x="164" y="460" width="172" height="172" fill="#ffffff" rx="8"/>
  <image href="${qrDataUri}" xlink:href="${qrDataUri}" x="170" y="466" width="160" height="160"/>
  <text x="250" y="650" font-size="12" fill="#ffffff" text-anchor="middle" font-weight="bold">Tunjukkan QR ini saat datang</text>
  <text x="250" y="670" font-size="10" fill="#D1C4D9" text-anchor="middle">Terima kasih telah mendaftar. Tuhan Yesus memberkati.</text>
  <rect x="0" y="774" width="${PW}" height="6" fill="url(#gb)"/>
</svg>`;
}

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    if (!id || !isValidId(id)) {
      return new Response("ID tiket tidak valid", { status: 400, headers: { "Content-Type": "text/plain" } });
    }

    const registrant = await pgGet<Record<string, any>>("registrants", id);
    if (!registrant) {
      return new Response("Pendaftar tidak ditemukan", { status: 404, headers: { "Content-Type": "text/plain" } });
    }

    const s = await pgGetSettings();
    const year = esc(s.eventYear || "2026");
    const date = esc(s.locDate || "Sabtu, 10 Januari 2026");
    const time = esc(s.locTime || "08.00 - 12.30 WIB");
    const name = esc(registrant.name || "-").toUpperCase();
    const ticketId = esc(registrant.id || "-");

    const qrDataUri = await QRCode.toDataURL(registrant.id, { width: 400, margin: 2, color: { dark: "#141416", light: "#ffffff" } });

    const svg = buildSvg(name, ticketId, year, date, time, qrDataUri);

    // Try sharp PNG conversion; fall back to SVG if it fails
    const accept = request.headers.get("accept") || "";
    const prefersSvg = accept.includes("image/svg+xml");

    try {
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      return new Response(png, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="tiket-${id}.png"`,
          "Cache-Control": "no-cache",
        },
      });
    } catch (sharpErr) {
      console.warn("sharp SVG→PNG failed, falling back to SVG:", sharpErr);
      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `attachment; filename="tiket-${id}.svg"`,
          "Cache-Control": "no-cache",
        },
      });
    }
  } catch (err) {
    console.error("ticket-img error:", err);
    return new Response("Maaf, terjadi kesalahan saat membuat tiket gambar. (" + String(err).slice(0, 200) + ")", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
};
