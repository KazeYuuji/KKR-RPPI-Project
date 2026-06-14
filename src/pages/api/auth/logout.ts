import type { APIRoute } from "astro";
import { adminCookieName } from "../../../lib/auth";

export const POST: APIRoute = async () => {
  const cookieName = adminCookieName();
  const secureFlag = cookieName.startsWith("__Secure-") ? "; Secure" : "";
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie",
    `${cookieName}=; HttpOnly${secureFlag}; Path=/; SameSite=Strict; Max-Age=0`);

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
