import type { APIRoute } from "astro";
import { authenticateAdmin, signToken, checkRateLimit, recordFailedAttempt, resetRateLimit } from "../../../lib/auth";

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json();
    const { username, password } = body;
    const ip = clientAddress || request.headers.get("x-forwarded-for") || "unknown";

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Username dan password wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const { allowed, retryAfter } = checkRateLimit(ip);
    if (!allowed) {
      return new Response(JSON.stringify({
        error: `Terlalu banyak percobaan. Coba lagi ${retryAfter} detik lagi.`,
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      });
    }

    const admin = await authenticateAdmin(username, password);
    if (!admin) {
      recordFailedAttempt(ip);
      return new Response(JSON.stringify({ error: "Username atau password salah" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    resetRateLimit(ip);
    const token = signToken(admin);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie",
      `__Secure-token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);

    return new Response(JSON.stringify({ success: true, admin }), { status: 200, headers });
  } catch (err) {
    console.error("POST login error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
