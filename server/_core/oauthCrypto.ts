import crypto from "node:crypto";

const TOKEN_FORMAT_VERSION = "v1";

function deriveKey(secret: string) {
  if (!secret) {
    throw new Error("OAUTH_ENCRYPTION_KEY is required to store social tokens");
  }

  return crypto.createHash("sha256").update(`bonatto:oauth:${secret}`, "utf8").digest();
}

export function encryptOAuthToken(value: string | null | undefined, secret: string) {
  if (!value) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [TOKEN_FORMAT_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptOAuthToken(value: string | null | undefined, secret: string) {
  if (!value) return null;

  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== TOKEN_FORMAT_VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid encrypted OAuth token");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
