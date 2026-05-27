import { g as getDb } from './db_4_NgtA8M.mjs';

const GET = async () => {
  const db = getDb();
  const total = (await db.execute("SELECT COUNT(*) as c FROM registrants")).rows[0];
  const verified = (await db.execute("SELECT COUNT(*) as c FROM registrants WHERE status = 'Verified'")).rows[0];
  const checkedIn = (await db.execute("SELECT COUNT(*) as c FROM registrants WHERE checked_in = 1")).rows[0];
  const sponsorCount = (await db.execute("SELECT COUNT(*) as c FROM sponsors")).rows[0];
  return new Response(JSON.stringify({
    totalRegistrants: total.c,
    verified: verified.c,
    pending: total.c - verified.c,
    checkedIn: checkedIn.c,
    sponsorCount: sponsorCount.c
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
