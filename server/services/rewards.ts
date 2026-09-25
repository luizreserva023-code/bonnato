import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";

import {
  coupons,
  loyaltyTransactions,
  rewardCatalog,
  rewardCouponUsages,
  rewardCoupons,
  rewardRedemptions,
  stores,
  customerStoreAccounts,
  users,
} from "../../drizzle/schema.ts";
import { getDb, getCustomerStoreAccount, getUserLoyaltyPoints } from "../db.ts";

export type RewardAvailability =
  | "available"
  | "insufficient_points"
  | "upcoming"
  | "expired"
  | "sold_out"
  | "limit_reached"
  | "inactive";

export type RewardBenefit = {
  couponId: number;
  redemptionId: number;
  rewardId: number;
  rewardType: "discount" | "product" | "free_delivery" | "cashback";
  discount: number;
  freeDelivery: boolean;
  description: string;
};

type RewardInput = {
  name: string;
  description?: string | null;
  rewardType: "discount" | "product" | "free_delivery" | "cashback";
  pointsCost: number;
  value: number;
  productId?: number | null;
  category?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  badgeText?: string | null;
  buttonText?: string | null;
  stock?: number | null;
  maxRedemptionsPerUser?: number | null;
  active?: boolean;
  featured?: boolean;
  sortOrder?: number;
  startsAt?: Date | null;
  expiresAt?: Date | null;
};

function validateRewardRules(input: Partial<RewardInput>, current?: {
  rewardType: RewardInput["rewardType"];
  productId: number | null;
  value: string | number;
  startsAt: Date | null;
  expiresAt: Date | null;
  stock: number | null;
  totalRedemptions: number;
}) {
  const rewardType = input.rewardType ?? current?.rewardType;
  const productId = input.productId !== undefined ? input.productId : current?.productId;
  const value = input.value !== undefined ? input.value : Number(current?.value ?? 0);
  const startsAt = input.startsAt !== undefined ? input.startsAt : current?.startsAt;
  const expiresAt = input.expiresAt !== undefined ? input.expiresAt : current?.expiresAt;
  const stock = input.stock !== undefined ? input.stock : current?.stock;
  if (rewardType === "product" && !productId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione o produto entregue por esta recompensa." });
  }
  if ((rewardType === "discount" || rewardType === "cashback") && Number(value) <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um valor de benefício maior que zero." });
  }
  if (startsAt && expiresAt && startsAt >= expiresAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A expiração deve ser posterior à data de início." });
  }
  if (stock !== null && stock !== undefined && current && stock < current.totalRedemptions) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O estoque não pode ser menor que a quantidade já resgatada." });
  }
}

export type OrderItemForReward = {
  productId: number;
  productPrice: string | number;
  quantity: number;
};

function duplicateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|ER_DUP_ENTRY/i.test(message);
}

function requireDatabase<T>(database: T | null): asserts database is T {
  if (!database) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  }
}

export function maskRewardCoupon(code: string) {
  if (code.length <= 6) return `${code.slice(0, 2)}••••`;
  return `${code.slice(0, 4)}••••${code.slice(-2)}`;
}

export function normalizeRewardCouponCode(code: string) {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9-]{4,64}$/.test(normalized)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cada código deve ter de 4 a 64 caracteres e usar apenas letras, números ou hífen.",
    });
  }
  return normalized;
}

