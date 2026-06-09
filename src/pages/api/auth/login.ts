import type { APIRoute } from "astro";
import { authenticateAdmin, signToken } from "../../../lib/auth";
import { checkRateLimit } from "../../../lib/security";

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ip = clientAddress || "unknown";

    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Username dan password wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const ipResult = checkRateLimit(`login:${ip}`, 5, 15 * 60_000);
    if (!ipResult.allowed) {
      const retryAfter = Math.max(1, Math.ceil((ipResult.resetAt - Date.now()) / 1000));
      return new Response(JSON.stringify({
        error: "Terlalu banyak percobaan. Coba lagi nanti.",
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      });
    }

    const userResult = checkRateLimit(`login-user:${username.toLowerCase()}`, 5, 15 * 60_000);
    if (!userResult.allowed) {
      const retryAfter = Math.max(1, Math.ceil((userResult.resetAt - Date.now()) / 1000));
      return new Response(JSON.stringify({
        error: "Terlalu banyak percobaan untuk akun ini. Coba lagi nanti.",
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
      return new Response(JSON.stringify({ error: "Username atau password salah" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

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
