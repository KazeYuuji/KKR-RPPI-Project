import type { APIRoute } from "astro";
import { pgGet, pgGetSettings } from "../../../lib/pg-db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { isValidId } from "../../../lib/security";

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r, g, b];
}

function clamp(v: number): number { return Math.max(0, Math.min(1, v)); }

async function analyzeImage(url: string): Promise<{
  isDark: boolean;
  brightness: number;
  accent: { r: number; g: number; b: number };
  secondary: { r: number; g: number; b: number };
  muted: { r: number; g: number; b: number };
  overlay: { r: number; g: number; b: number };
}> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const buf = Buffer.from(await res.arrayBuffer());
    const { data } = await sharp(buf).resize(60, 60, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true });

    const n = data.length / 3;
    let lumAcc = 0, rAcc = 0, gAcc = 0, bAcc = 0;
    let satTotal = 0, edgeContrast = 0;
    const hueBuckets: Record<number, { count: number; satSum: number }> = {};

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      lumAcc += 0.299 * r + 0.587 * g + 0.114 * b;
      rAcc += r; gAcc += g; bAcc += b;
      const [h, s] = rgbToHsl(r, g, b);
      satTotal += s;
      if (s > 0.08) {
        const bucket = Math.round(h * 12) % 12;
        if (!hueBuckets[bucket]) hueBuckets[bucket] = { count: 0, satSum: 0 };
        hueBuckets[bucket].count++;
        hueBuckets[bucket].satSum += s;
      }
    }

    const avgLum = lumAcc / n;
    const avgSat = satTotal / n;
    const isDark = avgLum < 128;
    const brightness = avgLum / 255;

    // Find dominant hue from saturated pixels
    let bestBucket = -1, bestScore = 0;
    for (const [bucket, info] of Object.entries(hueBuckets)) {
      const avgHueSat = info.satSum / info.count;
      const score = info.count * avgHueSat;
      if (score > bestScore) { bestScore = score; bestBucket = parseInt(bucket); }
    }

    // Determine accent hue: dominant hue, or default based on brightness if image is desaturated
    let accentHue: number;
    const vibrantPct = bestBucket >= 0 ? hueBuckets[bestBucket].count / n : 0;

    if (bestBucket >= 0 && vibrantPct > 0.01) {
      // Use dominant hue, shift slightly for better visual
      accentHue = (bestBucket / 12 + 1 / 24) % 1;
    } else {
      // No dominant hue: choose aesthetically pleasing default based on brightness
      // Warm gold/amber for dark images, cool teal for bright images
      accentHue = isDark ? 0.08 : 0.55;
    }

    // Calculate accent saturation: higher when image has more color, minimum floor for vibrancy
    const accentSat = Math.max(0.5, Math.min(1, avgSat * 2.5));
    // Accent lightness: always mid-dark for maximum contrast against both dark and light
    const accentLight = 0.40;
    const [ar, ag, ab] = hslToRgb(accentHue, accentSat, accentLight);
    const accent = { r: clamp(ar), g: clamp(ag), b: clamp(ab) };

    // Secondary: complementary (opposite hue), same saturation, slightly different lightness
    const secHue = (accentHue + 0.5) % 1;
    const secLight = isDark ? 0.55 : 0.60;
    const [sr, sg, sb] = hslToRgb(secHue, accentSat * 0.55, secLight);
    const secondary = { r: clamp(sr), g: clamp(sg), b: clamp(sb) };

    // Muted: same hue as accent, low saturation, higher lightness for subtle backgrounds
    const mutSat = 0.12;
    const mutLight = isDark ? 0.35 : 0.72;
    const [mr, mg, mb] = hslToRgb(accentHue, mutSat, mutLight);
    const muted = { r: clamp(mr), g: clamp(mg), b: clamp(mb) };

    // Overlay: accent-tinted dark/light to blend with background instead of pure black/white
    const overlayStrength = Math.max(0.18, 0.35 - avgSat * 0.2);
    const [or, og, ob] = hslToRgb(accentHue, 0.15, isDark ? 0.08 : 0.92);
    const overlay = { r: clamp(or), g: clamp(og), b: clamp(ob) };

    return { isDark, brightness, accent, secondary, muted, overlay };
  } catch {
    return { isDark: false, brightness: 0.7, accent: { r: 0.75, g: 0.2, b: 0.2 }, secondary: { r: 0.2, g: 0.5, b: 0.75 }, muted: { r: 0.8, g: 0.8, b: 0.8 }, overlay: { r: 0.95, g: 0.95, b: 0.95 } };
  }
}

