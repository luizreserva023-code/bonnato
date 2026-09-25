import { describe, expect, it } from "vitest";
import {
  calculateReviewCashback,
  DEFAULT_REVIEW_CASHBACK_CONFIG,
  mergeReviewCashbackIntoGrowthConfig,
  parseReviewCashbackFromGrowthConfig,
  reviewOfferExpiresAt,
} from "../shared/reviewCashback.ts";

describe("review cashback", () => {
  it("converte 5% de cashback em pontos usando 10 pontos por real", () => {
    const result = calculateReviewCashback({
      subtotal: 100,
      total: 110,
      deliveryFee: 10,
      config: { ...DEFAULT_REVIEW_CASHBACK_CONFIG, enabled: true },
    });
    expect(result.eligibleAmount).toBe(100);
    expect(result.cashbackValue).toBe(5);
    expect(result.points).toBe(50);
  });

  it("não inclui a entrega quando a base é produtos pagos", () => {
    const result = calculateReviewCashback({
      subtotal: 80,
      total: 92,
      deliveryFee: 12,
      config: { ...DEFAULT_REVIEW_CASHBACK_CONFIG, enabled: true, cashbackPercent: 5 },
    });
    expect(result.eligibleAmount).toBe(80);
    expect(result.cashbackValue).toBe(4);
    expect(result.points).toBe(40);
  });

  it("pode usar o total do pedido quando configurado", () => {
    const result = calculateReviewCashback({
      subtotal: 80,
      total: 92,
      deliveryFee: 12,
      config: {
        ...DEFAULT_REVIEW_CASHBACK_CONFIG,
        enabled: true,
        rewardBase: "order_total",
        cashbackPercent: 5,
      },
    });
    expect(result.eligibleAmount).toBe(92);
    expect(result.cashbackValue).toBe(4.6);
    expect(result.points).toBe(46);
  });

  it("respeita pedido mínimo e limite máximo de pontos", () => {
    expect(calculateReviewCashback({
      subtotal: 49,
      total: 49,
      deliveryFee: 0,
      config: { ...DEFAULT_REVIEW_CASHBACK_CONFIG, enabled: true, minimumOrderValue: 50 },
    }).points).toBe(0);

    expect(calculateReviewCashback({
      subtotal: 500,
      total: 500,
      deliveryFee: 0,
      config: {
        ...DEFAULT_REVIEW_CASHBACK_CONFIG,
        enabled: true,
        cashbackPercent: 5,
        maxPointsPerOrder: 100,
      },
    }).points).toBe(100);
  });

  it("não concede pontos quando a automação está desativada", () => {
    const result = calculateReviewCashback({
      subtotal: 100,
      total: 100,
      deliveryFee: 0,
      config: DEFAULT_REVIEW_CASHBACK_CONFIG,
    });
    expect(result.points).toBe(0);
    expect(result.cashbackValue).toBe(0);
  });

  it("não concede pontos quando a campanha é somente solicitação no Google", () => {
    const result = calculateReviewCashback({
      subtotal: 100,
      total: 100,
      deliveryFee: 0,
      config: {
        ...DEFAULT_REVIEW_CASHBACK_CONFIG,
        enabled: true,
        campaignMode: "google_request",
      },
    });
    expect(result.points).toBe(0);
    expect(result.cashbackValue).toBe(0);
  });

  it("calcula validade a partir da entrega e permite campanha sem prazo", () => {
    const deliveredAt = new Date("2026-09-21T12:00:00Z");
    const expires = reviewOfferExpiresAt(deliveredAt, {
      ...DEFAULT_REVIEW_CASHBACK_CONFIG,
      validityEnabled: true,
      offerValidityDays: 7,
    });
    expect(expires?.toISOString()).toBe("2026-09-28T12:00:00.000Z");

    expect(reviewOfferExpiresAt(deliveredAt, {
      ...DEFAULT_REVIEW_CASHBACK_CONFIG,
      validityEnabled: false,
    })).toBeNull();
  });

  it("preserva outras configurações de growth ao salvar o cashback", () => {
    const current = JSON.stringify({ referralEnabled: true, customField: "keep" });
    const merged = mergeReviewCashbackIntoGrowthConfig(current, {
      ...DEFAULT_REVIEW_CASHBACK_CONFIG,
      enabled: true,
      cashbackPercent: 5,
    });
    const parsed = JSON.parse(merged);
    expect(parsed.referralEnabled).toBe(true);
    expect(parsed.customField).toBe("keep");
    expect(parseReviewCashbackFromGrowthConfig(merged).cashbackPercent).toBe(5);
  });
});
