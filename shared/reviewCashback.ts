export type ReviewCashbackBase = "paid_products" | "order_total";
export type ReviewCampaignMode = "order_reward" | "order_reward_plus_google" | "google_request";

export type ReviewCashbackConfig = {
  enabled: boolean;
  campaignMode: ReviewCampaignMode;
  cashbackPercent: number;
  pointsPerRealCashback: number;
  rewardBase: ReviewCashbackBase;
  minimumOrderValue: number;
  maxPointsPerOrder: number | null;
  validityEnabled: boolean;
  offerValidityDays: number;
  notificationDelayMinutes: number;
  notificationTitle: string;
  notificationMessage: string;
  externalReviewEnabled: boolean;
  externalReviewUrl: string;
  externalReviewLabel: string;
};

export const DEFAULT_REVIEW_CASHBACK_CONFIG: ReviewCashbackConfig = {
  enabled: false,
  campaignMode: "order_reward",
  cashbackPercent: 5,
  pointsPerRealCashback: 10,
  rewardBase: "paid_products",
  minimumOrderValue: 0,
  maxPointsPerOrder: null,
  validityEnabled: true,
  offerValidityDays: 7,
  notificationDelayMinutes: 60,
  notificationTitle: "🎁 Ganhe {{cashbackPercent}}% de volta em pontos",
  notificationMessage: "Avalie o pedido #{{orderNumber}} e receba {{estimatedPoints}} pontos para usar na próxima compra.",
  externalReviewEnabled: true,
  externalReviewUrl: "",
  externalReviewLabel: "Avaliar também no Google",
};

function finiteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeReviewCashbackConfig(value: unknown): ReviewCashbackConfig {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  const maxPointsRaw = source.maxPointsPerOrder;
  const maxPoints = maxPointsRaw == null || maxPointsRaw === ""
    ? null
    : Math.max(1, Math.floor(finiteNumber(maxPointsRaw, 1)));

  const campaignMode: ReviewCampaignMode =
    source.campaignMode === "google_request"
      ? "google_request"
      : source.campaignMode === "order_reward_plus_google"
        ? "order_reward_plus_google"
        : "order_reward";

  return {
    enabled: source.enabled === true,
    campaignMode,
    cashbackPercent: clamp(finiteNumber(source.cashbackPercent, 5), 0, 30),
    pointsPerRealCashback: clamp(finiteNumber(source.pointsPerRealCashback, 10), 0.1, 1000),
    rewardBase: source.rewardBase === "order_total" ? "order_total" : "paid_products",
    minimumOrderValue: clamp(finiteNumber(source.minimumOrderValue, 0), 0, 1_000_000),
    maxPointsPerOrder: maxPoints,
    validityEnabled: source.validityEnabled !== false,
    offerValidityDays: Math.max(1, Math.min(365, Math.floor(finiteNumber(source.offerValidityDays, 7)))),
    notificationDelayMinutes: Math.max(0, Math.min(43_200, Math.floor(finiteNumber(source.notificationDelayMinutes, 60)))),
    notificationTitle: typeof source.notificationTitle === "string" && source.notificationTitle.trim()
      ? source.notificationTitle.trim().slice(0, 200)
      : DEFAULT_REVIEW_CASHBACK_CONFIG.notificationTitle,
    notificationMessage: typeof source.notificationMessage === "string" && source.notificationMessage.trim()
      ? source.notificationMessage.trim().slice(0, 1000)
      : DEFAULT_REVIEW_CASHBACK_CONFIG.notificationMessage,
    externalReviewEnabled: source.externalReviewEnabled !== false,
    externalReviewUrl: typeof source.externalReviewUrl === "string" ? source.externalReviewUrl.trim().slice(0, 2000) : "",
    externalReviewLabel: typeof source.externalReviewLabel === "string" && source.externalReviewLabel.trim()
      ? source.externalReviewLabel.trim().slice(0, 80)
      : DEFAULT_REVIEW_CASHBACK_CONFIG.externalReviewLabel,
  };
}

export function parseReviewCashbackFromGrowthConfig(configJson: string | null | undefined): ReviewCashbackConfig {
  if (!configJson) return DEFAULT_REVIEW_CASHBACK_CONFIG;
  try {
    const parsed = JSON.parse(configJson) as Record<string, unknown>;
    return normalizeReviewCashbackConfig(parsed.reviewCashback);
  } catch {
    return DEFAULT_REVIEW_CASHBACK_CONFIG;
  }
}

export function mergeReviewCashbackIntoGrowthConfig(
  configJson: string | null | undefined,
  reviewCashback: ReviewCashbackConfig,
) {
  let root: Record<string, unknown> = {};
  if (configJson) {
    try {
      const parsed = JSON.parse(configJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) root = parsed;
    } catch {
      root = {};
    }
  }
  return JSON.stringify({ ...root, reviewCashback: normalizeReviewCashbackConfig(reviewCashback) });
}

export function calculateReviewCashback(input: {
  subtotal?: string | number | null;
  total?: string | number | null;
  deliveryFee?: string | number | null;
  config: ReviewCashbackConfig;
}) {
  const config = normalizeReviewCashbackConfig(input.config);
  const total = Math.max(0, finiteNumber(input.total, 0));
  const deliveryFee = Math.max(0, finiteNumber(input.deliveryFee, 0));
  const subtotal = Math.max(0, finiteNumber(input.subtotal, 0));

  const eligibleAmount = config.rewardBase === "order_total"
    ? total
    : Math.max(0, Math.min(subtotal, total - deliveryFee));

  if (
    !config.enabled
    || config.campaignMode === "google_request"
    || eligibleAmount < config.minimumOrderValue
    || config.cashbackPercent <= 0
  ) {
    return {
      eligibleAmount,
      cashbackValue: 0,
      points: 0,
    };
  }

  // Trabalha em centavos para evitar subcrédito por imprecisão de ponto flutuante
  // (ex.: 92 * 5% não pode virar R$ 4,59).
  const eligibleCents = Math.floor(eligibleAmount * 100 + 1e-9);
  const cashbackCents = Math.floor(eligibleCents * config.cashbackPercent / 100 + 1e-9);
  const cashbackValue = cashbackCents / 100;
  let points = Math.floor(cashbackValue * config.pointsPerRealCashback + 1e-9);
  if (config.maxPointsPerOrder != null) points = Math.min(points, config.maxPointsPerOrder);

  return {
    eligibleAmount,
    cashbackValue,
    points: Math.max(0, points),
  };
}

export function reviewOfferExpiresAt(
  deliveredAt: Date | string | null | undefined,
  config: ReviewCashbackConfig,
) {
  if (!config.validityEnabled || !deliveredAt) return null;
  const delivered = new Date(deliveredAt);
  if (Number.isNaN(delivered.getTime())) return null;
  return new Date(delivered.getTime() + config.offerValidityDays * 24 * 60 * 60 * 1000);
}

export function interpolateReviewCashbackMessage(
  template: string,
  values: { orderNumber: string; estimatedPoints: number; cashbackPercent: number },
) {
  return template
    .replace(/\{\{orderNumber\}\}/g, values.orderNumber)
    .replace(/\{\{estimatedPoints\}\}/g, String(values.estimatedPoints))
    .replace(/\{\{cashbackPercent\}\}/g, String(values.cashbackPercent));
}
