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

export const GET: APIRoute = async ({ params }) => {
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

    // SVG y=0 at top; PDF y=0 at bottom → svgY = PH - pdfY
    const svg = `<svg width="${PW}" height="${PH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4C1D95"/>
      <stop offset="100%" stop-color="#9F1239"/>
    </linearGradient>
    <linearGradient id="goldBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>
  <rect width="${PW}" height="${PH}" fill="url(#bg)"/>
  <rect x="${PW - 120}" y="${PH - 120}" width="200" height="200" fill="#FBBF24" opacity="0.06" rx="100"/>
  <rect x="-60" y="-60" width="200" height="200" fill="#FBBF24" opacity="0.06" rx="100"/>
  <text x="250" y="80" text-anchor="middle" font-family="Times,Georgia,serif" font-size="36" font-weight="bold" fill="white">KKR RPPI</text>
  <text x="250" y="115" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="16" font-weight="bold" fill="#FBBF24">${year}</text>
  <line x1="50" y1="140" x2="450" y2="140" stroke="#D1C4D9" stroke-width="1" opacity="0.25"/>
  <text x="40" y="175" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="#D1C4D9">Nama</text>
  <text x="40" y="207" font-family="Helvetica,Arial,sans-serif" font-size="22" font-weight="bold" fill="white">${name}</text>
  <text x="40" y="257" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="#D1C4D9">ID Tiket</text>
  <text x="40" y="282" font-family="Courier,monospace" font-size="13" fill="white">${ticketId}</text>
  <line x1="50" y1="302" x2="450" y2="302" stroke="#D1C4D9" stroke-width="1" opacity="0.25"/>
  <text x="40" y="332" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="#D1C4D9">Tanggal</text>
  <text x="40" y="354" font-family="Helvetica,Arial,sans-serif" font-size="12" font-weight="bold" fill="white">${date}</text>
  <text x="270" y="332" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="#D1C4D9">Waktu</text>
  <text x="270" y="354" font-family="Helvetica,Arial,sans-serif" font-size="12" font-weight="bold" fill="white">${time}</text>
  <line x1="50" y1="380" x2="450" y2="380" stroke="#D1C4D9" stroke-width="1" opacity="0.25"/>
  <text x="250" y="441" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="11" font-weight="bold" fill="#FBBF24">Scan QR Code untuk Check-in</text>
  <rect x="164" y="459" width="172" height="172" fill="white" rx="8"/>
  <image href="${qrDataUri}" x="170" y="465" width="160" height="160"/>
  <text x="250" y="644" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="11" font-weight="bold" fill="white">Tunjukkan QR ini saat datang</text>
  <text x="250" y="662" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="9" fill="#D1C4D9">Terima kasih telah mendaftar. Tuhan Yesus memberkati.</text>
  <rect x="0" y="774" width="${PW}" height="6" fill="url(#goldBar)"/>
</svg>`;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return new Response(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="tiket-${id}.png"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("ticket-img error:", err);
    return new Response("Maaf, terjadi kesalahan saat membuat tiket gambar. Silakan coba lagi.", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
};
