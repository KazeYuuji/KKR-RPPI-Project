import { createClient } from "@libsql/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL) {
  console.error("Missing TURSO_DATABASE_URL in environment");
  process.exit(1);
}

if (!TURSO_AUTH_TOKEN) {
  console.error("Missing TURSO_AUTH_TOKEN in environment");
  process.exit(1);
}

// MinIO / S3 configuration — prefer explicit env vars, fallback to credentials.json in project root
const DEFAULT_MINIO_ENDPOINT = "http://cdn.kediritechnopark.com:9002";
const candidateCredPaths = [
  process.env.MINIO_CREDS_FILE,
  path.resolve(process.cwd(), "credentials.json"),
  path.resolve((process.env.USERPROFILE || process.env.HOME || "."), "Downloads", "credentials.json"),
  path.resolve(process.cwd(), "..", "credentials.json"),
].filter(Boolean);
let CREDS_PATH = candidateCredPaths.find((p) => fs.existsSync(p));
let minioConfig = {
  accessKeyId: process.env.MINIO_ACCESS_KEY,
  secretAccessKey: process.env.MINIO_SECRET_KEY,
  endpoint: process.env.MINIO_ENDPOINT || DEFAULT_MINIO_ENDPOINT,
  region: process.env.MINIO_REGION || "us-east-1",
  forcePathStyle: (process.env.MINIO_FORCE_PATH_STYLE || "true") === "true",
};
if (CREDS_PATH) {
  try {
    const raw = fs.readFileSync(CREDS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    minioConfig.accessKeyId = minioConfig.accessKeyId || parsed.accessKey || parsed.accessKeyId;
    minioConfig.secretAccessKey = minioConfig.secretAccessKey || parsed.secretKey || parsed.secretKeyId;
    // do not assume endpoint/bucket in the JSON — allow env overrides
  } catch (e) {
    console.warn("Failed to parse credentials file:", e.message);
  }
}

// Env overrides (required): MINIO_ENDPOINT, MINIO_BUCKET
minioConfig.endpoint = process.env.MINIO_ENDPOINT || minioConfig.endpoint;
minioConfig.region = process.env.MINIO_REGION || minioConfig.region;
minioConfig.forcePathStyle = (process.env.MINIO_FORCE_PATH_STYLE || (minioConfig.forcePathStyle ? "true" : "false")) === "true";
const BUCKET = process.env.MINIO_BUCKET;

if (!minioConfig.accessKeyId || !minioConfig.secretAccessKey) {
  console.error("Missing MinIO access key/secret. Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY, or provide credentials.json with accessKey/secretKey.");
  process.exit(1);
}

if (!minioConfig.endpoint) {
  console.error("Missing MINIO endpoint. Set MINIO_ENDPOINT or use the MinIO S3 endpoint at http://cdn.kediritechnopark.com:9002");
  process.exit(1);
}

if (!BUCKET) {
  console.error("Missing MINIO_BUCKET environment variable (target bucket name)");
  process.exit(1);
}

const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

const s3 = new S3Client({
  endpoint: minioConfig.endpoint,
  region: minioConfig.region,
  credentials: { accessKeyId: minioConfig.accessKeyId, secretAccessKey: minioConfig.secretAccessKey },
  forcePathStyle: minioConfig.forcePathStyle,
});

function nowKeyPrefix() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `backups/${ts}`;
}

async function listTables() {
  // Works in SQLite-compatible Turso
  try {
    const res = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    return res.rows.map((r) => r.name);
  } catch (e) {
    // fallback to sqlite_schema
    const res = await db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    return res.rows.map((r) => r.name);
  }
}

async function uploadObject(key, body, contentType = "application/json") {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType });
  await s3.send(cmd);
}

async function dumpAndUpload() {
  const prefix = nowKeyPrefix();
  console.log("Backup prefix:", prefix);
  const tables = await listTables();
  console.log(`Found ${tables.length} tables`);
  const meta = { generated_at: new Date().toISOString(), tables: [] };

  for (const t of tables) {
    console.log("Exporting table:", t);
    try {
      const data = await db.execute(`SELECT * FROM ${t}`);
      const rows = data.rows || [];
      const payload = JSON.stringify({ table: t, rows }, null, 2);
      const key = `${prefix}/${t}.json`;
      await uploadObject(key, payload, "application/json");
      meta.tables.push({ table: t, count: rows.length, key });
      console.log(`Uploaded ${t} (${rows.length} rows) -> ${key}`);
    } catch (e) {
      console.warn(`Skipping table ${t}, error: ${e.message}`);
    }
  }

  // upload metadata
  await uploadObject(`${prefix}/metadata.json`, JSON.stringify(meta, null, 2), "application/json");
  console.log("Backup complete. Metadata uploaded to", `${prefix}/metadata.json`);
}

dumpAndUpload().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
