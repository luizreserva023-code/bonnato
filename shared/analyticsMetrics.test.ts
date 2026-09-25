import { describe, expect, it } from "vitest";
import {
  buildFunnelSeries,
  buildSequentialFunnelCounts,
  calculateAverageTicket,
  calculatePeriodVariation,
  rankProductsBySales,
  safePercentage,
} from "./analyticsMetrics";

describe("analytics metrics", () => {
  it("calculates average ticket from considered revenue and orders", () => {
    expect(calculateAverageTicket(1000, 20)).toBe(50);
    expect(calculateAverageTicket(0, 0)).toBe(0);
  });

  it("never returns invalid percentages for an empty denominator", () => {
    expect(safePercentage(12, 0)).toBe(0);
    expect(safePercentage(1, Number.NaN)).toBe(0);
    expect(safePercentage(25, 100)).toBe(25);
  });

  it("compares periods without inventing an infinite variation", () => {
    expect(calculatePeriodVariation(150, 100)).toBe(50);
    expect(calculatePeriodVariation(50, 100)).toBe(-50);
    expect(calculatePeriodVariation(0, 0)).toBe(0);
    expect(calculatePeriodVariation(10, 0)).toBeNull();
  });

  it("builds funnel rates using the first stage as the common base", () => {
    const stages = ["MENU_VIEW", "PRODUCT_VIEW", "ADD_TO_CART", "ORDER_CREATED"] as const;
    const counts = new Map<typeof stages[number], number>([
      ["MENU_VIEW", 100],
      ["PRODUCT_VIEW", 80],
      ["ADD_TO_CART", 40],
      ["ORDER_CREATED", 20],
    ]);
    expect(buildFunnelSeries(stages, counts)).toEqual([
      { eventType: "MENU_VIEW", value: 100, rate: 100 },
      { eventType: "PRODUCT_VIEW", value: 80, rate: 80 },
      { eventType: "ADD_TO_CART", value: 40, rate: 40 },
      { eventType: "ORDER_CREATED", value: 20, rate: 20 },
    ]);
  });

  it("returns zero funnel rates when there are no menu sessions", () => {
    const stages = ["MENU_VIEW", "PRODUCT_VIEW"] as const;
    const counts = new Map<typeof stages[number], number>();
    expect(buildFunnelSeries(stages, counts)).toEqual([
      { eventType: "MENU_VIEW", value: 0, rate: 0 },
      { eventType: "PRODUCT_VIEW", value: 0, rate: 0 },
    ]);
  });

  it("counts only sessions that advance through funnel stages in order", () => {
    const stages = ["MENU_VIEW", "PRODUCT_VIEW", "ADD_TO_CART", "CHECKOUT_STARTED", "ORDER_CREATED"] as const;
    const events: Array<{ sessionKey: string; eventType: typeof stages[number] }> = [
      { sessionKey: "1:a", eventType: "MENU_VIEW" },
      { sessionKey: "1:a", eventType: "PRODUCT_VIEW" },
      { sessionKey: "1:a", eventType: "ADD_TO_CART" },
      { sessionKey: "1:a", eventType: "CHECKOUT_STARTED" },
      { sessionKey: "1:a", eventType: "ORDER_CREATED" },

      // Sessão sem visita ao cardápio não entra no funil.
      { sessionKey: "1:b", eventType: "PRODUCT_VIEW" },
      { sessionKey: "1:b", eventType: "ADD_TO_CART" },
      { sessionKey: "1:b", eventType: "CHECKOUT_STARTED" },

      // Evento fora de ordem não pula etapa.
      { sessionKey: "1:c", eventType: "MENU_VIEW" },
      { sessionKey: "1:c", eventType: "ADD_TO_CART" },
      { sessionKey: "1:c", eventType: "PRODUCT_VIEW" },
      { sessionKey: "1:c", eventType: "CHECKOUT_STARTED" },

      // Outra loja com o mesmo sessionId permanece isolada pelo sessionKey.
      { sessionKey: "2:a", eventType: "MENU_VIEW" },
      { sessionKey: "2:a", eventType: "PRODUCT_VIEW" },
    ];

    const counts = buildSequentialFunnelCounts(stages, events);
    expect(Array.from(counts.entries())).toEqual([
      ["MENU_VIEW", 3],
      ["PRODUCT_VIEW", 3],
      ["ADD_TO_CART", 1],
      ["CHECKOUT_STARTED", 1],
      ["ORDER_CREATED", 1],
    ]);
  });

  it("never allows a sequential funnel stage to exceed the previous stage", () => {
    const stages = ["MENU_VIEW", "PRODUCT_VIEW", "ADD_TO_CART"] as const;
    const counts = buildSequentialFunnelCounts(stages, [
      { sessionKey: "s1", eventType: "ADD_TO_CART" },
      { sessionKey: "s2", eventType: "PRODUCT_VIEW" },
      { sessionKey: "s3", eventType: "MENU_VIEW" },
      { sessionKey: "s3", eventType: "PRODUCT_VIEW" },
      { sessionKey: "s3", eventType: "ADD_TO_CART" },
    ]);

    const values = stages.map((stage) => counts.get(stage) ?? 0);
    expect(values).toEqual([1, 1, 1]);
    expect(values.every((value, index) => index === 0 || value <= values[index - 1])).toBe(true);
  });

  it("ranks best sellers by quantity then revenue", () => {
    const rows = [
      { id: 1, soldQuantity: 5, revenue: 100, views: 50 },
      { id: 2, soldQuantity: 10, revenue: 80, views: 20 },
      { id: 3, soldQuantity: 10, revenue: 120, views: 10 },
    ];
    expect(rankProductsBySales(rows, "best").map((row) => row.id)).toEqual([3, 2, 1]);
  });

  it("ranks low sellers with exposure context instead of hiding traffic", () => {
    const rows = [
      { id: 1, soldQuantity: 0, revenue: 0, views: 5 },
      { id: 2, soldQuantity: 0, revenue: 0, views: 80 },
      { id: 3, soldQuantity: 1, revenue: 20, views: 100 },
    ];
    expect(rankProductsBySales(rows, "worst").map((row) => row.id)).toEqual([2, 1, 3]);
  });
});
