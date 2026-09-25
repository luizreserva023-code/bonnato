import { z } from "zod";

import { recordStoreAudit } from "../storeAudit.ts";
import { resolveRequiredStoreId } from "../storeUtils.ts";
import { protectedProcedure, publicProcedure, router, staffProcedure } from "../_core/trpc.ts";
import {
  addRewardCoupons,
  archiveReward,
  cancelRewardRedemption,
  createReward,
  generateRewardCoupons,
  getRewardDetail,
  getMyRewardsOverview,
  listMyRedemptions,
  listRewardCoupons,
  listRewardRedemptionsForAdmin,
  listRewards,
  listRewardsForAdmin,
  redeemReward,
  revealRewardCoupon,
  updateReward,
  validateRewardCoupon,
} from "../services/rewards.ts";
import {
  getReviewCashbackConfig,
  getReviewCashbackOffer,
  getReviewCashbackStats,
  saveReviewCashbackConfig,
} from "../services/reviewCashback.ts";

const storeInput = z.object({ storeId: z.number().int().positive() });
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const reviewCashbackConfigSchema = z.object({
  enabled: z.boolean(),
  campaignMode: z.enum(["order_reward", "order_reward_plus_google", "google_request"]),
  cashbackPercent: z.number().min(0).max(30),
  pointsPerRealCashback: z.number().min(0.1).max(1000),
  rewardBase: z.enum(["paid_products", "order_total"]),
  minimumOrderValue: z.number().min(0).max(1_000_000),
  maxPointsPerOrder: z.number().int().min(1).max(1_000_000).nullable(),
  validityEnabled: z.boolean(),
  offerValidityDays: z.number().int().min(1).max(365),
  notificationDelayMinutes: z.number().int().min(0).max(43_200),
  notificationTitle: z.string().trim().min(1).max(200),
  notificationMessage: z.string().trim().min(1).max(1000),
  externalReviewEnabled: z.boolean(),
  externalReviewUrl: z.string().trim().max(2000).refine(
    (value) => value === "" || /^https?:\/\//i.test(value),
    "Use um link externo http:// ou https:// válido.",
  ),
  externalReviewLabel: z.string().trim().min(1).max(80),
});

const rewardDataSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: nullableText(1000),
  rewardType: z.enum(["discount", "product", "free_delivery", "cashback"]),
  pointsCost: z.number().int().min(1).max(1_000_000),
  value: z.number().min(0).max(100_000),
  productId: z.number().int().positive().nullable().optional(),
  category: nullableText(80),
  icon: nullableText(64),
  imageUrl: z.string().trim().max(2000).refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    "Use uma URL http(s) ou um caminho iniciado por /.",
  ).nullable().optional(),
  badgeText: nullableText(64),
  buttonText: nullableText(64),
  stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
  maxRedemptionsPerUser: z.number().int().min(1).max(10_000).nullable().optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
  startsAt: z.date().nullable().optional(),
  expiresAt: z.date().nullable().optional(),
});

