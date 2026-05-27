import fs from 'node:fs';
import nodePath from 'node:path';

const UPLOADS_DIR = nodePath.join(process.env.VERCEL ? "/tmp" : process.cwd(), "data", "uploads");
const POST = async ({ request }) => {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return new Response(JSON.stringify({ error: "Tidak ada file" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const ext = nodePath.extname(file.name) || ".png";
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(nodePath.join(UPLOADS_DIR, filename), buffer);
    return new Response(JSON.stringify({ url: `/api/uploads/${filename}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch {
    return new Response(JSON.stringify({ error: "Gagal upload" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
