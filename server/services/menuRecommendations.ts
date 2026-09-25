import { and, eq, inArray } from "drizzle-orm";

import {
  menuRecommendationDismissals,
  productOptionGroups,
} from "../../drizzle/schema.ts";
import { getDb } from "../db.ts";
import { getProductPerformance } from "./analytics.ts";

export type MenuRecommendationRule =
  | "MISSING_IMAGE"
  | "MISSING_DESCRIPTION"
  | "PAUSED_BEST_SELLER"
  | "HIGH_VIEWS_LOW_CONVERSION"
  | "HIGH_CONVERSION_LOW_EXPOSURE"
  | "LOW_PERFORMANCE"
  | "HIGH_CART_ABANDONMENT"
  | "PRODUCT_WITHOUT_COMPLEMENTS";

export type MenuRecommendation = {
  key: string;
  ruleType: MenuRecommendationRule;
  severity: "info" | "warning" | "opportunity";
  productId: number;
  productName: string;
  categoryId: number;
  categoryName: string;
  title: string;
  description: string;
  action: "edit_product" | "view_performance";
  evidence: {
    views: number;
    cartSessions: number;
    checkoutSessions: number;
    buyerSessions: number;
    soldQuantity: number;
    revenue: number;
    conversionRate: number;
    cartRate: number;
    checkoutRate: number;
    cartPurchaseRate: number;
    checkoutConversionRate: number;
  };
};

type PerformanceRow = Awaited<ReturnType<typeof getProductPerformance>>[number];

const MIN_SAMPLE_VIEWS = 20;
const LOW_PERFORMANCE_MIN_VIEWS = 10;
const CART_ABANDONMENT_MIN_CARTS = 10;
const HIGH_CART_ABANDONMENT_MAX_PURCHASE_RATE = 35;

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function metricBucket(value: number, size: number) {
  return Math.floor(Math.max(0, value) / size);
}

function recommendationKey(rule: MenuRecommendationRule, row: PerformanceRow) {
  // The key changes only when product version or evidence moves into another
  // meaningful bucket, allowing a dismissed recommendation to return after
  // the underlying condition changes significantly.
  return [
    rule,
    row.id,
    `v${row.version ?? 1}`,
    `vw${metricBucket(row.views, 25)}`,
    `cv${metricBucket(row.conversionRate, 5)}`,
    `ct${metricBucket(row.cartSessions, 15)}`,
  ].join(":");
}

function evidence(row: PerformanceRow): MenuRecommendation["evidence"] {
  return {
    views: row.views,
    cartSessions: row.cartSessions,
    checkoutSessions: row.checkoutSessions,
    buyerSessions: row.buyerSessions,
    soldQuantity: row.soldQuantity,
    revenue: row.revenue,
    conversionRate: row.conversionRate,
    cartRate: row.cartRate,
    checkoutRate: row.checkoutRate,
    cartPurchaseRate: row.cartPurchaseRate,
    checkoutConversionRate: row.checkoutConversionRate,
  };
}

function makeRecommendation(
  ruleType: MenuRecommendationRule,
  row: PerformanceRow,
  title: string,
  description: string,
  severity: MenuRecommendation["severity"],
  action: MenuRecommendation["action"],
): MenuRecommendation {
  return {
    key: recommendationKey(ruleType, row),
    ruleType,
    severity,
    productId: row.id,
    productName: row.name,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    title,
    description,
    action,
    evidence: evidence(row),
  };
}

