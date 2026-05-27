import { a as authenticateAdmin, s as signToken } from './auth_DE68QUa2.mjs';

const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, password } = body;
    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Username dan password wajib diisi" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const admin = await authenticateAdmin(username, password);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Username atau password salah" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const token = signToken(admin);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`);
    return new Response(JSON.stringify({ success: true, admin }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
