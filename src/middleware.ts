import { defineMiddleware } from "astro/middleware";
import { getAdminFromRequest } from "./lib/auth";
import { initSchema } from "./lib/db";

const protectedPaths = ["/dashboard", "/api/settings", "/api/registrants", "/api/tickets", "/api/speakers", "/api/sponsors", "/api/upload"];
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

  const isProtected = protectedPaths.some((p) => url.startsWith(p));

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