export function normalizeRewardCouponBatch(inputCodes: string[]) {
  const normalized = inputCodes.map(normalizeRewardCouponCode);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const code of normalized) {
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);
  }
  if (duplicates.size > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Códigos repetidos no arquivo: ${[...duplicates].slice(0, 5).join(", ")}${duplicates.size > 5 ? "..." : ""}`,
    });
  }
  return normalized;
}

export function resolveRewardAvailability(input: {
  active: boolean;
  archivedAt: Date | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  stock: number | null;
  totalRedemptions: number;
  pointsCost: number;
  balance?: number;
  userRedemptions?: number;
  maxRedemptionsPerUser: number | null;
  availableCoupons: number;
}, now = new Date()): RewardAvailability {
  if (!input.active || input.archivedAt) return "inactive";
  if (input.startsAt && input.startsAt > now) return "upcoming";
  if (input.expiresAt && input.expiresAt <= now) return "expired";
  if (input.stock !== null && input.totalRedemptions >= input.stock) return "sold_out";
  if (input.availableCoupons <= 0) return "sold_out";
  if (input.maxRedemptionsPerUser !== null && (input.userRedemptions ?? 0) >= input.maxRedemptionsPerUser) {
    return "limit_reached";
  }
  if (input.balance !== undefined && input.balance < input.pointsCost) return "insufficient_points";
  return "available";
}

async function couponStatsByReward(storeId: number) {
  const db = await getDb();
  requireDatabase(db);
  const [rows, availableRows] = await Promise.all([
    db
      .select({
        rewardId: rewardCoupons.rewardId,
        status: rewardCoupons.status,
        total: sql<number>`COUNT(*)`,
      })
      .from(rewardCoupons)
      .where(eq(rewardCoupons.storeId, storeId))
      .groupBy(rewardCoupons.rewardId, rewardCoupons.status),
    db
      .select({ rewardId: rewardCoupons.rewardId, total: sql<number>`COUNT(*)` })
      .from(rewardCoupons)
      .where(and(
        eq(rewardCoupons.storeId, storeId),
        eq(rewardCoupons.status, "available"),
        or(isNull(rewardCoupons.expiresAt), gt(rewardCoupons.expiresAt, new Date())),
      ))
      .groupBy(rewardCoupons.rewardId),
  ]);

  const stats = new Map<number, Record<string, number>>();
  for (const row of rows) {
    const current = stats.get(row.rewardId) ?? {};
    current[row.status] = Number(row.total);
    stats.set(row.rewardId, current);
  }
  for (const row of availableRows) {
    const current = stats.get(row.rewardId) ?? {};
    current.available = Number(row.total);
    stats.set(row.rewardId, current);
  }
  return stats;
}

export async function listRewards(storeId: number, userId?: number) {
  const db = await getDb();
  requireDatabase(db);
  const now = new Date();
  const [rows, couponStats, balance, userCounts] = await Promise.all([
    db.select().from(rewardCatalog)
      .where(and(
        eq(rewardCatalog.storeId, storeId),
        eq(rewardCatalog.active, true),
        isNull(rewardCatalog.archivedAt),
      ))
      .orderBy(desc(rewardCatalog.featured), asc(rewardCatalog.sortOrder), asc(rewardCatalog.pointsCost)),
    couponStatsByReward(storeId),
    userId ? getUserLoyaltyPoints(userId, storeId) : Promise.resolve(undefined),
    userId
      ? db.select({ rewardId: rewardRedemptions.rewardId, total: sql<number>`COUNT(*)` })
          .from(rewardRedemptions)
          .where(and(
            eq(rewardRedemptions.storeId, storeId),
            eq(rewardRedemptions.userId, userId),
            eq(rewardRedemptions.status, "completed"),
          ))
          .groupBy(rewardRedemptions.rewardId)
      : Promise.resolve([]),
  ]);
  const userCountMap = new Map(userCounts.map((item) => [item.rewardId, Number(item.total)]));

  return rows.map((reward) => {
    const stats = couponStats.get(reward.id) ?? {};
    const availableCoupons = Number(stats.available ?? 0);
    const userRedemptions = userCountMap.get(reward.id) ?? 0;
    return {
      ...reward,
      availableCoupons,
      userRedemptions,
      balance: balance ?? null,
      availability: resolveRewardAvailability({
        ...reward,
        balance,
        userRedemptions,
        availableCoupons,
      }, now),
    };
  });
}

export async function getRewardDetail(storeId: number, rewardId: number, userId?: number) {
  const rewards = await listRewards(storeId, userId);
  return rewards.find((reward) => reward.id === rewardId) ?? null;
}

export async function listRewardsForAdmin(storeId: number) {
  const db = await getDb();
  requireDatabase(db);
  const [rows, stats] = await Promise.all([
    db.select().from(rewardCatalog)
      .where(eq(rewardCatalog.storeId, storeId))
      .orderBy(asc(rewardCatalog.archivedAt), asc(rewardCatalog.sortOrder), desc(rewardCatalog.createdAt)),
    couponStatsByReward(storeId),
  ]);
  return rows.map((reward) => ({
    ...reward,
    couponStats: {
      available: Number(stats.get(reward.id)?.available ?? 0),
      reserved: Number(stats.get(reward.id)?.reserved ?? 0),
      redeemed: Number(stats.get(reward.id)?.redeemed ?? 0),
      used: Number(stats.get(reward.id)?.used ?? 0),
      expired: Number(stats.get(reward.id)?.expired ?? 0),
      cancelled: Number(stats.get(reward.id)?.cancelled ?? 0),
    },
  }));
}

export async function createReward(storeId: number, input: RewardInput) {
  const db = await getDb();
  requireDatabase(db);
  validateRewardRules(input);
  const [created] = await db.insert(rewardCatalog).values({
    storeId,
    name: input.name,
    description: input.description ?? null,
    rewardType: input.rewardType,
    pointsCost: input.pointsCost,
    value: input.value.toFixed(2),
    productId: input.productId ?? null,
    category: input.category ?? null,
    icon: input.icon ?? null,
    imageUrl: input.imageUrl ?? null,
    badgeText: input.badgeText ?? null,
    buttonText: input.buttonText?.trim() || "Resgatar",
    stock: input.stock ?? null,
    maxRedemptionsPerUser: input.maxRedemptionsPerUser ?? null,
    active: input.active ?? true,
    featured: input.featured ?? false,
    sortOrder: input.sortOrder ?? 0,
    startsAt: input.startsAt ?? null,
    expiresAt: input.expiresAt ?? null,
  }).returning({ id: rewardCatalog.id });
  return created.id;
}

export async function updateReward(storeId: number, rewardId: number, input: Partial<RewardInput>) {
  const db = await getDb();
  requireDatabase(db);
  const [current] = await db.select().from(rewardCatalog)
    .where(and(eq(rewardCatalog.id, rewardId), eq(rewardCatalog.storeId, storeId)))
    .limit(1);
  if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Recompensa não encontrada." });
  validateRewardRules(input, current);
  const { value, buttonText, ...otherChanges } = input;
  const changes = {
    ...otherChanges,
    ...(value !== undefined ? { value: value.toFixed(2) } : {}),
    ...(buttonText !== undefined ? { buttonText: buttonText?.trim() || "Resgatar" } : {}),
    updatedAt: new Date(),
  };
  await db.update(rewardCatalog).set(changes).where(eq(rewardCatalog.id, rewardId));
  return current;
}

export async function archiveReward(storeId: number, rewardId: number) {
  const db = await getDb();
  requireDatabase(db);
  const [current] = await db.select().from(rewardCatalog)
    .where(and(eq(rewardCatalog.id, rewardId), eq(rewardCatalog.storeId, storeId)))
    .limit(1);
  if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Recompensa não encontrada." });
  await db.update(rewardCatalog).set({ active: false, archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(rewardCatalog.id, rewardId));
  return current;
}

export async function addRewardCoupons(input: {
  storeId: number;
  rewardId: number;
  codes: string[];
  expiresAt?: Date | null;
}) {
  const db = await getDb();
  requireDatabase(db);
  const codes = normalizeRewardCouponBatch(input.codes);
  if (!codes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe pelo menos um código." });
  if (codes.length > 1000) throw new TRPCError({ code: "BAD_REQUEST", message: "Importe no máximo 1.000 códigos por vez." });

  return db.transaction(async (tx) => {
    const [reward] = await tx.select({ id: rewardCatalog.id }).from(rewardCatalog)
      .where(and(eq(rewardCatalog.id, input.rewardId), eq(rewardCatalog.storeId, input.storeId)))
      .limit(1);
    if (!reward) throw new TRPCError({ code: "NOT_FOUND", message: "Recompensa não encontrada." });

    const [existingRewardCodes, existingOrderCoupons] = await Promise.all([
      tx.select({ code: rewardCoupons.code }).from(rewardCoupons)
        .where(and(eq(rewardCoupons.storeId, input.storeId), inArray(rewardCoupons.code, codes))),
      tx.select({ code: coupons.code }).from(coupons)
        .where(and(eq(coupons.storeId, input.storeId), inArray(coupons.code, codes))),
    ]);
    const duplicateCodes = Array.from(new Set([
      ...existingRewardCodes.map((item) => item.code),
      ...existingOrderCoupons.map((item) => item.code),
    ]));
    if (duplicateCodes.length) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Códigos duplicados: ${duplicateCodes.slice(0, 5).join(", ")}${duplicateCodes.length > 5 ? "..." : ""}`,
      });
    }

    await tx.insert(rewardCoupons).values(codes.map((code) => ({
      storeId: input.storeId,
      rewardId: input.rewardId,
      code,
      expiresAt: input.expiresAt ?? null,
    })));
    return { inserted: codes.length };
  });
}

