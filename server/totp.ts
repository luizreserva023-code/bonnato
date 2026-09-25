import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import { ENV } from "./_core/env.ts";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function encryptionKey() {
  const secret = ENV.oauthEncryptionKey || ENV.cookieSecret;
  if (!secret) throw new Error("Security secret is not configured");
  return crypto.createHash("sha256").update(`bonatto:totp:${secret}`).digest();
}

export function encryptTotpSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTotpSecret(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Invalid TOTP secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
export function encodeBase32(buffer: Buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += BASE32[Number.parseInt(chunk, 2)];
  }
  return output;
}

export function decodeBase32(value: string) {
  const clean = value.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function generateTotpUri(secret: string, label: string, issuer = "Bonatto Pizza") {
  const account = encodeURIComponent(`${issuer}:${label || "Conta"}`);
  const issuerParam = encodeURIComponent(issuer);
  return `otpauth://totp/${account}?secret=${encodeURIComponent(secret)}&issuer=${issuerParam}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

export function generateTotpCode(secret: string, timestampMs = Date.now()) {
  const counter = Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto
    .createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(secret: string, token: string, timestampMs = Date.now(), window = 1) {
  if (!/^\d{6}$/.test(token)) return false;

  for (let step = -window; step <= window; step += 1) {
    const candidate = generateTotpCode(
      secret,
      timestampMs + step * TOTP_PERIOD_SECONDS * 1000,
    );
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(token))) {
      return true;
    }
  }
  return false;
}
