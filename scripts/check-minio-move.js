import { createClient } from "@libsql/client";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const BUCKET = process.env.MINIO_BUCKET;
const ENDPOINT = process.env.MINIO_ENDPOINT;
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const SECRET_KEY = process.env.MINIO_SECRET_KEY;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN.");
  process.exit(1);
}
if (!BUCKET || !ENDPOINT || !ACCESS_KEY || !SECRET_KEY) {
  console.error("Missing MinIO configuration. Set MINIO_BUCKET, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY.");
  process.exit(1);
}

const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: process.env.MINIO_REGION || "us-east-1",
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

async function listTables() {
  try {
    const res = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    return res.rows.map((r) => r.name);
  } catch (e) {
    const res = await db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    return res.rows.map((r) => r.name);
  }
}

async function countRows(table) {
  try {
    const res = await db.execute(`SELECT COUNT(*) as c FROM ${table}`);
    return res.rows[0].c;
  } catch (e) {
    return null;
  }
}

async function listObjects() {
  const objects = [];
  let token;
  do {
    const resp = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
    if (resp.Contents) {
      objects.push(...resp.Contents.map((o) => ({ key: o.Key, size: o.Size })));
    }
    token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

async function run() {
  const tables = await listTables();
  console.log("DB tables:", tables.join(", "));
  for (const table of tables) {
    const count = await countRows(table);
    console.log(`  ${table}: ${count} rows`);
  }

  const objects = await listObjects();
  console.log(`\nMinIO bucket ${BUCKET} objects count: ${objects.length}`);
  for (const obj of objects) {
    console.log(`  ${obj.key} (${obj.size})`);
  }

  const movedPrefixes = [...new Set(objects.filter((o) => o.key && o.key.startsWith("moved/")).map((o) => o.key.split("/")[1]))].filter(Boolean);
  console.log(`\nFound moved prefixes: ${movedPrefixes.join(", ")}`);
}

run().catch((err) => {
  console.error("Error checking move status:", err);
  process.exit(1);
});
