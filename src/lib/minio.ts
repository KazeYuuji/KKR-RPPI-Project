import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "http://cdn.kediritechnopark.com:9002";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "kediritechnopark";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "G0beyond!";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "kkr-rppi";

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: MINIO_ENDPOINT,
      credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
      region: "us-east-1",
      forcePathStyle: true,
    });
  }
  return s3Client;
}

export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
  prefix = "uploads/"
): Promise<string> {
  const key = `${prefix}${filename}`;
  await getS3().send(new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function downloadFromMinIO(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const resp = await getS3().send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
    const buffer = Buffer.from(await resp.Body!.transformToByteArray());
    const contentType = resp.ContentType || "application/octet-stream";
    return { buffer, contentType };
  } catch {
    return null;
  }
}

export async function readJSONFromMinIO<T = unknown>(key: string): Promise<T | null> {
  try {
    const resp = await getS3().send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
    const text = await resp.Body!.transformToString();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function listMinIOObjects(prefix: string): Promise<string[]> {
  try {
    const resp = await getS3().send(new ListObjectsV2Command({ Bucket: MINIO_BUCKET, Prefix: prefix }));
    return (resp.Contents || []).map(o => o.Key!).filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveJSONToMinIO(data: unknown, key: string): Promise<void> {
  const json = JSON.stringify(data);
  const prefix = key.substring(0, key.lastIndexOf("/") + 1);
  await getS3().send(new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
    Body: json,
    ContentType: "application/json",
  }));
}
