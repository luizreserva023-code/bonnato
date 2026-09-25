import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { generateTotpSecret, generateTotpUri, verifyTotpCode } from "./totp.ts";

import { twoFactorChallenges, users } from "../drizzle/schema.ts";
import { decryptOAuthToken, encryptOAuthToken } from "./_core/oauthCrypto.ts";
import { ENV } from "./_core/env.ts";
import { getDb } from "./db.ts";

function hashChallenge(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function beginTotpSetup(userId: number, label: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const secret = generateTotpSecret();
  const encrypted = encryptOAuthToken(secret, ENV.oauthEncryptionKey);
  if (!encrypted) throw new Error("Unable to protect TOTP secret");
  await db.update(users)
    .set({ totpPendingSecretEncrypted: encrypted, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return {
    secret,
    uri: generateTotpUri(secret, label || "Conta"),
  };
}
export async function confirmTotpSetup(userId: number, code: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [user] = await db.select({
    pending: users.totpPendingSecretEncrypted,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.pending) return false;

  const secret = decryptOAuthToken(user.pending, ENV.oauthEncryptionKey);
  if (!secret) return false;
  if (!verifyTotpCode(secret, code)) return false;

  await db.update(users).set({
    totpSecretEncrypted: user.pending,
    totpPendingSecretEncrypted: null,
    totpEnabled: true,
    totpConfirmedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
  return true;
}

export async function verifyUserTotp(userId: number, code: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [user] = await db.select({
    enabled: users.totpEnabled,
    encrypted: users.totpSecretEncrypted,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.enabled || !user.encrypted) return false;
  const secret = decryptOAuthToken(user.encrypted, ENV.oauthEncryptionKey);
  if (!secret) return false;
  return verifyTotpCode(secret, code);
}
export async function disableUserTotp(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({
    totpSecretEncrypted: null,
    totpPendingSecretEncrypted: null,
    totpEnabled: false,
    totpConfirmedAt: null,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
}

export async function createTwoFactorChallenge(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const token = crypto.randomBytes(32).toString("base64url");
  const id = `2fa_${crypto.randomBytes(16).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.insert(twoFactorChallenges).values({
    id,
    tokenHash: hashChallenge(token),
    userId,
    expiresAt,
  });
  return token;
}
export async function resolveTwoFactorChallenge(token: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const tokenHash = hashChallenge(token);
  const [challenge] = await db.select({
    id: twoFactorChallenges.id,
    userId: twoFactorChallenges.userId,
  }).from(twoFactorChallenges).where(and(
    eq(twoFactorChallenges.tokenHash, tokenHash),
    isNull(twoFactorChallenges.consumedAt),
    gt(twoFactorChallenges.expiresAt, new Date()),
  )).limit(1);
  return challenge ?? null;
}

export async function consumeTwoFactorChallenge(challengeId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(twoFactorChallenges)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(twoFactorChallenges.id, challengeId),
      isNull(twoFactorChallenges.consumedAt),
    ))
    .returning({ id: twoFactorChallenges.id });
  return result.length > 0;
}

export async function getTwoFactorStatus(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [user] = await db.select({
    enabled: users.totpEnabled,
    confirmedAt: users.totpConfirmedAt,
    passwordHash: users.passwordHash,
  }).from(users).where(eq(users.id, userId)).limit(1);
  return {
    enabled: Boolean(user?.enabled),
    confirmedAt: user?.confirmedAt ?? null,
    hasPassword: Boolean(user?.passwordHash),
  };
}
