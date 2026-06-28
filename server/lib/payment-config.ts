import { z } from "zod";

import { getAllStoreSettings, setStoreSetting } from "../db.ts";

const PAYMENT_CONFIG_KEY = "paymentConfig";

export const paymentConfigSchema = z.object({
  orders: z.object({
    onlineEnabled: z.boolean().default(true),
    cardEnabled: z.boolean().default(true),
    pixEnabled: z.boolean().default(true),
    cashEnabled: z.boolean().default(true),
    pixMode: z.enum(["dynamic_asaas", "manual_key"]).default("dynamic_asaas"),
    savedCardsEnabled: z.boolean().default(true),
  }).default({
    onlineEnabled: true,
    cardEnabled: true,
    pixEnabled: true,
    cashEnabled: true,
    pixMode: "dynamic_asaas",
    savedCardsEnabled: true,
  }),
  club: z.object({
    enabled: z.boolean().default(true),
    checkoutMode: z.enum(["manual_pix"]).default("manual_pix"),
  }).default({
    enabled: true,
    checkoutMode: "manual_pix",
  }),
  pix: z.object({
    merchantName: z.string().trim().min(2).max(25).default("Bonatto Pizza"),
    merchantCity: z.string().trim().min(2).max(15).default("MATEUS LEME"),
    instructions: z.string().trim().max(300).default(""),
  }).default({
    merchantName: "Bonatto Pizza",
    merchantCity: "MATEUS LEME",
    instructions: "",
  }),
});

export type PaymentConfig = z.infer<typeof paymentConfigSchema>;

type PaymentRuntimeStatus = {
  publicAppUrl: string;
  stripeReady: boolean;
  stripeWebhookReady: boolean;
  asaasReady: boolean;
  manualPixReady: boolean;
  stripeWebhookUrl: string;
  asaasWebhookUrl: string;
};

type PaymentAvailability = {
  orders: {
    card: boolean;
    pix: boolean;
    cash: boolean;
    savedCards: boolean;
    pixMode: PaymentConfig["orders"]["pixMode"];
  };
  club: {
    enabled: boolean;
    checkoutMode: PaymentConfig["club"]["checkoutMode"];
  };
};

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = paymentConfigSchema.parse({});

export function normalizePaymentConfig(raw: unknown): PaymentConfig {
  if (!raw) return DEFAULT_PAYMENT_CONFIG;
  if (typeof raw === "string") {
    try {
      return paymentConfigSchema.parse(JSON.parse(raw));
    } catch {
      return DEFAULT_PAYMENT_CONFIG;
    }
  }
  return paymentConfigSchema.parse(raw);
}

export function getPaymentRuntimeStatus(pixKey: string): PaymentRuntimeStatus {
  const publicAppUrl = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripeWebhookReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const asaasReady = Boolean(process.env.ASAAS_API_KEY?.trim());
  const manualPixReady = Boolean(pixKey.trim());

  return {
    publicAppUrl,
    stripeReady,
    stripeWebhookReady,
    asaasReady,
    manualPixReady,
    stripeWebhookUrl: publicAppUrl ? `${publicAppUrl}/api/stripe/webhook` : "",
    asaasWebhookUrl: publicAppUrl ? `${publicAppUrl}/api/asaas/webhook` : "",
  };
}

export function getPaymentAvailability(
  config: PaymentConfig,
  runtime: PaymentRuntimeStatus,
): PaymentAvailability {
  const cardReady =
    config.orders.onlineEnabled &&
    config.orders.cardEnabled &&
    runtime.stripeReady;
  const pixReady =
    config.orders.pixEnabled &&
    (
      (config.orders.pixMode === "dynamic_asaas" && runtime.asaasReady) ||
      (config.orders.pixMode === "manual_key" && runtime.manualPixReady)
    );

  return {
    orders: {
      card: cardReady,
      pix: pixReady,
      cash: config.orders.cashEnabled,
      savedCards: cardReady && config.orders.savedCardsEnabled,
      pixMode: config.orders.pixMode,
    },
    club: {
      enabled:
        config.club.enabled &&
        config.club.checkoutMode === "manual_pix" &&
        runtime.manualPixReady,
      checkoutMode: config.club.checkoutMode,
    },
  };
}

export async function getPaymentSettingsAdmin() {
  const settings = await getAllStoreSettings();
  const config = normalizePaymentConfig(settings[PAYMENT_CONFIG_KEY]);
  const pixKey = settings.pixKey ?? "";
  const runtime = getPaymentRuntimeStatus(pixKey);
  const availability = getPaymentAvailability(config, runtime);

  return {
    config,
    pixKey,
    runtime,
    availability,
  };
}

export async function getPaymentSettingsPublic() {
  const { config, runtime, availability } = await getPaymentSettingsAdmin();
  return {
    config: {
      orders: {
        cashEnabled: availability.orders.cash,
        cardEnabled: availability.orders.card,
        pixEnabled: availability.orders.pix,
        savedCardsEnabled: availability.orders.savedCards,
        pixMode: availability.orders.pixMode,
      },
      club: {
        enabled: availability.club.enabled,
        checkoutMode: availability.club.checkoutMode,
      },
      pix: {
        instructions: config.pix.instructions,
      },
    },
    runtime: {
      stripeReady: runtime.stripeReady,
      asaasReady: runtime.asaasReady,
      manualPixReady: runtime.manualPixReady,
    },
  };
}

export async function savePaymentSettings(input: {
  config: PaymentConfig;
  pixKey: string;
}) {
  await setStoreSetting(PAYMENT_CONFIG_KEY, JSON.stringify(input.config));
  await setStoreSetting("pixKey", input.pixKey.trim());
}