export const rewardsRouter = router({
  list: publicProcedure.input(storeInput).query(({ input }) => listRewards(input.storeId)),

  detail: publicProcedure
    .input(storeInput.extend({ rewardId: z.number().int().positive() }))
    .query(({ input }) => getRewardDetail(input.storeId, input.rewardId)),

  myOverview: protectedProcedure.input(storeInput)
    .query(({ ctx, input }) => getMyRewardsOverview(input.storeId, ctx.user.id)),

  myRedemptions: protectedProcedure.input(storeInput)
    .query(({ ctx, input }) => listMyRedemptions(input.storeId, ctx.user.id)),

  redeem: protectedProcedure.input(storeInput.extend({
    rewardId: z.number().int().positive(),
    idempotencyKey: z.string().trim().min(16).max(96).regex(/^[A-Za-z0-9_-]+$/),
  })).mutation(({ ctx, input }) => redeemReward({ ...input, userId: ctx.user.id })),

  reviewOffer: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .query(({ ctx, input }) => getReviewCashbackOffer({ orderId: input.orderId, userId: ctx.user.id })),

  validateCoupon: protectedProcedure.input(storeInput.extend({
    code: z.string().trim().min(4).max(64),
    subtotal: z.number().min(0).max(1_000_000),
    items: z.array(z.object({
      productId: z.number().int().positive(),
      productPrice: z.union([z.string(), z.number()]),
      quantity: z.number().int().min(1).max(99),
    })).max(50).optional(),
  })).query(({ ctx, input }) => validateRewardCoupon({ ...input, userId: ctx.user.id })),

  admin: router({
    reviewCashbackConfig: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return getReviewCashbackConfig(storeId);
    }),

    reviewCashbackStats: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return getReviewCashbackStats(storeId);
    }),

    saveReviewCashbackConfig: staffProcedure
      .input(storeInput.extend(reviewCashbackConfigSchema.shape))
      .mutation(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const { storeId: _storeId, ...config } = input;
        const saved = await saveReviewCashbackConfig(storeId, config);
        await recordStoreAudit({
          storeId,
          actorUserId: ctx.user.id,
          action: "reward.review_cashback_configured",
          resourceType: "review_cashback",
          resourceId: String(storeId),
          metadata: {
            enabled: saved.enabled,
            campaignMode: saved.campaignMode,
            cashbackPercent: saved.cashbackPercent,
            pointsPerRealCashback: saved.pointsPerRealCashback,
            validityEnabled: saved.validityEnabled,
            offerValidityDays: saved.offerValidityDays,
            externalReviewEnabled: saved.externalReviewEnabled,
          },
        });
        return saved;
      }),

    list: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return listRewardsForAdmin(storeId);
    }),

    create: staffProcedure.input(storeInput.extend(rewardDataSchema.shape)).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const { storeId: _storeId, ...data } = input;
      const rewardId = await createReward(storeId, data);
      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.created",
        resourceType: "reward",
        resourceId: rewardId,
        metadata: { newData: data },
      });
      return { id: rewardId };
    }),

    update: staffProcedure.input(storeInput.extend({
      rewardId: z.number().int().positive(),
      ...rewardDataSchema.partial().shape,
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const { storeId: _storeId, rewardId, ...changes } = input;
      const previous = await updateReward(storeId, rewardId, changes);
      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.updated",
        resourceType: "reward",
        resourceId: rewardId,
        metadata: { previousData: previous, newData: changes },
      });
      return { ok: true };
    }),

    archive: staffProcedure.input(storeInput.extend({ rewardId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const previous = await archiveReward(storeId, input.rewardId);
        await recordStoreAudit({
          storeId,
          actorUserId: ctx.user.id,
          action: "reward.archived",
          resourceType: "reward",
          resourceId: input.rewardId,
          metadata: { previousData: previous },
        });
        return { ok: true };
      }),

    addCoupons: staffProcedure.input(storeInput.extend({
      rewardId: z.number().int().positive(),
      codes: z.array(z.string().min(4).max(64)).min(1).max(1000),
      expiresAt: z.date().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await addRewardCoupons({ ...input, storeId });
      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.coupons_imported",
        resourceType: "reward",
        resourceId: input.rewardId,
        metadata: { count: result.inserted },
      });
      return result;
    }),

    generateCoupons: staffProcedure.input(storeInput.extend({
      rewardId: z.number().int().positive(),
      prefix: z.string().trim().max(24).default("CLUBE-"),
      quantity: z.number().int().min(1).max(1000),
      codeLength: z.number().int().min(4).max(24),
      expiresAt: z.date().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await generateRewardCoupons({ ...input, storeId });
      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.coupons_generated",
        resourceType: "reward",
        resourceId: input.rewardId,
        metadata: { count: result.inserted, prefix: input.prefix, codeLength: input.codeLength },
      });
      return result;
    }),

    coupons: staffProcedure.input(storeInput.extend({ rewardId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        return listRewardCoupons(storeId, input.rewardId);
      }),

    revealCoupon: staffProcedure.input(storeInput.extend({ couponId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const coupon = await revealRewardCoupon(storeId, input.couponId);
        await recordStoreAudit({
          storeId,
          actorUserId: ctx.user.id,
          action: "reward.coupon_revealed",
          resourceType: "reward_coupon",
          resourceId: input.couponId,
          metadata: { rewardId: coupon.rewardId },
        });
        return { code: coupon.code };
      }),

    exportCoupons: staffProcedure.input(storeInput.extend({ rewardId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const maskedRows = await listRewardCoupons(storeId, input.rewardId);
        const rows = await Promise.all(maskedRows.map(async (row) => ({
          ...row,
          code: (await revealRewardCoupon(storeId, row.id)).code,
        })));
        await recordStoreAudit({
          storeId,
          actorUserId: ctx.user.id,
          action: "reward.coupons_exported",
          resourceType: "reward",
          resourceId: input.rewardId,
          metadata: { count: rows.length },
        });
        return rows;
      }),

    redemptions: staffProcedure.input(storeInput.extend({ rewardId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        return listRewardRedemptionsForAdmin(storeId, input.rewardId);
      }),

    cancelRedemption: staffProcedure.input(storeInput.extend({
      redemptionId: z.number().int().positive(),
      reason: z.string().trim().min(5).max(500),
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await cancelRewardRedemption({ ...input, storeId });
      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.redemption_cancelled",
        resourceType: "reward_redemption",
        resourceId: input.redemptionId,
        metadata: { reason: input.reason, ...result },
      });
      return result;
    }),
  }),
});

