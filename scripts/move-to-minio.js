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
  } catch (e) {
    console.warn("Failed to parse credentials file:", e.message);
  }
}

const BUCKET = process.env.MINIO_BUCKET || "kkr-rppi";
const MOVE = process.env.MINIO_MOVE !== "false"; // default: move data out of source

if (!minioConfig.accessKeyId || !minioConfig.secretAccessKey) {
  console.error(
    "Missing MinIO access key/secret. Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY, or provide credentials.json with accessKey/secretKey."
  );
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
  return `moved/${ts}`;
}

async function listTables() {
  try {
    const res = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    return res.rows.map((r) => r.name);
  } catch (e) {
    const res = await db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    return res.rows.map((r) => r.name);
  }
}

async function getSchemaObjects() {
  const res = await db.execute("SELECT type, name, sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger', 'view') AND name NOT LIKE 'sqlite_%'");
  return res.rows.map((row) => ({ type: row.type, name: row.name, sql: row.sql }));
}

async function uploadObject(key, body, contentType = "application/json") {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType });
  await s3.send(cmd);
}

async function moveTable(tableName, prefix) {
  const data = await db.execute(`SELECT * FROM ${tableName}`);
  const rows = data.rows || [];
  const payload = JSON.stringify({ table: tableName, rows }, null, 2);
  const key = `${prefix}/${tableName}.json`;
  await uploadObject(key, payload, "application/json");
  console.log(`Uploaded ${tableName} -> ${key} (${rows.length} rows)`);

  if (MOVE) {
    await db.execute(`DELETE FROM ${tableName}`);
    console.log(`Deleted ${rows.length} rows from source table ${tableName}`);
  }

  return { table: tableName, rows: rows.length, key };
}

async function moveAll() {
  const prefix = nowKeyPrefix();
  console.log("MinIO move prefix:", prefix);
  const tables = await listTables();
  console.log(`Found ${tables.length} tables to move:`);
  tables.forEach((t) => console.log(` - ${t}`));

  const schema = await getSchemaObjects();
  await uploadObject(`${prefix}/schema.json`, JSON.stringify({ moved_at: new Date().toISOString(), schema }, null, 2));
  console.log(`Uploaded schema definition -> ${prefix}/schema.json`);

  const result = [];
  for (const table of tables) {
    try {
      const moved = await moveTable(table, prefix);
      result.push(moved);
    } catch (e) {
      console.error(`Failed moving table ${table}:`, e.message || e);
      throw e;
    }
  }

  const meta = {
    moved_at: new Date().toISOString(),
    bucket: BUCKET,
    prefix,
    move: MOVE,
    tables: result,
  };
  await uploadObject(`${prefix}/metadata.json`, JSON.stringify(meta, null, 2));
  console.log(`Uploaded move metadata -> ${prefix}/metadata.json`);
  console.log(`Move complete: ${result.length} tables moved to MinIO bucket ${BUCKET}`);
}

moveAll().catch((err) => {
  console.error("Move failed:", err);
  process.exit(1);
});
