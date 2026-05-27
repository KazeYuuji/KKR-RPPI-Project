import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getRow, getDb } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "kkr-rppi-secret-2026";
const JWT_EXPIRES = "24h";

export interface AdminPayload {
  id: number;
  username: string;
  email: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(payload: AdminPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload;
  } catch {
    return null;
  }
}

export async function authenticateAdmin(username: string, password: string): Promise<AdminPayload | null> {
  const admin = await getRow("SELECT * FROM admins WHERE username = ?", [username]);
  if (!admin || !verifyPassword(password, admin.password)) return null;
  return { id: admin.id, username: admin.username, email: admin.email };
}

export function getAdminFromRequest(request: Request): AdminPayload | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/token=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}
