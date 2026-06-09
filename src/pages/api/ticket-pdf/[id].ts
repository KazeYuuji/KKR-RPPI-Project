import type { APIRoute } from "astro";
import { minioGet, minioListAll } from "../../../lib/minio-db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { isValidId } from "../../../lib/security";

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id || !isValidId(id)) {
    return new Response("ID tidak valid", { status: 404 });
  }

  const registrant = await minioGet<Record<string, any>>(`registrants/${id}.json`);
  if (!registrant) {
    return new Response("Pendaftar tidak ditemukan", { status: 404 });
  }

  const ticketData = await minioGet<Record<string, any>>(`tickets/${registrant.ticket}.json`);
  const ticketName = ticketData?.name || registrant.ticket;

  const settingsList = await minioListAll<Record<string, string>>("settings/");
  const settings: Record<string, string> = {};
  for (const s of settingsList) if (s.key) settings[s.key] = s.value;

  const venue = settings.locVenue || "Kediri";
  const date = settings.locDate || "Sabtu, 10 Januari 2026";
  const time = settings.locTime || "08:00 - 12:30 WIB";
  const address = settings.locAddress || settings.locVenue || "Jl. Himalaya No.06, Kediri";
  const eventYear = settings.eventYear || new Date().getFullYear().toString();

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([400, 680]);
  const { width, height } = page.getSize();
  const dark = rgb(0.1, 0.1, 0.12);
  const gray = rgb(0.45, 0.45, 0.48);
  const lightBg = rgb(0.97, 0.97, 0.98);
  const white = rgb(1, 1, 1);
  const accent = rgb(0.8, 0.3, 0.3);

  page.drawRectangle({ x: 0, y: 0, width, height, color: lightBg });
  page.drawRectangle({ x: 0, y: height - 160, width, height: 160, color: dark });
  page.drawText("✝", { x: 30, y: height - 60, size: 32, color: accent });
  page.drawText("KKR RPPI", { x: 75, y: height - 50, size: 22, font, color: white });
  page.drawText(eventYear, { x: 75, y: height - 80, size: 14, font, color: rgb(0.9, 0.5, 0.5) });
  page.drawText("TIKET MASUK", { x: 30, y: height - 120, size: 12, font: fontReg, color: rgb(0.7, 0.7, 0.7) });
  page.drawText("GRATIS", { x: width - 80, y: height - 120, size: 14, font, color: rgb(0.3, 0.85, 0.5) });
  page.drawRectangle({ x: 30, y: 430, width: width - 60, height: 1, color: rgb(0.85, 0.85, 0.88) });

  let yPos = 400;
  const fields = [
    { label: "ID TIKET", value: registrant.id },
    { label: "NAMA", value: registrant.name },
    { label: "JENIS TIKET", value: ticketName },
    { label: "PARTISIPAN", value: registrant.participant_type === "Student" ? "Pelajar" : "Umum" },
    { label: "TANGGAL", value: date },
    { label: "WAKTU", value: time },
    { label: "LOKASI", value: venue },
    { label: "ALAMAT", value: address },
  ];
  for (let i = 0; i < fields.length; i++) {
    const isEven = i % 2 === 0;
    if (isEven) {
      page.drawRectangle({ x: 30, y: yPos - 6, width: width - 60, height: 30, color: white });
    }
    page.drawText(fields[i].label, { x: 35, y: yPos, size: 8, font: fontReg, color: gray });
    page.drawText(fields[i].value, { x: 35, y: yPos - 13, size: 10, font, color: dark });
    yPos -= 36;
  }

  const qrBuffer = await QRCode.toBuffer(registrant.id, {
    width: 240, margin: 2,
    color: { dark: "#1a1a1f", light: "#f7f7f8" },
  });
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const qrSize = 110;
  const qrX = width - 30 - qrSize;
  const qrY = 48;
  page.drawRectangle({ x: qrX - 6, y: qrY - 6, width: qrSize + 12, height: qrSize + 12, color: white });
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  page.drawText("Scan untuk check-in", { x: qrX, y: qrY - 12, size: 7, font: fontReg, color: gray });

  page.drawRectangle({ x: 0, y: 0, width, height: 40, color: dark });
  page.drawText("Terima kasih telah mendaftar. Sampai jumpa di KKR RPPI!", { x: 30, y: 14, size: 8, font: fontReg, color: gray });

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tiket-${registrant.id}.pdf"`,
      "Cache-Control": "no-cache",
    },
  });
};
