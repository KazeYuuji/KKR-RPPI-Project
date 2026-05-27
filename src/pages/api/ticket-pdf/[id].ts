import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const GET: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;
  if (!id) {
    return new Response("ID tidak ditemukan", { status: 404 });
  }

  const registrantResult = await db.execute("SELECT * FROM registrants WHERE id = ?", [id]);
  const registrant = registrantResult.rows[0] as Record<string, any> | undefined;
  if (!registrant) {
    return new Response("Pendaftar tidak ditemukan", { status: 404 });
  }

  const ticketResult = await db.execute("SELECT * FROM tickets WHERE id = ?", [registrant.ticket]);
  const ticketRow = ticketResult.rows[0] as Record<string, any> | undefined;
  const ticketName = ticketRow?.name || registrant.ticket;

  const settingsResult = await db.execute("SELECT * FROM settings");
  const settingsRows = settingsResult.rows as Record<string, string>[];
  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.key] = row.value;

  const venue = settings.locVenue || "SMK PGRI 1 Kediri";
  const date = settings.locDate || "Sabtu, 10 Januari 2026";
  const time = settings.locTime || "08:00 - 12:30 WIB";
  const address = "Jl. Himalaya No.06, Kediri";

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([400, 620]);
  const { width, height } = page.getSize();

  const dark = rgb(0.1, 0.1, 0.12);
  const gray = rgb(0.45, 0.45, 0.48);
  const lightBg = rgb(0.97, 0.97, 0.98);
  const white = rgb(1, 1, 1);

  page.drawRectangle({
    x: 0, y: 0, width, height,
    color: lightBg,
  });

  page.drawRectangle({
    x: 0, y: height - 160, width, height: 160,
    color: dark,
  });

  page.drawText("✝", { x: 30, y: height - 60, size: 32, color: rgb(0.8, 0.3, 0.3) });
  page.drawText("KKR RPPI", { x: 75, y: height - 50, size: 22, font, color: white });
  page.drawText("2025/2026", { x: 75, y: height - 80, size: 14, font, color: rgb(0.9, 0.5, 0.5) });

  page.drawText("TIKET MASUK", { x: 30, y: height - 120, size: 12, font: fontReg, color: rgb(0.7, 0.7, 0.7) });
  page.drawText("GRATIS", {
    x: width - 80, y: height - 120, size: 14, font,
    color: rgb(0.3, 0.85, 0.5),
  });

  page.drawRectangle({
    x: 30, y: 370, width: width - 60, height: 1,
    color: rgb(0.85, 0.85, 0.88),
  });

  let yPos = 340;

  const fields = [
    { label: "ID TIKET", value: registrant.id },
    { label: "NAMA", value: registrant.name },
    { label: "JENIS TIKET", value: ticketName },
    { label: "PARTISIPAN", value: registrant.participant_type === "Student" ? "Pelajar" : registrant.participant_type === "Alumni" ? "Alumni" : "Umum" },
    { label: "TANGGAL", value: date },
    { label: "WAKTU", value: time },
    { label: "LOKASI", value: venue },
    { label: "ALAMAT", value: address },
  ];

  for (const field of fields) {
    page.drawRectangle({
      x: 30, y: yPos - 8, width: width - 60, height: 32,
      color: yPos % 64 === 0 ? white : undefined,
    });
    page.drawText(field.label, { x: 35, y: yPos, size: 8, font: fontReg, color: gray });
    page.drawText(field.value, { x: 35, y: yPos - 14, size: 11, font: font, color: dark });
    yPos -= 42;
  }

  page.drawRectangle({
    x: 0, y: 0, width, height: 40,
    color: dark,
  });
  page.drawText("Terima kasih telah mendaftar. Sampai jumpa di KKR RPPI!", {
    x: 30, y: 14, size: 8, font: fontReg, color: gray,
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
};
