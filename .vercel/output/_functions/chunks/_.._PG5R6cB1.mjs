import fs from 'node:fs';
import nodePath from 'node:path';

const UPLOADS_DIR = nodePath.join(process.env.VERCEL ? "/tmp" : process.cwd(), "data", "uploads");
const GET = async ({ params }) => {
  const filePath = params.path;
  if (!filePath || filePath.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const fullPath = nodePath.join(UPLOADS_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    return new Response("Not found", { status: 404 });
  }
  const ext = nodePath.extname(filePath).toLowerCase();
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
  const buffer = fs.readFileSync(fullPath);
  return new Response(buffer, {
    status: 200,
    headers: { "Content-Type": mime[ext] || "application/octet-stream", "Cache-Control": "public, max-age=31536000" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
