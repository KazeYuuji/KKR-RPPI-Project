import type { APIRoute } from "astro";
import { getAdminFromRequest, verifyPassword, hashPassword, signToken } from "../../../lib/auth";
import { minioGet, minioSet, minioDelete } from "../../../lib/minio-db";
import { checkRateLimit } from "../../../lib/security";

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const ip = clientAddress || request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = checkRateLimit(`change-creds:${admin.username}:${ip}`, 3, 60_000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const current_password = typeof body?.current_password === "string" ? body.current_password : "";
    const new_password = typeof body?.new_password === "string" ? body.new_password : "";
    const new_username = typeof body?.new_username === "string" ? body.new_username.trim() : "";

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

    if (new_username && new_username !== admin.username) {
      if (new_username.length < 3) {
        return new Response(JSON.stringify({ error: "Username minimal 3 karakter" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      const existing = await minioGet(`admins/${new_username}.json`);
      if (existing) {
        return new Response(JSON.stringify({ error: "Username sudah digunakan" }), {
          status: 409, headers: { "Content-Type": "application/json" },
        });
      }
      updated.username = new_username;
      newTokenUsername = new_username;
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
    const newKey = new_username && new_username !== admin.username
      ? `admins/${new_username}.json`
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
    if (new_username && new_username !== admin.username) messages.push("Username berhasil diubah");
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
