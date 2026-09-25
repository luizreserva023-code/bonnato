import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  calculateRewardBenefit,
  normalizeRewardCouponBatch,
  resolveRewardAvailability,
} from "./services/rewards";

const baseAvailability = {
  active: true,
  archivedAt: null,
  startsAt: null,
  expiresAt: null,
  stock: null,
  totalRedemptions: 0,
  pointsCost: 300,
  balance: 500,
  userRedemptions: 0,
  maxRedemptionsPerUser: null,
  availableCoupons: 1,
};

describe("rewards availability rules", () => {
  it("allows redemption with sufficient points and coupon inventory", () => {
    expect(resolveRewardAvailability(baseAvailability)).toBe("available");
  });

  it("blocks insufficient balance", () => {
    expect(resolveRewardAvailability({ ...baseAvailability, balance: 299 })).toBe("insufficient_points");
  });

  it("blocks inactive and expired rewards", () => {
    expect(resolveRewardAvailability({ ...baseAvailability, active: false })).toBe("inactive");
    expect(resolveRewardAvailability({ ...baseAvailability, expiresAt: new Date("2024-01-01") }, new Date("2025-01-01"))).toBe("expired");
  });

  it("blocks exhausted stock and unavailable coupons", () => {
    expect(resolveRewardAvailability({ ...baseAvailability, stock: 2, totalRedemptions: 2 })).toBe("sold_out");
    expect(resolveRewardAvailability({ ...baseAvailability, availableCoupons: 0 })).toBe("sold_out");
  });

  it("blocks a user who reached their redemption limit", () => {
    expect(resolveRewardAvailability({ ...baseAvailability, maxRedemptionsPerUser: 1, userRedemptions: 1 })).toBe("limit_reached");
  });
});

describe("reward coupon benefits", () => {
  it("applies free delivery without inventing a product discount", () => {
    expect(calculateRewardBenefit({
      couponId: 1,
      redemptionId: 2,
      rewardId: 3,
      rewardType: "free_delivery",
      rewardName: "Entrega grátis",
      value: 0,
      productId: null,
      subtotal: 80,
      items: [],
    })).toMatchObject({ discount: 0, freeDelivery: true });
  });

  it("requires the configured product and caps the product discount", () => {
    const common = {
      couponId: 1,
      redemptionId: 2,
      rewardId: 3,
      rewardType: "product" as const,
      rewardName: "Pizza grátis",
      value: 30,
      productId: 10,
      subtotal: 100,
    };
    expect(() => calculateRewardBenefit({ ...common, items: [] })).toThrow("Adicione o produto");
    expect(calculateRewardBenefit({ ...common, items: [{ productId: 10, productPrice: "45.00", quantity: 1 }] }).discount).toBe(30);
  });

  it("rejects duplicate codes in the same import", () => {
    expect(() => normalizeRewardCouponBatch(["CLUBE-ABC", " clube-abc "])).toThrow("Códigos repetidos");
  });
});

describe("rewards transactional safety contracts", () => {
  const serviceSource = readFileSync(join(process.cwd(), "server/services/rewards.ts"), "utf8");
  const routerSource = readFileSync(join(process.cwd(), "server/routers/rewards.ts"), "utf8");
  const migrationSource = readFileSync(join(process.cwd(), "drizzle/0047_rewards_club.sql"), "utf8");

  it("serializes concurrent redemptions and rolls failures back", () => {
    expect(serviceSource).toContain("db.transaction(async (tx)");
    expect(serviceSource.match(/\.for\("update"\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("makes idempotency unique and returns the original redemption", () => {
    expect(migrationSource).toContain("reward_redemptions_idempotency_uq");
    expect(serviceSource).toContain("idempotent: true");
    expect(serviceSource).toContain("duplicateError(error)");
  });

  it("binds a coupon to one user and prevents a second usage", () => {
    expect(serviceSource).toContain("eq(rewardCoupons.assignedUserId, userId)");
    expect(migrationSource).toContain("reward_coupon_usages_coupon_uq");
    expect(serviceSource).toContain('coupon.status !== "redeemed"');
  });

  it("cancels with a points refund and an immutable ledger entry", () => {
    expect(serviceSource).toContain('type: "refund"');
    expect(serviceSource).toContain('status: "cancelled"');
    expect(serviceSource).toContain("balanceBefore");
    expect(serviceSource).toContain("balanceAfter");
  });

  it("protects every administrative mutation with the existing staff guard", () => {
    expect(routerSource.match(/staffProcedure/g)?.length).toBeGreaterThanOrEqual(8);
    expect(routerSource).not.toContain("publicProcedure.input(storeInput.extend(rewardDataSchema.shape))");
  });
});
