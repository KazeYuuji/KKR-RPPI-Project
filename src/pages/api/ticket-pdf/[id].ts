import type { APIRoute } from "astro";
import { pgGet, pgGetSettings } from "../../../lib/pg-db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { isValidId } from "../../../lib/security";

export const prerender = false;

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
    const year = s.eventYear || "2026";
    const date = s.locDate || "Sabtu, 10 Januari 2026";
    const time = s.locTime || "08.00 - 12.30 WIB";

    const pdfDoc = await PDFDocument.create();
    const fontT = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontM = await pdfDoc.embedFont(StandardFonts.Courier);

    const PW = 500;
    const PH = 780;
    const page = pdfDoc.addPage([PW, PH]);

    // Background gradient
    const pR = 0.298, pG = 0.114, pB = 0.584;
    const eR = 0.622, eG = 0.071, eB = 0.224;
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      page.drawRectangle({
        x: 0, y: (PH / 60) * i, width: PW, height: Math.ceil(PH / 60) + 1,
        color: rgb(pR + (eR - pR) * t, pG + (eG - pG) * t, pB + (eB - pB) * t),
      });
    }

    const cW = rgb(1, 1, 1);
    const cGold = rgb(0.98, 0.75, 0.14);
    const cG = rgb(0.82, 0.78, 0.84);

    // ── Header ──
    const tW = fontT.widthOfTextAtSize("KKR RPPI", 36);
    page.drawText("KKR RPPI", { x: (PW - tW) / 2, y: 700, size: 36, font: fontT, color: cW });
    const yW = fontB.widthOfTextAtSize(year, 16);
    page.drawText(year, { x: (PW - yW) / 2, y: 665, size: 16, font: fontB, color: cGold });

    // ── Separator ──
    page.drawRectangle({ x: 50, y: 640, width: PW - 100, height: 1, color: cG, opacity: 0.25 });

    // ── Name ──
    page.drawText("Nama", { x: 40, y: 605, size: 10, font: fontR, color: cG });
    page.drawText(String(registrant.name || "-").toUpperCase(), {
      x: 40, y: 573, size: 22, font: fontB, color: cW,
    });

    // ── ID Tiket ──
    page.drawText("ID Tiket", { x: 40, y: 523, size: 10, font: fontR, color: cG });
    page.drawText(String(registrant.id || "-"), {
      x: 40, y: 498, size: 13, font: fontM, color: cW,
    });

    // ── Separator ──
    page.drawRectangle({ x: 50, y: 478, width: PW - 100, height: 1, color: cG, opacity: 0.25 });

    // ── Tanggal + Waktu (two-column) ──
    page.drawText("Tanggal", { x: 40, y: 448, size: 10, font: fontR, color: cG });
    page.drawText(date, { x: 40, y: 426, size: 12, font: fontB, color: cW });

    page.drawText("Waktu", { x: 270, y: 448, size: 10, font: fontR, color: cG });
    page.drawText(time, { x: 270, y: 426, size: 12, font: fontB, color: cW });

    // ── Separator ──
    page.drawRectangle({ x: 50, y: 400, width: PW - 100, height: 1, color: cG, opacity: 0.25 });

    // ── QR Code ──
    const qrS = 160;
    const qrY = 155;
    try {
      const qrBuf = await QRCode.toBuffer(registrant.id, { width: 400, margin: 2, color: { dark: "#141416", light: "#ffffff" } });
      const qrImg = await pdfDoc.embedPng(qrBuf);
      const qrX = (PW - qrS) / 2;

      page.drawText("Scan QR Code untuk Check-in", {
        x: (PW - fontB.widthOfTextAtSize("Scan QR Code untuk Check-in", 11)) / 2,
        y: qrY + qrS + 24, size: 11, font: fontB, color: cGold,
      });
      page.drawRectangle({ x: qrX - 6, y: qrY - 6, width: qrS + 12, height: qrS + 12, color: cW });
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrS, height: qrS });
    } catch (qrErr) {
      console.error("QR generation failed:", qrErr);
    }

    // ── Footer ──
    page.drawText("Tunjukkan QR ini saat datang", {
      x: (PW - fontB.widthOfTextAtSize("Tunjukkan QR ini saat datang", 11)) / 2,
      y: 136, size: 11, font: fontB, color: cW,
    });
    page.drawText("Terima kasih telah mendaftar. Tuhan Yesus memberkati.", {
      x: (PW - fontR.widthOfTextAtSize("Terima kasih telah mendaftar. Tuhan Yesus memberkati.", 9)) / 2,
      y: 118, size: 9, font: fontR, color: cG,
    });

    // ── Gold bottom bar ──
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      page.drawRectangle({
        x: (PW / 20) * i, y: 0, width: Math.ceil(PW / 20) + 1, height: 6,
        color: rgb(0.98 + (0.96 - 0.98) * t, 0.75 + (0.70 - 0.75) * t, 0.14 + (0.10 - 0.14) * t),
      });
    }

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
    return new Response("Maaf, terjadi kesalahan saat membuat tiket PDF. Silakan coba lagi.", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
};
