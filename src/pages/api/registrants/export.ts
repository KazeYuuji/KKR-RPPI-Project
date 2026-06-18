import type { APIRoute } from "astro";
import { pgList } from "../../../lib/pg-db";
import { getAdminFromRequest } from "../../../lib/auth";

export const prerender = false;

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    const registrants = await pgList<Record<string, any>>("registrants", "created_at DESC");

    const headers = ["ID", "Nama", "Email", "WhatsApp", "Tiket", "Check-in", "Tanggal Daftar"];
    const rows = registrants.map(r => [
      r.id,
      r.name,
      r.email,
      r.whatsapp,
      r.ticket,
      r.checked_in ? "Ya" : "Belum",
      r.created_at,
    ].map(escapeCsv).join(","));

    const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="peserta-kkr-rppi.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("GET registrants export error:", err);
    return new Response(JSON.stringify({ error: "Gagal mengekspor data" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
