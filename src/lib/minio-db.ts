import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "http://cdn.kediritechnopark.com:9002";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "kkr-rppi";

const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
if (!MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
  throw new Error("MINIO_ACCESS_KEY and MINIO_SECRET_KEY environment variables are required");
}

let s3: S3Client;

function getS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      endpoint: MINIO_ENDPOINT,
      credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
      region: "us-east-1",
      forcePathStyle: true,
    });
  }
  return s3;
}

function prefixPath(key: string): string {
  return key.replace(/^\//, "");
}

export async function minioGet<T = Record<string, any>>(key: string): Promise<T | null> {
  try {
    const resp = await getS3().send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: prefixPath(key) }));
    if (!resp.Body) return null;
    const text = await resp.Body.transformToString();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function minioSet(key: string, data: unknown): Promise<void> {
  await getS3().send(new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: prefixPath(key),
    Body: JSON.stringify(data),
    ContentType: "application/json",
  }));
}

export async function minioDelete(key: string): Promise<void> {
  try {
    await getS3().send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: prefixPath(key) }));
  } catch {}
}

export async function minioList(prefix: string): Promise<string[]> {
  try {
    const resp = await getS3().send(new ListObjectsV2Command({
      Bucket: MINIO_BUCKET,
      Prefix: prefixPath(prefix),
    }));
    return (resp.Contents || []).map(o => o.Key!).filter(Boolean);
  } catch {
    return [];
  }
}

export async function minioListAll<T = Record<string, any>>(prefix: string): Promise<T[]> {
  const keys = await minioList(prefix);
  const items: T[] = [];
  for (const key of keys) {
    const item = await minioGet<T>(key);
    if (item) items.push(item);
  }
  return items;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// upload file (buffer)
export async function uploadBuffer(buffer: Buffer, filename: string, contentType: string, prefix = "uploads/"): Promise<string> {
  const key = `${prefix}${filename}`;
  await getS3().send(new PutObjectCommand({
    Bucket: MINIO_BUCKET, Key: prefixPath(key), Body: buffer, ContentType: contentType,
  }));
  return key;
}

export async function downloadFromMinIO(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const resp = await getS3().send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: prefixPath(key) }));
    if (!resp.Body) return null;
    const buffer = Buffer.from(await resp.Body.transformToByteArray());
    return { buffer, contentType: resp.ContentType || "application/octet-stream" };
  } catch {
    return null;
  }
}
