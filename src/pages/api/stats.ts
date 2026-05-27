import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";

export const GET: APIRoute = async () => {
  const db = getDb();
  const total = (await db.execute("SELECT COUNT(*) as c FROM registrants")).rows[0] as any;
  const verified = (await db.execute("SELECT COUNT(*) as c FROM registrants WHERE status = 'Verified'")).rows[0] as any;
  const checkedIn = (await db.execute("SELECT COUNT(*) as c FROM registrants WHERE checked_in = 1")).rows[0] as any;
  const sponsorCount = (await db.execute("SELECT COUNT(*) as c FROM sponsors")).rows[0] as any;

  return new Response(JSON.stringify({
    totalRegistrants: total.c,
    verified: verified.c,
    pending: total.c - verified.c,
    checkedIn: checkedIn.c,
    sponsorCount: sponsorCount.c,
  }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
