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

    const ticketData = await pgGet<Record<string, any>>("tickets", registrant.ticket);
    const ticketName = ticketData?.name || "GRATIS";

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

    // Background gradient: purple (#4C1D95) to dark red (#9F1239)
    const cPurple = rgb(0.298, 0.114, 0.584);
    const cRed = rgb(0.622, 0.071, 0.224);
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = cPurple.r + (cRed.r - cPurple.r) * t;
      const g = cPurple.g + (cRed.g - cPurple.g) * t;
      const b = cPurple.b + (cRed.b - cPurple.b) * t;
      page.drawRectangle({
        x: 0, y: (PH / steps) * i,
        width: PW, height: Math.ceil(PH / steps) + 1,
        color: rgb(r, g, b),
      });
    }

    // Decorative glow blobs
    page.drawRectangle({ x: PW - 80, y: PH - 100, width: 160, height: 160, color: rgb(1, 0.84, 0), opacity: 0.06 });
    page.drawRectangle({ x: -40, y: -40, width: 160, height: 160, color: rgb(1, 0.84, 0), opacity: 0.06 });
    page.drawRectangle({ x: PW - 80, y: -40, width: 140, height: 140, color: rgb(1, 0.84, 0), opacity: 0.04 });

    const cWhite = rgb(1, 1, 1);
    const cGold = rgb(0.98, 0.75, 0.14);
    const cGray = rgb(0.85, 0.82, 0.88);

    // Header
    page.drawText("KKR RPPI", { x: 250 - fontT.widthOfTextAtSize("KKR RPPI", 36) / 2, y: PH - 110, size: 36, font: fontT, color: cWhite });
    page.drawText(year, {
      x: 250 - fontB.widthOfTextAtSize(year, 18) / 2, y: PH - 148, size: 18, font: fontB, color: cGold,
    });

    // Name
    page.drawText("Nama", { x: 40, y: PH - 210, size: 10, font: fontR, color: cGray });
    page.drawText(String(registrant.name || "-").toUpperCase(), {
      x: 40, y: PH - 250, size: 26, font: fontB, color: cWhite,
    });

    // ID Tiket
    page.drawText("ID Tiket", { x: 40, y: PH - 300, size: 10, font: fontR, color: cGray });
    page.drawText(String(registrant.id || "-"), {
      x: 40, y: PH - 326, size: 14, font: fontM, color: cWhite,
    });

    // Two-column: Tanggal | Waktu
    page.drawText("Tanggal", { x: 40, y: PH - 370, size: 10, font: fontR, color: cGray });
    page.drawText(date, { x: 40, y: PH - 392, size: 12, font: fontB, color: cWhite });

    page.drawText("Waktu", { x: 270, y: PH - 370, size: 10, font: fontR, color: cGray });
    page.drawText(time, { x: 270, y: PH - 392, size: 12, font: fontB, color: cWhite });

    // QR Code
    const qrS = 170;
    const qrY = 120;
    try {
      const qrBuf = await QRCode.toBuffer(registrant.id, { width: 400, margin: 2, color: { dark: "#141416", light: "#ffffff" } });
      const qrImg = await pdfDoc.embedPng(qrBuf);
      const qrX = (PW - qrS) / 2;

      page.drawRectangle({ x: qrX - 14, y: qrY - 14, width: qrS + 28, height: qrS + 28, color: cWhite });
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrS, height: qrS });
      qrOk = true;
    } catch (qrErr) {
      console.error("QR generation failed:", qrErr);
    }

    // Divider line
    page.drawRectangle({ x: 40, y: qrY + qrS + 46, width: PW - 80, height: 1, color: cGray, opacity: 0.2 });

    // Footer
    const footY = qrY + qrS + 20;
    page.drawText("Tunjukkan QR ini saat datang", {
      x: 250 - fontB.widthOfTextAtSize("Tunjukkan QR ini saat datang", 11) / 2, y: footY, size: 11, font: fontB, color: cWhite,
    });
    page.drawText("Terima kasih telah mendaftar. Tuhan Yesus memberkati.", {
      x: 250 - fontR.widthOfTextAtSize("Terima kasih telah mendaftar. Tuhan Yesus memberkati.", 9) / 2, y: footY - 18, size: 9, font: fontR, color: cGray,
    });

    // Bottom gold accent bar
    const goldSteps = 20;
    for (let i = 0; i < goldSteps; i++) {
      const t = i / goldSteps;
      const r = 0.98 + (0.96 - 0.98) * t;
      const g = 0.75 + (0.70 - 0.75) * t;
      const b = 0.14 + (0.10 - 0.14) * t;
      page.drawRectangle({
        x: (PW / goldSteps) * i, y: 0,
        width: Math.ceil(PW / goldSteps) + 1, height: 6,
        color: rgb(r, g, b),
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
    return new Response("Maaf, terjadi kesalahan saat membuat tiket PDF. (" + String(err).slice(0, 200) + ")", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
};
