import { and, eq, sql } from "drizzle-orm";

import {
  customerStoreAccounts,
  growthSettings,
  loyaltyTransactions,
  orders,
  reviewRewardCredits,
} from "../../drizzle/schema.ts";
import {
  calculateReviewCashback,
  DEFAULT_REVIEW_CASHBACK_CONFIG,
  mergeReviewCashbackIntoGrowthConfig,
  normalizeReviewCashbackConfig,
  parseReviewCashbackFromGrowthConfig,
  reviewOfferExpiresAt,
  type ReviewCashbackConfig,
} from "../../shared/reviewCashback.ts";
import { getDb } from "../db.ts";

export async function getReviewCashbackConfig(storeId: number): Promise<ReviewCashbackConfig> {
  const db = await getDb();
  if (!db) return DEFAULT_REVIEW_CASHBACK_CONFIG;
  const [row] = await db
    .select({ config: growthSettings.config })
    .from(growthSettings)
    .where(eq(growthSettings.storeId, storeId))
    .limit(1);
  return parseReviewCashbackFromGrowthConfig(row?.config);
}

export async function saveReviewCashbackConfig(storeId: number, input: ReviewCashbackConfig) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const normalized = normalizeReviewCashbackConfig(input);
  const [existing] = await db
    .select({ config: growthSettings.config })
    .from(growthSettings)
    .where(eq(growthSettings.storeId, storeId))
    .limit(1);

  const config = mergeReviewCashbackIntoGrowthConfig(existing?.config, normalized);
  await db
    .insert(growthSettings)
    .values({ storeId, config })
    .onConflictDoUpdate({
      target: growthSettings.storeId,
      set: { config, updatedAt: new Date() },
    });

  return normalized;
}

export function isReviewCashbackOfferOpen(
  deliveredAt: Date | string | null | undefined,
  config: ReviewCashbackConfig,
  now = new Date(),
) {
  if (!config.enabled) return false;
  const expiresAt = reviewOfferExpiresAt(deliveredAt, config);
  return !expiresAt || expiresAt.getTime() > now.getTime();
}

export async function getReviewCashbackOffer(input: {
  orderId: number;
  userId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)))
    .limit(1);

  if (!order || !order.storeId || order.status !== "delivered") return null;

  const config = await getReviewCashbackConfig(order.storeId);
  const calculation = calculateReviewCashback({
    subtotal: order.subtotal,
    total: order.total,
    deliveryFee: order.deliveryFee,
    config,
  });
  const expiresAt = reviewOfferExpiresAt(order.deliveredAt ?? order.updatedAt, config);
  const open = isReviewCashbackOfferOpen(order.deliveredAt ?? order.updatedAt, config);

  const [credit] = await db
    .select()
    .from(reviewRewardCredits)
    .where(eq(reviewRewardCredits.orderId, order.id))
    .limit(1);

  const rewardByOrderReview = config.campaignMode !== "google_request";
  const showGoogleLink =
    config.campaignMode !== "order_reward"
    && config.externalReviewEnabled
    && Boolean(config.externalReviewUrl);

  return {
    enabled: config.enabled,
    open,
    campaignMode: config.campaignMode,
    rewardByOrderReview,
    cashbackPercent: config.cashbackPercent,
    estimatedPoints: rewardByOrderReview ? calculation.points : 0,
    estimatedCashbackValue: rewardByOrderReview ? calculation.cashbackValue : 0,
    eligibleAmount: calculation.eligibleAmount,
    expiresAt,
    alreadyAwarded: Boolean(credit),
    awardedPoints: credit?.pointsAwarded ?? 0,
    externalReviewEnabled: showGoogleLink,
    externalReviewUrl: config.externalReviewUrl,
    externalReviewLabel: config.externalReviewLabel,
  };
}

