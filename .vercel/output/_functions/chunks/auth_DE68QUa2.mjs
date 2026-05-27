import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { a as getRow } from './db_4_NgtA8M.mjs';

const JWT_SECRET = process.env.JWT_SECRET || "kkr-rppi-secret-2026";
const JWT_EXPIRES = "24h";
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
async function authenticateAdmin(username, password) {
  const admin = await getRow("SELECT * FROM admins WHERE username = ?", [username]);
  if (!admin || !verifyPassword(password, admin.password)) return null;
  return { id: admin.id, username: admin.username, email: admin.email };
}
function getAdminFromRequest(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/token=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}

export { authenticateAdmin as a, getAdminFromRequest as g, signToken as s };
