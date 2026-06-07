import type { APIRoute } from "astro";
import { downloadFromMinIO } from "../../../lib/minio-db";

export const GET: APIRoute = async ({ params }) => {
  const filePath = params.path as string;
  if (!filePath || filePath.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const result = await downloadFromMinIO(`uploads/${filePath}`);
    if (!result) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(result.buffer, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
