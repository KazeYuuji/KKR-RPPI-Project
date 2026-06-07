import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { minioGet } from "./minio-db";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const JWT_EXPIRES = "24h";
const BCRYPT_ROUNDS = 12;

export interface AdminPayload {
  id: string;
  username: string;
  email: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!hash || hash.length < 20) return false;
  return bcrypt.compareSync(password, hash);
}

export function signToken(payload: AdminPayload): string {
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256", expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as AdminPayload;
  } catch {
    return null;
  }
}

export async function authenticateAdmin(username: string, password: string): Promise<AdminPayload | null> {
  if (!username || typeof username !== "string" || !password || typeof password !== "string") return null;
  const admin = await minioGet<Record<string, any>>(`admins/${username}.json`);
  if (!admin || !admin.password) return null;
  if (!verifyPassword(password, admin.password)) return null;
  return { id: admin.id, username: admin.username, email: admin.email || "" };
}

export function getAdminFromRequest(request: Request): AdminPayload | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)__Secure-token=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}