export async function generateRewardCoupons(input: {
  storeId: number;
  rewardId: number;
  prefix: string;
  quantity: number;
  codeLength: number;
  expiresAt?: Date | null;
}) {
  const prefix = input.prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = new Set<string>();
  while (codes.size < input.quantity) {
    const bytes = randomBytes(input.codeLength);
    let suffix = "";
    for (let index = 0; index < input.codeLength; index += 1) {
      suffix += alphabet[bytes[index] % alphabet.length];
    }
    codes.add(`${prefix}${suffix}`);
  }
  await addRewardCoupons({ ...input, codes: [...codes] });
  return { inserted: codes.size };
}

export async function listRewardCoupons(storeId: number, rewardId: number) {
  const db = await getDb();
  requireDatabase(db);
  const rows = await db
    .select({
      id: rewardCoupons.id,
      code: rewardCoupons.code,
      status: rewardCoupons.status,
      assignedUserId: rewardCoupons.assignedUserId,
      userName: users.name,
      userEmail: users.email,
      redemptionId: rewardCoupons.redemptionId,
      reservedAt: rewardCoupons.reservedAt,
      redeemedAt: rewardCoupons.redeemedAt,
      usedAt: rewardCoupons.usedAt,
      expiresAt: rewardCoupons.expiresAt,
      createdAt: rewardCoupons.createdAt,
    })
    .from(rewardCoupons)
    .leftJoin(users, eq(users.id, rewardCoupons.assignedUserId))
    .where(and(eq(rewardCoupons.storeId, storeId), eq(rewardCoupons.rewardId, rewardId)))
    .orderBy(desc(rewardCoupons.createdAt));
  return rows.map((row) => ({ ...row, maskedCode: maskRewardCoupon(row.code), code: undefined }));
}

