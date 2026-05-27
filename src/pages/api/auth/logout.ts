import type { APIRoute } from "astro";

export const POST: APIRoute = async () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