export async function getMenuRecommendations(input: {
  storeId: number;
  startDate: Date;
  endDate: Date;
  limit?: number;
}): Promise<MenuRecommendation[]> {
  const db = await getDb();
  if (!db) return [];

  const performance = await getProductPerformance({
    storeId: input.storeId,
    startDate: input.startDate,
    endDate: input.endDate,
    limit: 500,
  });

  if (!performance.length) return [];

  const productIds = performance.map((row) => row.id);
  const groupRows = productIds.length
    ? await db
        .select({ productId: productOptionGroups.productId })
        .from(productOptionGroups)
        .where(and(
          eq(productOptionGroups.storeId, input.storeId),
          eq(productOptionGroups.active, true),
          inArray(productOptionGroups.productId, productIds),
        ))
    : [];
  const productsWithComplements = new Set(groupRows.map((row) => row.productId));

  const categoryStats = new Map<number, { avgViews: number; avgConversion: number }>();
  for (const categoryId of new Set(performance.map((row) => row.categoryId))) {
    const rows = performance.filter((row) => row.categoryId === categoryId);
    categoryStats.set(categoryId, {
      avgViews: avg(rows.map((row) => row.views)),
      avgConversion: avg(rows.filter((row) => row.views >= 5).map((row) => row.conversionRate)),
    });
  }

  const positiveSales = performance
    .map((row) => row.soldQuantity)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const bestSellerThreshold = positiveSales.length
    ? Math.max(2, positiveSales[Math.floor((positiveSales.length - 1) * 0.75)] ?? 2)
    : Number.POSITIVE_INFINITY;

  const recommendations: MenuRecommendation[] = [];

  for (const row of performance) {
    const stats = categoryStats.get(row.categoryId) ?? { avgViews: 0, avgConversion: 0 };

    if (!row.imageUrl) {
      recommendations.push(makeRecommendation(
        "MISSING_IMAGE",
        row,
        `${row.name} está sem imagem`,
        "O produto está publicado sem imagem cadastrada. Isso é um dado objetivo do cadastro atual.",
        "warning",
        "edit_product",
      ));
    }

    if (!row.description?.trim() && !row.shortDescription?.trim()) {
      recommendations.push(makeRecommendation(
        "MISSING_DESCRIPTION",
        row,
        `${row.name} está sem descrição`,
        "O cadastro atual não possui descrição curta nem descrição completa.",
        "warning",
        "edit_product",
      ));
    }

    if (!row.active && row.soldQuantity >= bestSellerThreshold) {
      recommendations.push(makeRecommendation(
        "PAUSED_BEST_SELLER",
        row,
        `${row.name} vendeu bem no período e está pausado`,
        `Foram ${row.soldQuantity} unidade(s) vendidas no período selecionado, mas o produto está inativo agora.`,
        "warning",
        "view_performance",
      ));
    }

    if (
      row.views >= MIN_SAMPLE_VIEWS &&
      row.views >= Math.max(MIN_SAMPLE_VIEWS, stats.avgViews) &&
      stats.avgConversion > 0 &&
      row.conversionRate < stats.avgConversion * 0.6
    ) {
      recommendations.push(makeRecommendation(
        "HIGH_VIEWS_LOW_CONVERSION",
        row,
        `${row.name} tem exposição alta e conversão abaixo da categoria`,
        `${row.views} sessões visualizaram o produto e ${row.conversionRate.toFixed(1)}% compraram. A média de conversão da categoria no mesmo período é ${stats.avgConversion.toFixed(1)}%.`,
        "warning",
        "view_performance",
      ));
    }

    if (
      row.views >= 5 &&
      stats.avgViews >= 10 &&
      row.views < stats.avgViews * 0.6 &&
      stats.avgConversion > 0 &&
      row.conversionRate >= stats.avgConversion * 1.25 &&
      row.soldQuantity > 0
    ) {
      recommendations.push(makeRecommendation(
        "HIGH_CONVERSION_LOW_EXPOSURE",
        row,
        `${row.name} converte bem com pouca exposição`,
        `A conversão é ${row.conversionRate.toFixed(1)}% em ${row.views} sessões, acima da média de ${stats.avgConversion.toFixed(1)}% da categoria, mas com menos visualizações que a média da categoria.`,
        "opportunity",
        "view_performance",
      ));
    }

    if (row.views >= LOW_PERFORMANCE_MIN_VIEWS && row.soldQuantity === 0) {
      recommendations.push(makeRecommendation(
        "LOW_PERFORMANCE",
        row,
        `${row.name} recebeu visualizações e não gerou vendas`,
        `O produto teve ${row.views} sessões com visualização e nenhuma unidade vendida no período selecionado.`,
        "info",
        "view_performance",
      ));
    }

    if (
      row.cartSessions >= CART_ABANDONMENT_MIN_CARTS &&
      row.cartPurchaseRate < HIGH_CART_ABANDONMENT_MAX_PURCHASE_RATE
    ) {
      recommendations.push(makeRecommendation(
        "HIGH_CART_ABANDONMENT",
        row,
        `${row.name} chega ao carrinho, mas poucos desses carrinhos viram compra`,
        `${row.cartSessions} sessões adicionaram o produto ao carrinho e ${row.cartPurchaseRate.toFixed(1)}% dessas sessões aparecem associadas a uma compra concluída.`,
        "warning",
        "view_performance",
      ));
    }

    if (!productsWithComplements.has(row.id) && ["buildable", "combo"].includes(row.productType ?? "")) {
      recommendations.push(makeRecommendation(
        "PRODUCT_WITHOUT_COMPLEMENTS",
        row,
        `${row.name} está configurado como ${row.productType === "combo" ? "combo" : "personalizável"} sem grupo de complementos ativo`,
        "O tipo atual do produto pressupõe escolhas/configuração, mas não há grupo de complementos ativo vinculado.",
        "warning",
        "edit_product",
      ));
    }
  }

  const keys = recommendations.map((item) => item.key);
  const dismissals = keys.length
    ? await db
        .select({ recommendationKey: menuRecommendationDismissals.recommendationKey })
        .from(menuRecommendationDismissals)
        .where(and(
          eq(menuRecommendationDismissals.storeId, input.storeId),
          inArray(menuRecommendationDismissals.recommendationKey, keys),
        ))
    : [];
  const dismissed = new Set(dismissals.map((row) => row.recommendationKey));

  const severityWeight = { warning: 3, opportunity: 2, info: 1 };
  return recommendations
    .filter((item) => !dismissed.has(item.key))
    .sort((a, b) => {
      const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
      if (severityDiff) return severityDiff;
      return b.evidence.views - a.evidence.views;
    })
    .slice(0, Math.max(1, Math.min(input.limit ?? 12, 50)));
}
