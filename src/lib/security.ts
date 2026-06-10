// In-memory rate limiter per IP + endpoint
// NOTE: On serverless (Vercel), this is per-instance, not global.
// Use external Redis/KV for true global rate limiting at scale.
const requestCounts = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requestCounts) {
      if (now > entry.resetAt) requestCounts.delete(key);
    }
  }, 60_000).unref();
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  if (windowMs <= 0 || maxRequests <= 0) {
    return { allowed: true, remaining: Infinity, resetAt: Date.now() };
  }
  const now = Date.now();
  let entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    requestCounts.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: entry.resetAt };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function sanitizeString(val: unknown, maxLen = 500): string {
  if (typeof val !== "string") return "";
  return val.trim()
    .replace(/[<>&"'`]/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .slice(0, maxLen);
}

export function sanitizeEmail(val: unknown): string {
  if (typeof val !== "string") return "";
  const email = val.trim().toLowerCase().slice(0, 254);
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function sanitizePhone(val: unknown): string {
  if (typeof val !== "string") return "";
  return val.trim().replace(/[^0-9+]/g, "").slice(0, 20);
}

export function isValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Dynamic same-origin check: works with any deployment
  const reqUrl = new URL(request.url);
  const dynamicOrigin = reqUrl.origin;

  // Explicitly allowed origins (preview deployments etc.)
  const allowedOrigins = [
    "https://kkrrppi.vercel.app",
    "https://www.kkrrppi.vercel.app",
    "https://kkr-rppi.vercel.app",
    "https://www.kkr-rppi.vercel.app",
  ];

  if (process.env.NODE_ENV === "development") {
    allowedOrigins.push("http://localhost:4321");
  }

  const check = (v: string) =>
    v === dynamicOrigin || v.startsWith(dynamicOrigin + "/") ||
    allowedOrigins.some(a => v === a || v.startsWith(a + "/"));

  if (origin) {
    if (check(origin)) return true;
  }
  if (referer) {
    if (check(referer)) return true;
  }
  return false;
}

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
]);
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_BODY_SIZE = 500 * 1024; // 500KB JSON

export function sanitizeId(val: unknown, maxLen = 100): string {
  if (typeof val !== "string" || !val) return "";
  return val.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, maxLen);
}

export function isValidId(val: unknown): boolean {
  if (typeof val !== "string" || !val) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,98}[a-zA-Z0-9]$/.test(val);
}

export function sanitizeUrl(val: unknown, maxLen = 500): string {
  if (typeof val !== "string") return "";
  const s = val.trim().replace(/[<>&"'`]/g, "").slice(0, maxLen);
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return s;
  } catch {}
  // Allow relative URLs starting with /
  if (/^\/[a-zA-Z0-9_\-./]+$/.test(s)) return s;
  return "";
}
