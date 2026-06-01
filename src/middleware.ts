import { defineMiddleware } from "astro/middleware";
import { getAdminFromRequest } from "./lib/auth";
import { initSchema } from "./lib/db";

const protectedPaths = ["/dashboard", "/api/stats", "/api/upload"];
const apiPrefix = "/api";

let schemaInitialized = false;

export const onRequest = defineMiddleware(async (context, next) => {
  if (!schemaInitialized) {
    try {
      await initSchema();
      schemaInitialized = true;
    } catch (e) {
      console.error("Schema init failed:", e);
    }
  }

  const url = context.url.pathname;
  const method = context.request.method;

  // Public GET endpoints
  if ((url.startsWith("/api/tickets") || url.startsWith("/api/settings") || url.startsWith("/api/speakers") || url.startsWith("/api/sponsors")) && method === "GET") {
    return next();
  }

  // Public POST registration endpoint (no action field = new registration)
  if (url.startsWith("/api/registrants") && method === "POST") {
    try {
      const clone = context.request.clone();
      const body = await clone.json();
      if (!body.action) return next();
    } catch {}
    // If it has an action field (checkin), fall through to auth check
  }

  const isProtected = protectedPaths.some((p) => url.startsWith(p)) ||
    url.startsWith("/api/registrants") ||
    (url.startsWith("/api/tickets") && method !== "GET") ||
    (url.startsWith("/api/settings") && method !== "GET") ||
    (url.startsWith("/api/speakers") && method !== "GET") ||
    (url.startsWith("/api/sponsors") && method !== "GET");

  if (isProtected) {
    const admin = getAdminFromRequest(context.request);
    if (!admin) {
      if (url.startsWith(apiPrefix)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return context.redirect("/login");
    }
    context.locals.admin = admin;
  }

  return next();
});