export async function revealRewardCoupon(storeId: number, couponId: number) {
  const db = await getDb();
  requireDatabase(db);
  const [coupon] = await db.select({ id: rewardCoupons.id, code: rewardCoupons.code, rewardId: rewardCoupons.rewardId })
    .from(rewardCoupons)
    .where(and(eq(rewardCoupons.storeId, storeId), eq(rewardCoupons.id, couponId)))
    .limit(1);
  if (!coupon) throw new TRPCError({ code: "NOT_FOUND", message: "Cupom não encontrado." });
  return coupon;
}

async function redemptionResult(redemptionId: number, userId: number) {
  const db = await getDb();
  requireDatabase(db);
  const [row] = await db
    .select({
      id: rewardRedemptions.id,
      rewardId: rewardRedemptions.rewardId,
      rewardName: rewardCatalog.name,
      rewardDescription: rewardCatalog.description,
      couponId: rewardRedemptions.couponId,
      couponCode: rewardCoupons.code,
      pointsSpent: rewardRedemptions.pointsSpent,
      status: rewardRedemptions.status,
      redeemedAt: rewardRedemptions.redeemedAt,
      expiresAt: rewardRedemptions.expiresAt,
    })
    .from(rewardRedemptions)
    .innerJoin(rewardCatalog, eq(rewardCatalog.id, rewardRedemptions.rewardId))
    .leftJoin(rewardCoupons, eq(rewardCoupons.id, rewardRedemptions.couponId))
    .where(and(eq(rewardRedemptions.id, redemptionId), eq(rewardRedemptions.userId, userId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Resgate não encontrado." });
  return row;
}

export async function redeemReward(input: {
  storeId: number;
  rewardId: number;
  userId: number;
  idempotencyKey: string;
}) {
  const db = await getDb();
  requireDatabase(db);
  await getCustomerStoreAccount(input.userId, input.storeId);

  const [existing] = await db.select({ id: rewardRedemptions.id }).from(rewardRedemptions)
    .where(and(
      eq(rewardRedemptions.storeId, input.storeId),
      eq(rewardRedemptions.userId, input.userId),
      eq(rewardRedemptions.idempotencyKey, input.idempotencyKey),
    ))
    .limit(1);
  if (existing) return { ...(await redemptionResult(existing.id, input.userId)), idempotent: true };

  try {
    const redemptionId = await db.transaction(async (tx) => {
      const now = new Date();
      const [reward] = await tx.select().from(rewardCatalog)
        .where(and(eq(rewardCatalog.id, input.rewardId), eq(rewardCatalog.storeId, input.storeId)))
        .limit(1)
        .for("update");
      if (!reward || reward.archivedAt || !reward.active) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Recompensa indisponível." });
      }
      if (reward.startsAt && reward.startsAt > now) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Esta recompensa ainda não começou." });
      }
      if (reward.expiresAt && reward.expiresAt <= now) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Esta recompensa expirou." });
      }
      if (reward.stock !== null && reward.totalRedemptions >= reward.stock) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Recompensa esgotada." });
      }

      const [account] = await tx.select().from(customerStoreAccounts)
        .where(and(
          eq(customerStoreAccounts.storeId, input.storeId),
          eq(customerStoreAccounts.userId, input.userId),
        ))
        .limit(1)
        .for("update");
      if (!account || account.loyaltyPoints < reward.pointsCost) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Saldo insuficiente. São necessários ${reward.pointsCost} pontos.`,
        });
      }

      if (reward.maxRedemptionsPerUser !== null) {
        const [countRow] = await tx.select({ total: sql<number>`COUNT(*)` }).from(rewardRedemptions)
          .where(and(
            eq(rewardRedemptions.storeId, input.storeId),
            eq(rewardRedemptions.rewardId, reward.id),
            eq(rewardRedemptions.userId, input.userId),
            eq(rewardRedemptions.status, "completed"),
          ));
        if (Number(countRow?.total ?? 0) >= reward.maxRedemptionsPerUser) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Limite de resgates atingido." });
        }
      }

      const [coupon] = await tx.select().from(rewardCoupons)
        .where(and(
          eq(rewardCoupons.storeId, input.storeId),
          eq(rewardCoupons.rewardId, reward.id),
          eq(rewardCoupons.status, "available"),
          or(isNull(rewardCoupons.expiresAt), gt(rewardCoupons.expiresAt, now)),
        ))
        .orderBy(asc(rewardCoupons.id))
        .limit(1)
        .for("update");
      if (!coupon) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não há cupons disponíveis para esta recompensa." });
      }

      const balanceBefore = account.loyaltyPoints;
      const balanceAfter = balanceBefore - reward.pointsCost;
      const [createdRedemption] = await tx.insert(rewardRedemptions).values({
        storeId: input.storeId,
        rewardId: reward.id,
        userId: input.userId,
        pointsSpent: reward.pointsCost,
        status: "pending",
        idempotencyKey: input.idempotencyKey,
        expiresAt: coupon.expiresAt ?? reward.expiresAt ?? null,
      }).returning({ id: rewardRedemptions.id });
      const redemptionId = createdRedemption.id;

      await tx.update(customerStoreAccounts)
        .set({ loyaltyPoints: balanceAfter, updatedAt: now })
        .where(eq(customerStoreAccounts.id, account.id));
      await tx.insert(loyaltyTransactions).values({
        storeId: input.storeId,
        userId: input.userId,
        type: "redeem",
        points: -reward.pointsCost,
        description: `Resgate: ${reward.name}`,
        balanceBefore,
        balanceAfter,
      });
      await tx.update(rewardCoupons).set({
        status: "redeemed",
        assignedUserId: input.userId,
        redemptionId,
        reservedAt: now,
        redeemedAt: now,
      }).where(and(eq(rewardCoupons.id, coupon.id), eq(rewardCoupons.status, "available")));
      await tx.update(rewardRedemptions).set({ couponId: coupon.id, status: "completed" })
        .where(eq(rewardRedemptions.id, redemptionId));
      await tx.update(rewardCatalog).set({
        totalRedemptions: sql`${rewardCatalog.totalRedemptions} + 1`,
        updatedAt: now,
      }).where(eq(rewardCatalog.id, reward.id));
      return redemptionId;
    });
    return { ...(await redemptionResult(redemptionId, input.userId)), idempotent: false };
  } catch (error) {
    if (duplicateError(error)) {
      const [duplicate] = await db.select({ id: rewardRedemptions.id }).from(rewardRedemptions)
        .where(and(
          eq(rewardRedemptions.storeId, input.storeId),
          eq(rewardRedemptions.userId, input.userId),
          eq(rewardRedemptions.idempotencyKey, input.idempotencyKey),
        ))
        .limit(1);
      if (duplicate) return { ...(await redemptionResult(duplicate.id, input.userId)), idempotent: true };
    }
    throw error;
  }
}

export async function listMyRedemptions(storeId: number, userId: number) {
  const db = await getDb();
  requireDatabase(db);
  return db.select({
    id: rewardRedemptions.id,
    rewardId: rewardRedemptions.rewardId,
    rewardName: rewardCatalog.name,
    rewardDescription: rewardCatalog.description,
    rewardType: rewardCatalog.rewardType,
    couponCode: rewardCoupons.code,
    couponStatus: rewardCoupons.status,
    pointsSpent: rewardRedemptions.pointsSpent,
    status: rewardRedemptions.status,
    redeemedAt: rewardRedemptions.redeemedAt,
    expiresAt: rewardRedemptions.expiresAt,
    usedAt: rewardCoupons.usedAt,
  })
    .from(rewardRedemptions)
    .innerJoin(rewardCatalog, eq(rewardCatalog.id, rewardRedemptions.rewardId))
    .leftJoin(rewardCoupons, eq(rewardCoupons.id, rewardRedemptions.couponId))
    .where(and(eq(rewardRedemptions.storeId, storeId), eq(rewardRedemptions.userId, userId)))
    .orderBy(desc(rewardRedemptions.createdAt));
}

export async function getMyRewardsOverview(storeId: number, userId: number) {
  const [rewards, redemptions, balance] = await Promise.all([
    listRewards(storeId, userId),
    listMyRedemptions(storeId, userId),
    getUserLoyaltyPoints(userId, storeId),
  ]);
  return { rewards, redemptions, balance };
}

async function rewardCouponContext(storeId: number, userId: number, code: string) {
  const db = await getDb();
  requireDatabase(db);
  const normalized = normalizeRewardCouponCode(code);
  const [row] = await db.select({
    coupon: rewardCoupons,
    redemption: rewardRedemptions,
    reward: rewardCatalog,
  })
    .from(rewardCoupons)
    .innerJoin(rewardRedemptions, eq(rewardRedemptions.id, rewardCoupons.redemptionId))
    .innerJoin(rewardCatalog, eq(rewardCatalog.id, rewardCoupons.rewardId))
    .where(and(
      eq(rewardCoupons.storeId, storeId),
      eq(rewardCoupons.code, normalized),
      eq(rewardCoupons.assignedUserId, userId),
    ))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Cupom de recompensa não encontrado." });
  const now = new Date();
  if (row.coupon.status !== "redeemed" || row.redemption.status !== "completed") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cupom indisponível ou já utilizado." });
  }
  if ((row.coupon.expiresAt && row.coupon.expiresAt <= now) || (row.redemption.expiresAt && row.redemption.expiresAt <= now)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cupom expirado." });
  }
  return row;
}

export function calculateRewardBenefit(input: {
  couponId: number;
  redemptionId: number;
  rewardId: number;
  rewardType: RewardBenefit["rewardType"];
  rewardName: string;
  value: string | number;
  productId: number | null;
  subtotal: number;
  items: OrderItemForReward[];
}): RewardBenefit {
  const value = Number(input.value);
  let discount = 0;
  let freeDelivery = false;
  if (input.rewardType === "free_delivery") {
    freeDelivery = true;
  } else if (input.rewardType === "product") {
    if (!input.productId) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Produto da recompensa não configurado." });
    }
    const eligible = input.items.filter((item) => item.productId === input.productId);
    if (!eligible.length) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Adicione o produto da recompensa ao pedido." });
    }
    const eligibleTotal = eligible.reduce((sum, item) => sum + Number(item.productPrice) * item.quantity, 0);
    discount = Math.min(eligibleTotal, value > 0 ? value : eligibleTotal);
  } else {
    discount = Math.min(input.subtotal, Math.max(0, value));
  }
  return {
    couponId: input.couponId,
    redemptionId: input.redemptionId,
    rewardId: input.rewardId,
    rewardType: input.rewardType,
    discount,
    freeDelivery,
    description: input.rewardName,
  };
}

function rewardBenefit(row: Awaited<ReturnType<typeof rewardCouponContext>>, subtotal: number, items: OrderItemForReward[]) {
  return calculateRewardBenefit({
    couponId: row.coupon.id,
    redemptionId: row.redemption.id,
    rewardId: row.reward.id,
    rewardType: row.reward.rewardType,
    rewardName: row.reward.name,
    value: row.reward.value,
    productId: row.reward.productId,
    subtotal,
    items,
  });
}

export async function validateRewardCoupon(input: {
  storeId: number;
  userId: number;
  code: string;
  subtotal: number;
  items?: OrderItemForReward[];
}) {
  const row = await rewardCouponContext(input.storeId, input.userId, input.code);
  return rewardBenefit(row, input.subtotal, input.items ?? []);
}

export async function consumeRewardCoupon(input: {
  storeId: number;
  userId: number;
  code: string;
  orderId: number;
}) {
  const db = await getDb();
  requireDatabase(db);
  const normalized = normalizeRewardCouponCode(input.code);
  return db.transaction(async (tx) => {
    const [coupon] = await tx.select().from(rewardCoupons)
      .where(and(
        eq(rewardCoupons.storeId, input.storeId),
        eq(rewardCoupons.code, normalized),
        eq(rewardCoupons.assignedUserId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!coupon || coupon.status !== "redeemed" || !coupon.redemptionId) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cupom indisponível ou já utilizado." });
    }
    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt <= now) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cupom expirado." });
    }
    const [redemption] = await tx.select().from(rewardRedemptions)
      .where(and(eq(rewardRedemptions.id, coupon.redemptionId), eq(rewardRedemptions.userId, input.userId)))
      .limit(1)
      .for("update");
    if (!redemption || redemption.status !== "completed") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Resgate inválido." });
    }
    await tx.insert(rewardCouponUsages).values({
      storeId: input.storeId,
      couponId: coupon.id,
      redemptionId: redemption.id,
      userId: input.userId,
      orderId: input.orderId,
    });
    await tx.update(rewardCoupons).set({ status: "used", usedAt: now }).where(eq(rewardCoupons.id, coupon.id));
    return { couponId: coupon.id, redemptionId: redemption.id };
  });
}

export async function listRewardRedemptionsForAdmin(storeId: number, rewardId?: number) {
  const db = await getDb();
  requireDatabase(db);
  const rows = await db.select({
    id: rewardRedemptions.id,
    rewardId: rewardRedemptions.rewardId,
    rewardName: rewardCatalog.name,
    userId: rewardRedemptions.userId,
    userName: users.name,
    userEmail: users.email,
    couponId: rewardRedemptions.couponId,
    couponCode: rewardCoupons.code,
    couponStatus: rewardCoupons.status,
    pointsSpent: rewardRedemptions.pointsSpent,
    status: rewardRedemptions.status,
    redeemedAt: rewardRedemptions.redeemedAt,
    expiresAt: rewardRedemptions.expiresAt,
    cancelledAt: rewardRedemptions.cancelledAt,
    cancellationReason: rewardRedemptions.cancellationReason,
  })
    .from(rewardRedemptions)
    .innerJoin(rewardCatalog, eq(rewardCatalog.id, rewardRedemptions.rewardId))
    .innerJoin(users, eq(users.id, rewardRedemptions.userId))
    .leftJoin(rewardCoupons, eq(rewardCoupons.id, rewardRedemptions.couponId))
    .where(and(
      eq(rewardRedemptions.storeId, storeId),
      rewardId ? eq(rewardRedemptions.rewardId, rewardId) : undefined,
    ))
    .orderBy(desc(rewardRedemptions.createdAt));
  return rows.map((row) => ({ ...row, couponCode: row.couponCode ? maskRewardCoupon(row.couponCode) : null }));
}

export async function cancelRewardRedemption(input: {
  storeId: number;
  redemptionId: number;
  reason: string;
}) {
  const db = await getDb();
  requireDatabase(db);
  return db.transaction(async (tx) => {
    const [redemption] = await tx.select().from(rewardRedemptions)
      .where(and(eq(rewardRedemptions.id, input.redemptionId), eq(rewardRedemptions.storeId, input.storeId)))
      .limit(1)
      .for("update");
    if (!redemption) throw new TRPCError({ code: "NOT_FOUND", message: "Resgate não encontrado." });
    if (redemption.status === "cancelled" || redemption.status === "refunded") return { alreadyCancelled: true };
    if (redemption.status !== "completed") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este resgate não pode ser cancelado." });
    }
    if (redemption.couponId) {
      const [usage] = await tx.select({ id: rewardCouponUsages.id }).from(rewardCouponUsages)
        .where(eq(rewardCouponUsages.couponId, redemption.couponId)).limit(1);
      if (usage) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cupom já utilizado em um pedido." });
    }
    const [account] = await tx.select().from(customerStoreAccounts)
      .where(and(
        eq(customerStoreAccounts.storeId, input.storeId),
        eq(customerStoreAccounts.userId, redemption.userId),
      ))
      .limit(1)
      .for("update");
    if (!account) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Conta de pontos não encontrada." });
    const balanceBefore = account.loyaltyPoints;
    const balanceAfter = balanceBefore + redemption.pointsSpent;
    await tx.update(customerStoreAccounts)
      .set({ loyaltyPoints: balanceAfter, updatedAt: new Date() })
      .where(eq(customerStoreAccounts.id, account.id));
    await tx.insert(loyaltyTransactions).values({
      storeId: input.storeId,
      userId: redemption.userId,
      type: "refund",
      points: redemption.pointsSpent,
      description: `Estorno do resgate #${redemption.id}`,
      balanceBefore,
      balanceAfter,
    });
    await tx.update(rewardRedemptions).set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: input.reason,
    }).where(eq(rewardRedemptions.id, redemption.id));
    if (redemption.couponId) {
      await tx.update(rewardCoupons).set({ status: "cancelled" }).where(eq(rewardCoupons.id, redemption.couponId));
    }
    return { alreadyCancelled: false, refundedPoints: redemption.pointsSpent, balanceAfter };
  });
}

