import type { APIRoute } from "astro";
import { getAdminFromRequest } from "../../../lib/auth";
import { S3Client, ListBucketsCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "http://cdn.kediritechnopark.com:9002";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "kkr-rppi";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "";

export const GET: APIRoute = async ({ request }) => {
  const admin = getAdminFromRequest(request);
  if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const results: Record<string, any> = {
    endpoint: MINIO_ENDPOINT,
    bucket: MINIO_BUCKET,
    hasCredentials: !!(MINIO_ACCESS_KEY && MINIO_SECRET_KEY),
    tests: {}
  };

  if (!results.hasCredentials) {
    results.error = "MINIO_ACCESS_KEY or MINIO_SECRET_KEY not set";
    return new Response(JSON.stringify(results, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  try {
    const s3 = new S3Client({
      endpoint: MINIO_ENDPOINT,
      credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
      region: "us-east-1",
      forcePathStyle: true,
    });

    results.tests.listBuckets = await s3.send(new ListBucketsCommand())
      .then(r => ({ ok: true, buckets: (r.Buckets || []).map(b => b.Name) }))
      .catch(e => ({ ok: false, error: e.message, code: e.code }));

    if (results.tests.listBuckets.ok && results.tests.listBuckets.buckets?.includes(MINIO_BUCKET)) {
      const testKey = `_diag_${Date.now()}.txt`;
      results.tests.putObject = await s3.send(new PutObjectCommand({
        Bucket: MINIO_BUCKET, Key: testKey, Body: Buffer.from("ok"), ContentType: "text/plain"
      })).then(() => ({ ok: true }))
        .catch(e => ({ ok: false, error: e.message, code: e.code }));

      if (results.tests.putObject.ok) {
        results.tests.deleteObject = await s3.send(new DeleteObjectCommand({
          Bucket: MINIO_BUCKET, Key: testKey
        })).then(() => ({ ok: true }))
          .catch(e => ({ ok: false, error: e.message }));
      }
    }

    if (results.tests.listBuckets.ok && !results.tests.listBuckets.buckets?.includes(MINIO_BUCKET)) {
      results.warning = `Bucket "${MINIO_BUCKET}" not found in available buckets`;
    }
  } catch (e: any) {
    results.tests.s3Init = { ok: false, error: e.message };
  }

  results.healthy = Object.values(results.tests).every((t: any) => t.ok !== false);
  return new Response(JSON.stringify(results, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
};
