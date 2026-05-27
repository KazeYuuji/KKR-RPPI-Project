import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";

export const GET: APIRoute = async () => {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as c FROM registrants").get() as any).c;
  const verified = (db.prepare("SELECT COUNT(*) as c FROM registrants WHERE status = 'Verified'").get() as any).c;
  const pending = total - verified;
  const checkedIn = (db.prepare("SELECT COUNT(*) as c FROM registrants WHERE checked_in = 1").get() as any).c;
  const sponsorCount = (db.prepare("SELECT COUNT(*) as c FROM sponsors").get() as any).c;

  return new Response(JSON.stringify({
    totalRegistrants: total,
    verified,
    pending,
    checkedIn,
    sponsorCount,
  }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
