import type { APIRoute } from "astro";
import { pgList } from "../../../lib/pg-db";
import { getAdminFromRequest } from "../../../lib/auth";
import * as XLSX from "xlsx";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    const registrants = await pgList<Record<string, any>>("registrants", "created_at DESC");

    const rows = registrants.map((r, i) => ({
      No: i + 1,
      "ID Tiket": String(r.id),
      Nama: r.name || "",
      Email: r.email || "",
      WhatsApp: r.whatsapp || "",
      Tiket: r.ticket || "",
      "Check-in": r.checked_in ? "Ya" : "Belum",
      "Tanggal Daftar": r.created_at ? new Date(r.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    const colWidths = [
      { wch: 4 }, { wch: 16 }, { wch: 28 }, { wch: 32 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 22 },
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Peserta");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="peserta-kkr-rppi.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("GET registrants export error:", err);
    return new Response(JSON.stringify({ error: "Gagal mengekspor data" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
