import type { APIRoute } from "astro";
import { getAdminFromRequest } from "../../../lib/auth";

export const GET: APIRoute = async ({ request }) => {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ admin }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
