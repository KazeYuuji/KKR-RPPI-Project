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

    const pdfDoc = await PDFDocument.create();
    const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const PW = 500;
    const PH = 780;
    const page = pdfDoc.addPage([PW, PH]);

    const cDark = rgb(0.06, 0.06, 0.08);
    const cGray = rgb(0.50, 0.50, 0.52);
    const cLight = rgb(0.93, 0.93, 0.94);
    const cWhite = rgb(1, 1, 1);
    const cAccent = rgb(0.70, 0.15, 0.15);
    const cGold = rgb(0.78, 0.58, 0.16);
    const cParchment = rgb(0.97, 0.96, 0.94);

    // Outer frame
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: cParchment });
    page.drawRectangle({ x: 8, y: 8, width: PW - 16, height: PH - 16, color: cWhite, borderColor: cAccent, borderWidth: 1.5 });
    page.drawRectangle({ x: 12, y: 12, width: PW - 24, height: PH - 24, color: cWhite, borderColor: cLight, borderWidth: 1 });

    // Top gold line
    page.drawLine({ start: { x: 12, y: PH - 145 }, end: { x: PW - 12, y: PH - 145 }, color: cGold, thickness: 0.8 });

    // Header band
    page.drawRectangle({ x: 12, y: PH - 142, width: PW - 24, height: 100, color: cAccent });
    page.drawRectangle({ x: 12, y: PH - 42, width: PW - 24, height: 4, color: cGold });
    page.drawText("KKR RPPI", { x: 40, y: PH - 80, size: 30, font: fontB, color: cWhite });
    page.drawText(year, { x: 42, y: PH - 112, size: 12, font: fontR, color: rgb(0.9, 0.7, 0.7) });

    // Ticket badge
    page.drawRectangle({ x: PW - 150, y: PH - 122, width: 118, height: 26, color: cGold });
    page.drawText("TIKET MASUK", { x: PW - 143, y: PH - 115, size: 11, font: fontB, color: cWhite });
    page.drawText(ticketName.toUpperCase(), { x: PW - 143, y: PH - 131, size: 8, font: fontR, color: rgb(0.95, 0.85, 0.65) });

    // Divider
    const divY = PH - 160;
    page.drawRectangle({ x: 40, y: divY, width: PW - 80, height: 1, color: cLight });

    // Name section
    let yPos = divY - 28;
    page.drawText("NAMA", { x: 40, y: yPos + 4, size: 8, font: fontR, color: cGray });
    yPos -= 18;
    page.drawText(String(registrant.name || "-").toUpperCase(), {
      x: 40, y: yPos, size: 18, font: fontB, color: cDark,
    });
    yPos -= 8;
    page.drawRectangle({ x: 40, y: yPos, width: 200, height: 2, color: cAccent, opacity: 0.3 });

    // ID section (right side)
    page.drawText("ID TIKET", { x: 280, y: yPos + 32, size: 8, font: fontR, color: cGray });
    page.drawText(String(registrant.id || "-"), {
      x: 280, y: yPos + 10, size: 13, font: fontB, color: cDark,
    });
    page.drawRectangle({ x: 280, y: yPos, width: 180, height: 2, color: cGold, opacity: 0.5 });

    // QR code area
    const qrTop = yPos - 40;
    page.drawLine({ start: { x: 30, y: qrTop + 12 }, end: { x: PW - 30, y: qrTop + 12 }, color: cLight, thickness: 1 });

    try {
      const qrBuf = await QRCode.toBuffer(registrant.id, { width: 400, margin: 2, color: { dark: "#141416", light: "#ffffff" } });
      const qrImg = await pdfDoc.embedPng(qrBuf);
      const qrS = 160;
      const qrX = (PW - qrS) / 2;
      const qrY = qrTop - qrS - 12;

      // QR card
      page.drawRectangle({ x: qrX - 16, y: qrY - 14, width: qrS + 32, height: qrS + 68, color: cWhite, borderColor: cGold, borderWidth: 1 });
      page.drawRectangle({ x: qrX - 14, y: qrY - 12, width: qrS + 28, height: qrS + 64, color: cWhite, borderColor: cLight, borderWidth: 1 });

      page.drawText("Scan QR Code untuk Check-in", {
        x: (PW - 140) / 2, y: qrY + qrS + 32, size: 10, font: fontB, color: cAccent,
      });
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrS, height: qrS });
      page.drawText("Tunjukkan QR ini saat datang", {
        x: (PW - 118) / 2, y: qrY - 8, size: 8, font: fontR, color: cGray,
      });
    } catch (qrErr) {
      console.error("QR generation failed:", qrErr);
    }

    // Footer
    page.drawRectangle({ x: 12, y: 12, width: PW - 24, height: 38, color: cAccent });
    page.drawRectangle({ x: 12, y: 50, width: PW - 24, height: 3, color: cGold });
    page.drawText("Terima kasih telah mendaftar. Sampai jumpa di KKR RPPI! Tuhan Yesus memberkati", {
      x: 40, y: 32, size: 9, font: fontR, color: cWhite,
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
    return new Response("Maaf, terjadi kesalahan saat membuat tiket PDF. Silakan coba lagi.", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
};