export async function awardReviewCashback(input: {
  orderId: number;
  orderReviewId: number;
  userId: number;
  storeId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [order] = await db
    .select()
    .from(orders)
    .where(and(
      eq(orders.id, input.orderId),
      eq(orders.storeId, input.storeId),
      eq(orders.userId, input.userId),
      eq(orders.status, "delivered"),
    ))
    .limit(1);

  if (!order) {
    return { awarded: false as const, reason: "order_not_eligible" as const, points: 0 };
  }

  const config = await getReviewCashbackConfig(input.storeId);
  if (config.campaignMode === "google_request") {
    return { awarded: false as const, reason: "google_request_mode" as const, points: 0 };
  }
  if (!isReviewCashbackOfferOpen(order.deliveredAt ?? order.updatedAt, config)) {
    return { awarded: false as const, reason: config.enabled ? "offer_expired" as const : "disabled" as const, points: 0 };
  }

  const calculation = calculateReviewCashback({
    subtotal: order.subtotal,
    total: order.total,
    deliveryFee: order.deliveryFee,
    config,
  });

  if (calculation.points <= 0) {
    return { awarded: false as const, reason: "no_points" as const, points: 0 };
  }

  const offerExpiresAt = reviewOfferExpiresAt(order.deliveredAt ?? order.updatedAt, config);
  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(reviewRewardCredits)
      .values({
        storeId: input.storeId,
        orderId: order.id,
        orderReviewId: input.orderReviewId,
        userId: input.userId,
        eligibleAmount: calculation.eligibleAmount.toFixed(2),
        cashbackValue: calculation.cashbackValue.toFixed(2),
        rewardPercent: config.cashbackPercent.toFixed(2),
        pointsPerReal: config.pointsPerRealCashback.toFixed(3),
        pointsAwarded: calculation.points,
        offerExpiresAt,
        configSnapshot: JSON.stringify(config),
      })
      .onConflictDoNothing({ target: reviewRewardCredits.orderId })
      .returning({ id: reviewRewardCredits.id });

    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(reviewRewardCredits)
        .where(eq(reviewRewardCredits.orderId, order.id))
        .limit(1);
      return {
        awarded: false as const,
        reason: "already_awarded" as const,
        points: existing?.pointsAwarded ?? 0,
        cashbackValue: Number(existing?.cashbackValue ?? 0),
      };
    }

    await tx
      .insert(customerStoreAccounts)
      .values({
        storeId: input.storeId,
        userId: input.userId,
        loyaltyPoints: 0,
      })
      .onConflictDoNothing({
        target: [customerStoreAccounts.storeId, customerStoreAccounts.userId],
      });

    const [account] = await tx
      .select()
      .from(customerStoreAccounts)
      .where(and(
        eq(customerStoreAccounts.storeId, input.storeId),
        eq(customerStoreAccounts.userId, input.userId),
      ))
      .limit(1);

    if (!account) throw new Error("Customer store account unavailable");

    const [updated] = await tx
      .update(customerStoreAccounts)
      .set({
        loyaltyPoints: sql`${customerStoreAccounts.loyaltyPoints} + ${calculation.points}`,
        updatedAt: new Date(),
      })
      .where(eq(customerStoreAccounts.id, account.id))
      .returning({ loyaltyPoints: customerStoreAccounts.loyaltyPoints });

    const balanceAfter = updated?.loyaltyPoints ?? account.loyaltyPoints + calculation.points;
    await tx.insert(loyaltyTransactions).values({
      storeId: input.storeId,
      userId: input.userId,
      orderId: order.id,
      type: "earn",
      points: calculation.points,
      description: `+${calculation.points} pontos — ${config.cashbackPercent}% de cashback pela avaliação do pedido #${order.orderNumber || order.id}`,
      balanceBefore: account.loyaltyPoints,
      balanceAfter,
    });

    return {
      awarded: true as const,
      reason: "awarded" as const,
      points: calculation.points,
      cashbackValue: calculation.cashbackValue,
      newBalance: balanceAfter,
    };
  });

  return {
    ...result,
    cashbackPercent: config.cashbackPercent,
    externalReviewEnabled:
      config.campaignMode === "order_reward_plus_google"
      && config.externalReviewEnabled
      && Boolean(config.externalReviewUrl),
    externalReviewUrl: config.externalReviewUrl,
    externalReviewLabel: config.externalReviewLabel,
  };
}

export async function getReviewRewardCredit(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const [credit] = await db
    .select()
    .from(reviewRewardCredits)
    .where(eq(reviewRewardCredits.orderId, orderId))
    .limit(1);
  return credit ?? null;
}

export async function getReviewCashbackStats(storeId: number) {
  const db = await getDb();
  if (!db) {
    return { rewardsGranted: 0, pointsGranted: 0, cashbackValue: 0, uniqueCustomers: 0 };
  }

  const [row] = await db
    .select({
      rewardsGranted: sql<number>`COUNT(*)::int`,
      pointsGranted: sql<number>`COALESCE(SUM(${reviewRewardCredits.pointsAwarded}), 0)::int`,
      cashbackValue: sql<string>`COALESCE(SUM(${reviewRewardCredits.cashbackValue}), 0)::numeric`,
      uniqueCustomers: sql<number>`COUNT(DISTINCT ${reviewRewardCredits.userId})::int`,
    })
    .from(reviewRewardCredits)
    .where(eq(reviewRewardCredits.storeId, storeId));

  return {
    rewardsGranted: Number(row?.rewardsGranted ?? 0),
    pointsGranted: Number(row?.pointsGranted ?? 0),
    cashbackValue: Number(row?.cashbackValue ?? 0),
    uniqueCustomers: Number(row?.uniqueCustomers ?? 0),
  };
}
