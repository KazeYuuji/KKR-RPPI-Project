import type { APIRoute } from "astro";
import { pgGet, pgGetSettings } from "../../../lib/pg-db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { isValidId } from "../../../lib/security";

async function analyzeImage(url: string): Promise<{ avg: number; accent: { r: number; g: number; b: number } }> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const buf = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(buf).resize(50, 50, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true });
    let total = 0;
    let rAcc = 0, gAcc = 0, bAcc = 0;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      total += 0.299 * r + 0.587 * g + 0.114 * b;
      rAcc += r; gAcc += g; bAcc += b;
    }
    const n = data.length / 3;
    return { avg: total / n, accent: { r: rAcc / n / 255, g: gAcc / n / 255, b: bAcc / n / 255 } };
  } catch {
    return { avg: 255, accent: { r: 0.75, g: 0.2, b: 0.2 } };
  }
}

function clamp(v: number): number { return Math.max(0, Math.min(1, v)); }

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

    const isDark = bgUrl ? (await analyzeImage(bgUrl)).avg < 128 : false;
    const cText = isDark ? rgb(1, 1, 1) : rgb(0.08, 0.08, 0.1);
    const cTextMuted = isDark ? rgb(0.8, 0.8, 0.82) : rgb(0.45, 0.45, 0.48);
    const cAccent = isDark ? rgb(1, 1, 1) : rgb(0.75, 0.2, 0.2);
    const cWhite = rgb(1, 1, 1);
    const overlayColor = isDark ? rgb(0, 0, 0) : rgb(1, 1, 1);

    const pdfDoc = await PDFDocument.create();
    const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const PW = 500;
    const PH = 780;
    const page = pdfDoc.addPage([PW, PH]);

    // Background image with overlay
    if (bgUrl) {
      try {
        const res = await fetch(bgUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const png = await sharp(buf).resize(PW, PH, { fit: "fill" }).png().toBuffer();
          const img = await pdfDoc.embedPng(png);
          page.drawImage(img, { x: 0, y: 0, width: PW, height: PH });
          // Overlay for readability
          page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: overlayColor, opacity: 0.25 });
        }
      } catch (e) { console.error("ticket bg error:", e); }
    }

    // Header bar
    page.drawRectangle({ x: 0, y: PH - 100, width: PW, height: 100, color: cAccent, opacity: 0.25 });
    page.drawText("KKR RPPI", { x: 30, y: PH - 50, size: 22, font: fontB, color: cText });
    page.drawText(year, { x: 32, y: PH - 76, size: 13, font: fontR, color: cTextMuted });

    // Ticket type badge
    page.drawRectangle({ x: PW - 155, y: PH - 82, width: 125, height: 28, color: cAccent, opacity: 0.3 });
    page.drawText("TIKET MASUK", { x: PW - 148, y: PH - 74, size: 11, font: fontB, color: cText });
    page.drawText(ticketName.toUpperCase(), { x: PW - 148, y: PH - 89, size: 8, font: fontR, color: cTextMuted });

    // Divider
    page.drawRectangle({ x: 30, y: PH - 115, width: PW - 60, height: 1, color: cTextMuted, opacity: 0.4 });

    // Registrant name - large and prominent
    page.drawText("NAMA", { x: 30, y: PH - 150, size: 9, font: fontR, color: cTextMuted });
    page.drawText(String(registrant.name || "-").toUpperCase(), { x: 30, y: PH - 180, size: 20, font: fontB, color: cText });

    // ID Ticket
    page.drawText("ID TIKET", { x: PW - 210, y: PH - 150, size: 9, font: fontR, color: cTextMuted });
    page.drawText(String(registrant.id || "-"), { x: PW - 210, y: PH - 172, size: 11, font: fontB, color: cText });

    // QR Code
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
      page.drawRectangle({ x: qrX - 10, y: qrY - 10, width: qrS + 20, height: qrS + 20, color: cWhite, opacity: 0.9, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrS, height: qrS });
    } catch (qrErr) {
      console.error("QR generation failed:", qrErr);
    }

    // Footer
    page.drawRectangle({ x: 0, y: 0, width: PW, height: 44, color: cAccent, opacity: 0.2 });
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