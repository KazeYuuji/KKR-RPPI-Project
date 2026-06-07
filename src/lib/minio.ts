const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "http://cdn.kediritechnopark.com:9001";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "kediritechnopark";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "G0beyond!";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "kkr-rppi";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function login(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${MINIO_ENDPOINT}/api/v1/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY }),
  });
  if (!res.ok) throw new Error("MinIO login failed");
  const cookie = res.headers.get("set-cookie") || "";
  const match = cookie.match(/token=([^;]+)/);
  if (!match) throw new Error("MinIO token not found in response");
  cachedToken = match[1];
  tokenExpiry = Date.now() + 3600000;
  return cachedToken!;
}

function toBase64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

export async function uploadToMinIO(
  buffer: Buffer,
  filename: string,
  contentType: string,
  prefix = "uploads/"
): Promise<string> {
  const token = await login();
  const key = `${prefix}${filename}`;
  const formData = new FormData();
  const blob = new Blob([buffer], { type: contentType });
  formData.append("0", blob, filename);
  const url = `${MINIO_ENDPOINT}/api/v1/buckets/${MINIO_BUCKET}/objects/upload?prefix=${encodeURIComponent(prefix)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Cookie: `token=${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MinIO upload failed: ${err}`);
  }
  return key;
}

export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
  prefix = "uploads/"
): Promise<string> {
  return uploadToMinIO(buffer, filename, contentType, prefix);
}

export async function downloadFromMinIO(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const token = await login();
  const prefix = toBase64(key);
  const url = `${MINIO_ENDPOINT}/api/v1/buckets/${MINIO_BUCKET}/objects/download?prefix=${encodeURIComponent(prefix)}`;
  const res = await fetch(url, {
    headers: { Cookie: `token=${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { buffer, contentType };
}

export async function saveJSONToMinIO(
  data: unknown,
  key: string
): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const token = await login();
  const prefix = key.substring(0, key.lastIndexOf("/") + 1);
  const filename = key.substring(key.lastIndexOf("/") + 1);
  const formData = new FormData();
  const blob = new Blob([json], { type: "application/json" });
  formData.append("0", blob, filename);
  const url = `${MINIO_ENDPOINT}/api/v1/buckets/${MINIO_BUCKET}/objects/upload?prefix=${encodeURIComponent(prefix)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Cookie: `token=${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MinIO saveJSON failed: ${err}`);
  }
}
