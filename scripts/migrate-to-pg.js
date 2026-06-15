import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const DEFAULT_MINIO_ENDPOINT = "http://cdn.kediritechnopark.com:9002";
const candidateCredPaths = [
  process.env.MINIO_CREDS_FILE,
  path.resolve(process.cwd(), "credentials.json"),
  path.resolve(process.env.USERPROFILE || process.env.HOME || ".", "Downloads", "credentials.json"),
  path.resolve(process.cwd(), "..", "credentials.json"),
].filter(Boolean);
const CREDS_PATH = candidateCredPaths.find((p) => fs.existsSync(p));

const minioConfig = {
  endpoint: process.env.MINIO_ENDPOINT || DEFAULT_MINIO_ENDPOINT,
  accessKeyId: process.env.MINIO_ACCESS_KEY || "",
  secretAccessKey: process.env.MINIO_SECRET_KEY || "",
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

if (!minioConfig.accessKeyId || !minioConfig.secretAccessKey) {
  console.error("Missing MinIO credentials");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: minioConfig.endpoint,
  region: minioConfig.region,
  credentials: { accessKeyId: minioConfig.accessKeyId, secretAccessKey: minioConfig.secretAccessKey },
  forcePathStyle: minioConfig.forcePathStyle,
});

const pgPool = new pg.Pool({
  host: process.env.PGHOST || "postgresql",
  port: parseInt(process.env.PGPORT || "5432", 10),
  user: process.env.PGUSER || "kediritechnopark",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || "kkr_rppi",
});

async function minioGet(key) {
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const text = await resp.Body.transformToString();
    return JSON.parse(text);
  } catch (err) {
    console.error("minioGet error for", key, ":", err.message);
    return null;
  }
}

async function minioList(prefix) {
  try {
    const keys = [];
    let isTruncated = true;
    let marker;
    while (isTruncated) {
      const resp = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET, Prefix: prefix, MaxKeys: 1000,
        ...(marker ? { StartAfter: marker } : {}),
      }));
      const batch = (resp.Contents || []).map(o => o.Key).filter(Boolean);
      keys.push(...batch);
      isTruncated = resp.IsTruncated === true;
      if (isTruncated && batch.length > 0) marker = batch[batch.length - 1];
      else isTruncated = false;
    }
    return keys;
  } catch (err) {
    console.error("minioList error for", prefix, ":", err.message);
    return [];
  }
}

async function migrateSettings() {
  console.log("\n--- Settings ---");
  const keys = await minioList("settings/");
  let count = 0;
  for (const key of keys) {
    const data = await minioGet(key);
    if (data && data.key) {
      await pgPool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [data.key, data.value]);
      count++;
    }
  }
  console.log(`Migrated ${count} settings`);
}

async function migrateSpeakers() {
  console.log("\n--- Speakers ---");
  const keys = await minioList("speakers/");
  let count = 0;
  for (const key of keys) {
    const s = await minioGet(key);
    if (s && s.id) {
      await pgPool.query(`INSERT INTO speakers (id, name, title, organization, description, photo_url, tags, story, is_active, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET name=$2,title=$3,organization=$4,description=$5,photo_url=$6,tags=$7,story=$8,is_active=$9,updated_at=$11`,
        [s.id, s.name || "", s.title || "", s.organization || "", s.description || "", s.photo_url || "", s.tags || "", s.story || "", s.is_active ?? 1, s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString()]);
      count++;
    }
  }
  console.log(`Migrated ${count} speakers`);
}

async function migrateSponsors() {
  console.log("\n--- Sponsors ---");
  const keys = await minioList("sponsors/");
  let count = 0;
  for (const key of keys) {
    const s = await minioGet(key);
    if (s && s.id) {
      await pgPool.query(`INSERT INTO sponsors (id, name, website, description, logo_url, is_active, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO UPDATE SET name=$2,website=$3,description=$4,logo_url=$5,is_active=$6,updated_at=$8`,
        [s.id, s.name || "", s.website || "", s.description || "", s.logo_url || "", s.is_active ?? 1, s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString()]);
      count++;
    }
  }
  console.log(`Migrated ${count} sponsors`);
}

