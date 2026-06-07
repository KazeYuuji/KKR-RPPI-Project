// In-memory rate limiter per IP + endpoint
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function sanitizeString(val: unknown, maxLen = 500): string {
  if (typeof val !== "string") return "";
  return val.trim().replace(/[<>]/g, "").slice(0, maxLen);
}

export function sanitizeEmail(val: unknown): string {
  if (typeof val !== "string") return "";
  const email = val.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function sanitizePhone(val: unknown): string {
  if (typeof val !== "string") return "";
  return val.trim().replace(/[^0-9+]/g, "").slice(0, 20);
}

export function isValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) return false;

  const allowed = [`https://${host}`, `http://${host}`];

  if (origin && !allowed.some(a => origin.startsWith(a))) {
    return false;
  }
  if (!origin && referer && !allowed.some(a => referer.startsWith(a))) {
    return false;
  }

  return true;
}

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
]);
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_BODY_SIZE = 500 * 1024; // 500KB JSON
