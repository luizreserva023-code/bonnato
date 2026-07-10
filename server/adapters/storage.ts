/**
 * Storage Adapter — troca de provedor sem alterar o restante do código.
 *
 * Para usar na Manus (padrão):
 *   STORAGE_PROVIDER=manus  (ou deixar em branco)
 *
 * Para usar AWS S3 na sua VPS:
 *   STORAGE_PROVIDER=s3
 *   AWS_ACCESS_KEY_ID=...
 *   AWS_SECRET_ACCESS_KEY=...
 *   AWS_REGION=us-east-1
 *   AWS_S3_BUCKET=meu-bucket
 *   AWS_S3_PUBLIC_URL=https://meu-bucket.s3.amazonaws.com  (opcional, para URLs públicas)
 *
 * Para usar Cloudflare R2 na sua VPS (mais barato, sem egress):
 *   STORAGE_PROVIDER=r2
 *   R2_ACCESS_KEY_ID=...
 *   R2_SECRET_ACCESS_KEY=...
 *   R2_ACCOUNT_ID=...
 *   R2_BUCKET=meu-bucket
 *   R2_PUBLIC_URL=https://pub-xxx.r2.dev  (URL pública do bucket)
 *
 * Para usar MinIO local na sua VPS (gratuito, self-hosted):
 *   STORAGE_PROVIDER=minio
 *   MINIO_ENDPOINT=http://localhost:9000
 *   MINIO_ACCESS_KEY=minioadmin
 *   MINIO_SECRET_KEY=minioadmin
 *   MINIO_BUCKET=bonatto
 *   MINIO_PUBLIC_URL=http://localhost:9000/bonatto
 *
 * Para usar Vercel Blob (ideal na Vercel):
 *   BLOB_READ_WRITE_TOKEN=...   (a Vercel injeta automaticamente)
 *   STORAGE_PROVIDER=vercel_blob  (opcional; auto-detectado quando o token existe)
 */

export interface StorageResult {
  key: string;
  url: string;
  provider: string;
}

function resolveStorageProvider(): "manus" | "s3" | "r2" | "minio" | "vercel_blob" {
  const explicit = (process.env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "vercel_blob" || explicit === "vercel-blob") return "vercel_blob";
  if (explicit === "s3" || explicit === "r2" || explicit === "minio" || explicit === "manus") {
    return explicit;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "vercel_blob";
  return "manus";
}

// ─── Manus built-in ──────────────────────────────────────────────────────────
async function putManus(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<StorageResult> {
  const { storagePut } = await import("../storage.ts");
  const result = await storagePut(relKey, data, contentType);
  return { ...result, provider: "manus" };
}

async function getManus(relKey: string): Promise<StorageResult> {
  const { storageGet } = await import("../storage.ts");
  const result = await storageGet(relKey);
  return { ...result, provider: "manus" };
}

// ─── Vercel Blob ──────────────────────────────────────────────────────────────
async function putVercelBlob(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<StorageResult> {
  const { put } = await import("@vercel/blob");
  const pathname = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? data : Buffer.isBuffer(data) ? data : Buffer.from(data);
  const blob = await put(pathname, body, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
  return { key: blob.pathname, url: blob.url, provider: "vercel_blob" };
}

async function getVercelBlob(relKey: string): Promise<StorageResult> {
  const { head } = await import("@vercel/blob");
  const pathname = relKey.replace(/^\/+/, "");
  const blob = await head(pathname);
  return { key: blob.pathname, url: blob.url, provider: "vercel_blob" };
}

// ─── AWS S3 / Cloudflare R2 (mesma API S3-compatible) ───────────────────────
function getS3Config(provider: "s3" | "r2" | "minio") {
  if (provider === "s3") {
    return {
      endpoint: `https://s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com`,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      bucket: process.env.AWS_S3_BUCKET ?? "",
      publicUrl: process.env.AWS_S3_PUBLIC_URL ?? "",
      region: process.env.AWS_REGION ?? "us-east-1",
    };
  }
  if (provider === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID ?? "";
    return {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      bucket: process.env.R2_BUCKET ?? "",
      publicUrl: process.env.R2_PUBLIC_URL ?? "",
      region: "auto",
    };
  }
  // minio
  return {
    endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
    bucket: process.env.MINIO_BUCKET ?? "bonatto",
    publicUrl: process.env.MINIO_PUBLIC_URL ?? "",
    region: "us-east-1",
  };
}

async function putS3Compatible(
  provider: "s3" | "r2" | "minio",
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<StorageResult> {
  // Dynamically import @aws-sdk/client-s3 — install with: npm install @aws-sdk/client-s3
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3" as any);
  const cfg = getS3Config(provider);

  const client = new S3Client({
    region: cfg.region,
    endpoint: provider !== "s3" ? cfg.endpoint : undefined,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: provider === "minio",
  });

  const key = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? Buffer.from(data) : data;

  await client.send(new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  const url = cfg.publicUrl
    ? `${cfg.publicUrl.replace(/\/+$/, "")}/${key}`
    : `${cfg.endpoint}/${cfg.bucket}/${key}`;

  return { key, url, provider };
}

async function getS3Compatible(
  provider: "s3" | "r2" | "minio",
  relKey: string
): Promise<StorageResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner" as any);
  const cfg = getS3Config(provider);

  const client = new S3Client({
    region: cfg.region,
    endpoint: provider !== "s3" ? cfg.endpoint : undefined,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: provider === "minio",
  });

  const key = relKey.replace(/^\/+/, "");
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), { expiresIn: 3600 });

  return { key, url, provider };
}

// ─── Ponto de entrada único ───────────────────────────────────────────────────
export async function storagePutAdapter(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<StorageResult> {
  const provider = resolveStorageProvider();

  switch (provider) {
    case "vercel_blob":
      return putVercelBlob(relKey, data, contentType);
    case "s3":
      return putS3Compatible("s3", relKey, data, contentType);
    case "r2":
      return putS3Compatible("r2", relKey, data, contentType);
    case "minio":
      return putS3Compatible("minio", relKey, data, contentType);
    case "manus":
    default:
      return putManus(relKey, data, contentType);
  }
}

export async function storageGetAdapter(relKey: string): Promise<StorageResult> {
  const provider = resolveStorageProvider();

  switch (provider) {
    case "vercel_blob":
      return getVercelBlob(relKey);
    case "s3":
      return getS3Compatible("s3", relKey);
    case "r2":
      return getS3Compatible("r2", relKey);
    case "minio":
      return getS3Compatible("minio", relKey);
    case "manus":
    default:
      return getManus(relKey);
  }
}
