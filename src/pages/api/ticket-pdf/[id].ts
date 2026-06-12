import type { APIRoute } from "astro";
import { minioGet, minioListAll } from "../../../lib/minio-db";
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

    const registrant = await minioGet<Record<string, any>>(`registrants/${id}.json`);
    if (!registrant) {
      return new Response("Pendaftar tidak ditemukan", { status: 404, headers: { "Content-Type": "text/plain" } });
    }

    const ticketData = await minioGet<Record<string, any>>(`tickets/${registrant.ticket}.json`);
    const ticketName = ticketData?.name || "GRATIS";

    const settingsList = await minioListAll<Record<string, string>>("settings/");
    const s: Record<string, string> = {};
    for (const x of settingsList) if (x.key) s[x.key] = x.value;

    const venue = s.locVenue || "GPI IMANUEL Kediri";
    const address = s.locAddress || "Jl. Himalaya No.06, Kediri";
    const date = s.locDate || "Sabtu, 10 Januari 2026";
    const time = s.locTime || "08.00 - 12.30 WIB";
    const year = s.eventYear || "2026";

    const pdfDoc = await PDFDocument.create();
    const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontO = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const PW = 500;
    const PH = 780;
    const page = pdfDoc.addPage([PW, PH]);
    const M = 30;
    const cDark = rgb(0.08, 0.08, 0.1);
    const cGray = rgb(0.45, 0.45, 0.48);
    const cLight = rgb(0.92, 0.92, 0.94);
    const cWhite = rgb(1, 1, 1);
    const cAccent = rgb(0.75, 0.2, 0.2);
    const cGold = rgb(0.78, 0.58, 0.16);
    const cGoldLight = rgb(0.85, 0.72, 0.35);

    page.drawRectangle({ x: 6, y: 6, width: PW - 12, height: PH - 12, color: cWhite, borderColor: cAccent, borderWidth: 2 });
    page.drawRectangle({ x: 10, y: 10, width: PW - 20, height: PH - 20, color: cWhite, borderColor: cLight, borderWidth: 1 });

    page.drawLine({ start: { x: 12, y: PH - 144 }, end: { x: PW - 12, y: PH - 144 }, color: cGold, thickness: 1 });
    page.drawLine({ start: { x: 12, y: PH - 12 }, end: { x: PW - 12, y: PH - 12 }, color: cGold, thickness: 1 });

    page.drawRectangle({ x: 12, y: PH - 140, width: PW - 24, height: 128, color: cAccent });
    page.drawText("KKR RPPI", { x: 40, y: PH - 94, size: 28, font: fontB, color: cWhite });
    page.drawText(year, { x: 42, y: PH - 120, size: 14, font: fontO, color: cGoldLight });
    page.drawRectangle({ x: PW - 145, y: PH - 128, width: 115, height: 30, color: cGold });
    page.drawText("TIKET MASUK", { x: PW - 138, y: PH - 120, size: 13, font: fontB, color: cWhite });
    page.drawText(ticketName.toUpperCase(), { x: PW - 138, y: PH - 137, size: 9, font: fontR, color: cGoldLight });

    const divY = PH - 162;
    page.drawRectangle({ x: M, y: divY, width: PW - 2 * M, height: 1, color: cLight });

    let yy = divY - 30;
    page.drawText("DATA PENDAFTAR", { x: M, y: yy + 4, size: 9, font: fontB, color: cGold });
    yy -= 22;

    const rowRight = (label: string, value: string) => {
      const lx = 260;
      page.drawText(label, { x: lx, y: yy, size: 8, font: fontR, color: cGray });
      page.drawText(String(value || "-"), { x: lx, y: yy - 14, size: 11, font: fontB, color: cDark });
    };

    page.drawText("NAMA LENGKAP", { x: M, y: yy, size: 8, font: fontR, color: cGray });
    page.drawText(String(registrant.name || "-"), { x: M, y: yy - 14, size: 11, font: fontB, color: cDark });
    rowRight("ID TIKET", registrant.id);
    yy -= 36;

    page.drawText("EMAIL", { x: M, y: yy, size: 8, font: fontR, color: cGray });
    page.drawText(String(registrant.email || "-"), { x: M, y: yy - 14, size: 11, font: fontB, color: cDark });
    rowRight("WHATSAPP", registrant.whatsapp);
    yy -= 36;

    yy -= 6;
    page.drawRectangle({ x: M, y: yy + 6, width: PW - 2 * M, height: 1, color: cLight });
    yy -= 4;
    page.drawText("LOKASI & WAKTU", { x: M, y: yy, size: 9, font: fontB, color: cGold });
    yy -= 22;

    page.drawText("TEMPAT", { x: M, y: yy, size: 8, font: fontR, color: cGray });
    page.drawText(venue, { x: M, y: yy - 14, size: 11, font: fontB, color: cDark });
    page.drawText("TANGGAL", { x: 260, y: yy, size: 8, font: fontR, color: cGray });
    page.drawText(date, { x: 260, y: yy - 14, size: 11, font: fontB, color: cDark });
    yy -= 36;

    page.drawText("ALAMAT", { x: M, y: yy, size: 8, font: fontR, color: cGray });
    page.drawText(address, { x: M, y: yy - 14, size: 11, font: fontB, color: cDark });
    page.drawText("WAKTU", { x: 260, y: yy, size: 8, font: fontR, color: cGray });
    page.drawText(time, { x: 260, y: yy - 14, size: 11, font: fontB, color: cDark });
    yy -= 36;

    const infoBottomY = yy + 10;
    page.drawRectangle({ x: M, y: infoBottomY, width: PW - 2 * M, height: 1, color: cLight });

    try {
      const qrBuf = await QRCode.toBuffer(registrant.id, { width: 400, margin: 2, color: { dark: "#141416", light: "#ffffff" } });
      const qrImg = await pdfDoc.embedPng(qrBuf);
      const qrS = 180;
      const qrX = (PW - qrS) / 2;
      const qrY = infoBottomY - qrS - 48;

      page.drawText("Scan QR Code untuk Check-in", {
        x: (PW - 140) / 2, y: qrY + qrS + 24, size: 11, font: fontB, color: cAccent,
      });
      page.drawRectangle({ x: qrX - 10, y: qrY - 10, width: qrS + 20, height: qrS + 46, color: cWhite, borderColor: cGold, borderWidth: 1 });
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrS, height: qrS });
      page.drawText("Tunjukkan QR ini saat datang", {
        x: (PW - 122) / 2, y: qrY - 18, size: 8, font: fontR, color: cGray,
      });
    } catch (qrErr) {
      console.error("QR generation failed (non-fatal):", qrErr);
    }

    page.drawRectangle({ x: 12, y: 12, width: PW - 24, height: 38, color: cAccent });
    page.drawText("Terima kasih telah mendaftar. Sampai jumpa di KKR RPPI! Tuhan Yesus memberkati", {
      x: M, y: 32, size: 9, font: fontR, color: cWhite,
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