export const prerender = false;

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

    const ticketData = await pgGet<Record<string, any>>("tickets", registrant.ticket);
    const ticketName = ticketData?.name || "GRATIS";

    const s = await pgGetSettings();
    const year = s.eventYear || "2026";
    let bgUrl = s.ticketBg || "";

    // Resolve relative image URLs
    if (bgUrl && bgUrl.startsWith("/")) {
      try { const u = new URL(request.url); bgUrl = u.protocol + "//" + u.host + bgUrl; } catch {}
    }

    const palette = bgUrl ? await analyzeImage(bgUrl) : { isDark: false, brightness: 0.7, accent: { r: 0.75, g: 0.2, b: 0.2 }, secondary: { r: 0.2, g: 0.5, b: 0.75 }, muted: { r: 0.8, g: 0.8, b: 0.8 }, overlay: { r: 0.95, g: 0.95, b: 0.95 } };
    const { isDark, brightness, accent, secondary, muted, overlay } = palette;
    const cText = isDark ? rgb(1, 1, 1) : rgb(0.06, 0.06, 0.08);
    const cTextMuted = isDark ? rgb(0.78, 0.78, 0.80) : rgb(0.40, 0.40, 0.44);
    const cAccent = rgb(accent.r, accent.g, accent.b);
    const cSecondary = rgb(secondary.r, secondary.g, secondary.b);
    const cMuted = rgb(muted.r, muted.g, muted.b);
    const cOverlay = rgb(overlay.r, overlay.g, overlay.b);
    const cWhite = rgb(1, 1, 1);
    const overlayStrength = Math.max(0.15, 0.32 - brightness * 0.15);

    const pdfDoc = await PDFDocument.create();
    const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const PW = 500;
    const PH = 780;
    const page = pdfDoc.addPage([PW, PH]);

    // Background image with adaptive tinted overlay
    if (bgUrl) {
      try {
        const res = await fetch(bgUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const png = await sharp(buf).resize(PW, PH, { fit: "fill" }).png().toBuffer();
          const img = await pdfDoc.embedPng(png);
          page.drawImage(img, { x: 0, y: 0, width: PW, height: PH });
          // Tinted overlay — blends accent color instead of pure black/white
          page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: cOverlay, opacity: overlayStrength });
        }
      } catch (e) { console.error("ticket bg error:", e); }
    }

    // Vignette — darker at edges for focus
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: isDark ? rgb(0, 0, 0) : cOverlay, opacity: isDark ? 0.06 : 0.04 });

    // Header bar with accent fill + secondary top accent line
    page.drawRectangle({ x: 0, y: PH - 100, width: PW, height: 100, color: cAccent, opacity: 0.22 });
    page.drawRectangle({ x: 0, y: PH - 100, width: PW, height: 4, color: cSecondary });
    page.drawText("KKR RPPI", { x: 30, y: PH - 50, size: 22, font: fontB, color: cText });
    page.drawText(year, { x: 32, y: PH - 76, size: 13, font: fontR, color: cTextMuted });

    // Ticket type badge — filled + accent border
    page.drawRectangle({ x: PW - 155, y: PH - 82, width: 125, height: 28, color: cSecondary, opacity: 0.4 });
    page.drawRectangle({ x: PW - 155, y: PH - 82, width: 125, height: 28, borderColor: cAccent, borderWidth: 1.5 });
    page.drawText("TIKET MASUK", { x: PW - 148, y: PH - 74, size: 11, font: fontB, color: cText });
    page.drawText(ticketName.toUpperCase(), { x: PW - 148, y: PH - 89, size: 8, font: fontR, color: cTextMuted });

    // Dual separator line
    page.drawRectangle({ x: 50, y: PH - 118, width: PW - 100, height: 1, color: cMuted, opacity: 0.45 });
    page.drawRectangle({ x: 48, y: PH - 114, width: PW - 96, height: 1, color: cAccent, opacity: 0.18 });

    // Registrant name — large and prominent
    page.drawText("NAMA", { x: 30, y: PH - 150, size: 9, font: fontR, color: cTextMuted });
    page.drawText(String(registrant.name || "-").toUpperCase(), { x: 30, y: PH - 180, size: 20, font: fontB, color: cText });

    // ID Ticket with accent underline
    page.drawText("ID TIKET", { x: PW - 210, y: PH - 150, size: 9, font: fontR, color: cTextMuted });
    page.drawText(String(registrant.id || "-"), { x: PW - 210, y: PH - 172, size: 11, font: fontB, color: cText });
    page.drawRectangle({ x: PW - 210, y: PH - 178, width: 180, height: 2.5, color: cAccent, opacity: 0.45 });

    // Left decorative vertical bar
    page.drawRectangle({ x: 0, y: PH - 680, width: 4, height: 460, color: cSecondary, opacity: 0.10 });

    // QR Code section
    try {
      const qrBuf = await QRCode.toBuffer(registrant.id, {
        width: 400, margin: 2,
        color: { dark: isDark ? "#ffffff" : "#141416", light: isDark ? "#00000000" : "#ffffff" },
      });
      const qrImg = await pdfDoc.embedPng(qrBuf);
      const qrS = 170;
      const qrX = (PW - qrS) / 2;
      const qrY = (PH - qrS) / 2 - 20;

      page.drawText("Scan untuk Check-in", {
        x: (PW - 96) / 2, y: qrY + qrS + 20, size: 11, font: fontB, color: cAccent,
      });
      page.drawRectangle({ x: qrX - 10, y: qrY - 10, width: qrS + 20, height: qrS + 20, color: cWhite, opacity: 0.92, borderColor: cMuted, borderWidth: 1 });
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrS, height: qrS });
    } catch (qrErr) {
      console.error("QR generation failed:", qrErr);
    }

    // Footer with secondary background + accent top line
    page.drawRectangle({ x: 0, y: 0, width: PW, height: 44, color: cSecondary, opacity: 0.18 });
    page.drawRectangle({ x: 0, y: 44, width: PW, height: 2, color: cAccent, opacity: 0.35 });
    page.drawText("Terima kasih telah mendaftar. Sampai jumpa di KKR RPPI! Tuhan Yesus memberkati.", {
      x: 30, y: 16, size: 9, font: fontR, color: cText,
    });

    const pdfBytes = await pdfDoc.save();
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tiket-${registrant.id}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("ticket-pdf error:", err);
    return new Response("Maaf, terjadi kesalahan saat membuat tiket PDF. Silakan coba lagi. (" + String(err).slice(0, 100) + ")", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
};