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

    page.drawRectangle({ x: 6, y: 6, width: PW - 12, height: PH - 12, color: cWhite, borderColor: cAccent, borderWidth: 2 });
    page.drawRectangle({ x: 10, y: 10, width: PW - 20, height: PH - 20, color: cWhite, borderColor: cLight, borderWidth: 1 });

    page.drawRectangle({ x: 12, y: PH - 140, width: PW - 24, height: 128, color: cAccent });
    page.drawText("KKR RPPI", { x: 40, y: PH - 94, size: 26, font: fontB, color: cWhite });
    page.drawText(year, { x: 42, y: PH - 120, size: 14, font: fontO, color: rgb(0.9, 0.7, 0.7) });
    page.drawRectangle({ x: PW - 145, y: PH - 128, width: 115, height: 30, color: cWhite });
    page.drawText("TIKET MASUK", { x: PW - 133, y: PH - 120, size: 13, font: fontB, color: cAccent });
    page.drawText(ticketName.toUpperCase(), { x: PW - 133, y: PH - 137, size: 9, font: fontR, color: cGray });

    const divY = PH - 162;
    page.drawRectangle({ x: M, y: divY, width: PW - 2 * M, height: 1, color: cLight });

    let yy = divY - 30;
    const row = (label: string, value: string) => {
      page.drawText(label, { x: M, y: yy, size: 8, font: fontR, color: cGray });
      page.drawText(String(value || "-"), { x: M, y: yy - 14, size: 11, font: fontB, color: cDark });
      yy -= 36;
    };

    row("NAMA PENDAFTAR", registrant.name);
    row("ID TIKET", registrant.id);
    row("EMAIL", registrant.email);
    row("NOMOR WHATSAPP", registrant.whatsapp);

    yy -= 4;
    page.drawRectangle({ x: M, y: yy + 6, width: PW - 2 * M, height: 1, color: cLight });
    page.drawText("INFORMASI ACARA", { x: M, y: yy - 8, size: 9, font: fontB, color: cAccent });
    yy -= 30;

    row("LOKASI", venue);
    row("ALAMAT", address);
    row("TANGGAL", date);
    row("WAKTU", time);

    // QR Code (gracefully skip if fails)
    try {
      const qrBuf = await QRCode.toBuffer(registrant.id, { width: 300, margin: 2, color: { dark: "#141416", light: "#ffffff" } });
      const qrImg = await pdfDoc.embedPng(qrBuf);
      const qrS = 120;
      const qrX = PW - M - qrS;
      const qrY = 58;
      page.drawRectangle({ x: qrX - 8, y: qrY - 8, width: qrS + 16, height: qrS + 20, color: cWhite, borderColor: cLight, borderWidth: 1 });
      page.drawImage(qrImg, { x: qrX, y: qrY + 4, width: qrS, height: qrS });
      page.drawText("Scan untuk check-in", { x: qrX, y: qrY - 12, size: 8, font: fontR, color: cGray });
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
