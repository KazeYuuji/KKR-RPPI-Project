import { defineMiddleware } from "astro/middleware";
import { getAdminFromRequest } from "./lib/auth";
import { checkRateLimit, isValidOrigin, MAX_BODY_SIZE } from "./lib/security";

const protectedPaths = ["/dashboard", "/api/stats", "/api/upload"];
const apiPrefix = "/api";

function withSecurityHeaders(res: Response): Response {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=(self)");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://www.openstreetmap.org https://openstreetmap.org",
    "font-src 'self'",
    "form-action 'self'",
    "frame-src https://www.openstreetmap.org https://maps.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "connect-src 'self' https://nominatim.openstreetmap.org https://generativelanguage.googleapis.com",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url.pathname;
  const method = context.request.method;
  const ip = context.clientAddress || context.request.headers.get("x-forwarded-for") || "unknown";

  // ---- Global rate limiting per IP ----
  if (url.startsWith(apiPrefix)) {
    const { allowed } = checkRateLimit(`global:${ip}`, 200, 60_000);
    if (!allowed) {
      return withSecurityHeaders(new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      }));
    }
  }

  // ---- Body size limit (exclude file uploads) ----
  if (["POST", "PUT", "PATCH"].includes(method) && !url.startsWith("/api/upload")) {
    const te = context.request.headers.get("transfer-encoding");
    if (te?.toLowerCase() === "chunked") {
      return withSecurityHeaders(new Response(JSON.stringify({ error: "Transfer-Encoding chunked not supported for this endpoint" }), {
        status: 411, headers: { "Content-Type": "application/json" },
      }));
    }
    const rawLen = context.request.headers.get("content-length") || "0";
    const contentLength = parseInt(rawLen, 10);
    if (isNaN(contentLength) || contentLength > MAX_BODY_SIZE) {
      return withSecurityHeaders(new Response(JSON.stringify({ error: "Request body too large" }), {
        status: 413, headers: { "Content-Type": "application/json" },
      }));
    }
  }

  // ---- CSRF / Origin validation for state-changing API requests ----
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && url.startsWith(apiPrefix)) {
    if (!url.startsWith("/api/auth/") && !isValidOrigin(context.request)) {
      return withSecurityHeaders(new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { "Content-Type": "application/json" },
      }));
    }
  }

  // ---- Public GET endpoints (no auth required) ----
  if ((url.startsWith("/api/tickets") || url.startsWith("/api/settings") || url.startsWith("/api/speakers") || url.startsWith("/api/sponsors") || url.startsWith("/api/altar-servers") || url.startsWith("/api/uploads") || url.startsWith("/api/geocode")) && method === "GET") {
    const response = await next();
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response;
  }

  // ---- Public POST registration ----
  if (url.startsWith("/api/chat") && method === "POST") {
    return next();
  }

  if (url.startsWith("/api/registrants") && method === "POST") {
    const { allowed } = checkRateLimit(`register:${ip}`, 10, 60_000);
    if (!allowed) {
      return withSecurityHeaders(new Response(JSON.stringify({ error: "Too many registration attempts" }), {
        status: 429, headers: { "Content-Type": "application/json" },
      }));
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
    url.startsWith("/api/ticket-pdf") ||
    (url.startsWith("/api/tickets") && method !== "GET") ||
    (url.startsWith("/api/settings") && method !== "GET") ||
    (url.startsWith("/api/speakers") && method !== "GET") ||
    (url.startsWith("/api/sponsors") && method !== "GET") ||
    (url.startsWith("/api/altar-servers") && method !== "GET");

  if (isProtected) {
    const admin = getAdminFromRequest(context.request);
    if (!admin) {
      if (url.startsWith(apiPrefix)) {
        return withSecurityHeaders(new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { "Content-Type": "application/json" },
        }));
      }
      return withSecurityHeaders(context.redirect("/login"));
    }
    context.locals.admin = admin;

    // Rate limit per admin action
    const { allowed } = checkRateLimit(`admin:${admin.username}:${ip}`, 60, 60_000);
    if (!allowed) {
      return withSecurityHeaders(new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429, headers: { "Content-Type": "application/json" },
      }));
    }
  }

  const response = await next();

  // ---- Security headers ----
  withSecurityHeaders(response);
  return response;
});
