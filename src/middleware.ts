import { defineMiddleware } from "astro/middleware";
import { getAdminFromRequest } from "./lib/auth";

const protectedPaths = ["/dashboard", "/api/settings", "/api/registrants", "/api/tickets", "/api/speakers", "/api/sponsors", "/api/upload"];
const apiPrefix = "/api";

export const onRequest = defineMiddleware(async (context, next) => {
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
