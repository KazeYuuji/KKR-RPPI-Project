import { defineMiddleware } from "astro/middleware";
import { getAdminFromRequest } from "./lib/auth";
import { checkRateLimit, isValidOrigin, MAX_BODY_SIZE } from "./lib/security";

const protectedPaths = ["/dashboard", "/api/stats", "/api/upload"];
const apiPrefix = "/api";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url.pathname;
  const method = context.request.method;
  const ip = context.clientAddress || context.request.headers.get("x-forwarded-for") || "unknown";

  // ---- Global rate limiting per IP ----
  if (url.startsWith(apiPrefix)) {
    const { allowed } = checkRateLimit(`global:${ip}`, 200, 60_000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      });
    }
  }

  // ---- Body size limit (exclude file uploads) ----
  if (["POST", "PUT", "PATCH"].includes(method) && !url.startsWith("/api/upload")) {
    const contentLength = parseInt(context.request.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Request body too large" }), {
        status: 413, headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ---- CSRF / Origin validation for state-changing API requests ----
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && url.startsWith(apiPrefix)) {
    if (!isValidOrigin(context.request)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ---- Public GET endpoints ----
  if ((url.startsWith("/api/tickets") || url.startsWith("/api/ticket-pdf") || url.startsWith("/api/settings") || url.startsWith("/api/speakers") || url.startsWith("/api/sponsors") || url.startsWith("/api/altar-servers") || url.startsWith("/api/uploads")) && method === "GET") {
    return next();
  }

  // ---- Public POST registration ----
  if (url.startsWith("/api/registrants") && method === "POST") {
    const { allowed } = checkRateLimit(`register:${ip}`, 10, 60_000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many registration attempts" }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
    try {
      const clone = context.request.clone();
      const body = await clone.json();
      if (!body.action) return next();
    } catch {
      console.error("Middleware parse registrants body error");
    }
  }

  // ---- Auth check for protected routes ----
  const isProtected = protectedPaths.some((p) => url.startsWith(p)) ||
    url.startsWith("/api/registrants") ||
    (url.startsWith("/api/tickets") && method !== "GET") ||
    (url.startsWith("/api/settings") && method !== "GET") ||
    (url.startsWith("/api/speakers") && method !== "GET") ||
    (url.startsWith("/api/sponsors") && method !== "GET") ||
    (url.startsWith("/api/altar-servers") && method !== "GET");

  if (isProtected) {
    const admin = getAdminFromRequest(context.request);
    if (!admin) {
      if (url.startsWith(apiPrefix)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { "Content-Type": "application/json" },
        });
      }
      return context.redirect("/login");
    }
    context.locals.admin = admin;

    // Rate limit per admin action
    const { allowed } = checkRateLimit(`admin:${admin.username}:${ip}`, 60, 60_000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
  }

  const response = await next();

  // ---- Security headers ----
  response.headers.set("X-Middleware-Version", "2");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=(self)");

  // Content-Security-Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    "font-src 'self'",
    "form-action 'self'",
    "frame-src https://www.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "connect-src 'self' https://nominatim.openstreetmap.org",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  return response;
});