async function migrateTickets() {
  console.log("\n--- Tickets ---");
  const keys = await minioList("tickets/");
  let count = 0;
  for (const key of keys) {
    const t = await minioGet(key);
    if (t && t.id) {
      await pgPool.query(`INSERT INTO tickets (id, name, remaining) VALUES ($1,$2,$3)
        ON CONFLICT (id) DO UPDATE SET name=$2,remaining=$3`,
        [t.id, t.name || "", t.remaining ?? 0]);
      count++;
    }
  }
  console.log(`Migrated ${count} tickets`);
}

async function migrateRegistrants() {
  console.log("\n--- Registrants ---");
  const keys = await minioList("registrants/");
  let count = 0;
  for (const key of keys) {
    const r = await minioGet(key);
    if (r && r.id) {
      await pgPool.query(`INSERT INTO registrants (id, name, school, email, whatsapp, participant_type, ticket, checked_in, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET name=$2,school=$3,email=$4,whatsapp=$5,participant_type=$6,ticket=$7,checked_in=$8,updated_at=$10`,
        [r.id, r.name || "", r.school || "", r.email || "", r.whatsapp || "", r.participant_type || "", r.ticket || "", r.checked_in ?? 0, r.created_at || new Date().toISOString(), r.updated_at || new Date().toISOString()]);
      count++;
    }
  }
  console.log(`Migrated ${count} registrants`);
}

async function migrateAdmins() {
  console.log("\n--- Admins ---");
  const keys = await minioList("admins/");
  let count = 0;
  for (const key of keys) {
    const a = await minioGet(key);
    if (a && a.id) {
      await pgPool.query(`INSERT INTO admins (id, username, email, password, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET username=$2,email=$3,password=$4,updated_at=$6`,
        [a.id, a.username || "", a.email || "", a.password || "", a.created_at || new Date().toISOString(), a.updated_at || new Date().toISOString()]);
      count++;
    }
  }
  console.log(`Migrated ${count} admins`);
}

async function migrateAltarServers() {
  console.log("\n--- Altar Servers ---");
  const keys = await minioList("altar_servers/");
  let count = 0;
  for (const key of keys) {
    const a = await minioGet(key);
    if (a && a.id) {
      await pgPool.query(`INSERT INTO altar_servers (id, name, title, organization, description, photo_url, tags, is_active, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET name=$2,title=$3,organization=$4,description=$5,photo_url=$6,tags=$7,is_active=$8,updated_at=$10`,
        [a.id, a.name || "", a.title || "", a.organization || "", a.description || "", a.photo_url || "", a.tags || "", a.is_active ?? 1, a.created_at || new Date().toISOString(), a.updated_at || new Date().toISOString()]);
      count++;
    }
  }
  console.log(`Migrated ${count} altar servers`);
}

async function main() {
  console.log("=== Starting MinIO to PostgreSQL Migration ===\n");

  console.log("Creating schema...");
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS speakers (id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT DEFAULT '', organization TEXT DEFAULT '', description TEXT DEFAULT '', photo_url TEXT DEFAULT '', tags TEXT DEFAULT '', story TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS sponsors (id TEXT PRIMARY KEY, name TEXT NOT NULL, website TEXT DEFAULT '', description TEXT DEFAULT '', logo_url TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, name TEXT NOT NULL, remaining INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS registrants (id TEXT PRIMARY KEY, name TEXT NOT NULL, school TEXT DEFAULT '', email TEXT DEFAULT '', whatsapp TEXT DEFAULT '', participant_type TEXT DEFAULT '', ticket TEXT REFERENCES tickets(id), checked_in INTEGER DEFAULT 0, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT DEFAULT '', password TEXT NOT NULL, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS altar_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT DEFAULT '', organization TEXT DEFAULT '', description TEXT DEFAULT '', photo_url TEXT DEFAULT '', tags TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
  `);
  console.log("Schema ready.\n");

  await migrateSettings();
  await migrateSpeakers();
  await migrateSponsors();
  await migrateTickets();
  await migrateRegistrants();
  await migrateAdmins();
  await migrateAltarServers();

  console.log("\n=== Migration Complete ===");
  await pgPool.end();
}

main().catch(err => { console.error("Migration failed:", err); process.exit(1); });
