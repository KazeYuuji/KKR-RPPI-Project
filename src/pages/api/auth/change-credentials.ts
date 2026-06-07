import type { APIRoute } from "astro";
import { getAdminFromRequest, verifyPassword, hashPassword, signToken } from "../../../lib/auth";
import { minioGet, minioSet, minioDelete } from "../../../lib/minio-db";

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { current_password, new_username, new_password } = body;

    if (!current_password) {
      return new Response(JSON.stringify({ error: "Password saat ini wajib diisi" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const record = await minioGet<Record<string, any>>(`admins/${admin.username}.json`);
    if (!record || !verifyPassword(current_password, record.password)) {
      return new Response(JSON.stringify({ error: "Password saat ini salah" }), {
        status: 403, headers: { "Content-Type": "application/json" },
      });
    }

    const updated: Record<string, any> = {
      ...record,
      updated_at: new Date().toISOString(),
    };

    let newTokenUsername = admin.username;

    if (new_username && new_username.trim() !== admin.username) {
      const sanitized = new_username.trim();
      if (sanitized.length < 3) {
        return new Response(JSON.stringify({ error: "Username minimal 3 karakter" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      const existing = await minioGet(`admins/${sanitized}.json`);
      if (existing) {
        return new Response(JSON.stringify({ error: "Username sudah digunakan" }), {
          status: 409, headers: { "Content-Type": "application/json" },
        });
      }
      updated.username = sanitized;
      newTokenUsername = sanitized;
    }

    if (new_password) {
      if (new_password.length < 8) {
        return new Response(JSON.stringify({ error: "Password minimal 8 karakter" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      updated.password = hashPassword(new_password);
    }

    const oldKey = `admins/${admin.username}.json`;
    const newKey = new_username && new_username.trim() !== admin.username
      ? `admins/${new_username.trim()}.json`
      : oldKey;

    await minioSet(newKey, updated);

    if (newKey !== oldKey) {
      await minioDelete(oldKey);
    }

    const newToken = signToken({
      id: updated.id,
      username: newTokenUsername,
      email: updated.email || "",
    });

    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie",
      `__Secure-token=${newToken}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);

    const messages: string[] = [];
    if (new_username && new_username.trim() !== admin.username) messages.push("Username berhasil diubah");
    if (new_password) messages.push("Password berhasil diubah");

    return new Response(JSON.stringify({ success: true, message: messages.join(" dan ") || "Tidak ada perubahan" }), {
      status: 200, headers,
    });
  } catch (err) {
    console.error("POST change-credentials error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
