import { z } from "zod";
import { getAllStoreSettings, setStoreSetting } from "./db.ts";
import {
  listIfoodMerchants,
  pollIfoodEventsOnce,
  syncIfoodCatalog,
  syncIfoodPromotions,
} from "./ifood.ts";

export const marketplaceProviderIdSchema = z.enum([
  "ifood",
  "uber_eats",
  "rappi",
  "doordash",
  "grubhub",
  "deliveroo",
  "just_eat",
  "wolt",
  "glovo",
  "foodpanda",
]);

export type MarketplaceProviderId = z.infer<typeof marketplaceProviderIdSchema>;

export const marketplaceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  merchantId: z.string().trim().max(120).optional().default(""),
  externalStoreId: z.string().trim().max(120).optional().default(""),
  regionHint: z.string().trim().max(120).optional().default(""),
  aggregationIds: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  notes: z.string().trim().max(500).optional().default(""),
});

export type MarketplaceStoredConfig = z.infer<typeof marketplaceConfigSchema>;

type MarketplaceCapability =
  | "orders"
  | "catalog"
  | "promotions"
  | "status_updates"
  | "webhooks"
  | "polling"
  | "store_sync"
  | "delivery_status";

type MarketplaceProviderDefinition = {
  id: MarketplaceProviderId;
  name: string;
  description: string;
  docsUrl: string;
  portalUrl: string;
  onboarding: "public_docs" | "partner_program" | "restricted_partner";
  integrationModel: "oauth" | "api_key" | "partner_credentials";
  accessMode: "oauth_login" | "partner_portal" | "partner_request";
  accessLabel: string;
  accessHelp: string;
  capabilities: MarketplaceCapability[];
  regions: string[];
  requiredEnv: string[];
  implemented: boolean;
};

type MarketplaceConnectionState =
  | "ready"
  | "credentials_ready"
  | "missing_credentials"
  | "disabled"
  | "planned";

const MARKETPLACE_SETTINGS_KEY = "marketplaceConfigs";

const PROVIDERS: MarketplaceProviderDefinition[] = [
  {
    id: "ifood",
    name: "iFood",
    description: "Marketplace lider no Brasil com APIs oficiais para merchants, catalogo, promocoes e eventos de pedido.",
    docsUrl: "https://developer.ifood.com.br/pt-BR/docs/guides/modules/merchant/introducao/",
    portalUrl: "https://developer.ifood.com.br/",
    onboarding: "partner_program",
    integrationModel: "oauth",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal iFood",
    accessHelp: "O iFood trabalha com onboarding e credenciais do portal de parceiros antes da troca de tokens.",
    capabilities: ["orders", "catalog", "promotions", "status_updates", "polling", "store_sync"],
    regions: ["Brasil"],
    requiredEnv: ["IFOOD_CLIENT_ID", "IFOOD_CLIENT_SECRET"],
    implemented: true,
  },
  {
    id: "uber_eats",
    name: "Uber Eats",
    description: "APIs oficiais da Uber para pedidos, menus, status de loja e webhooks, com onboarding via parceiro.",
    docsUrl: "https://developer.uber.com/docs/eats/introduction",
    portalUrl: "https://developer.uber.com/",
    onboarding: "partner_program",
    integrationModel: "oauth",
    accessMode: "oauth_login",
    accessLabel: "Entrar com Uber",
    accessHelp: "A Uber oferece fluxo oficial com login e aprovacao do app antes de liberar a conta do merchant.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks", "store_sync"],
    regions: ["Global"],
    requiredEnv: ["UBER_EATS_CLIENT_ID", "UBER_EATS_CLIENT_SECRET"],
    implemented: false,
  },
  {
    id: "rappi",
    name: "Rappi",
    description: "Portal oficial de parceiros da Rappi para operacao de pedidos e integracoes de restaurantes.",
    docsUrl: "https://developers.rappi.com/",
    portalUrl: "https://developers.rappi.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Rappi",
    accessHelp: "Acesso normalmente entra por portal de parceiros e emissao de credenciais aprovadas.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["America Latina"],
    requiredEnv: ["RAPPI_API_KEY"],
    implemented: false,
  },
  {
    id: "doordash",
    name: "DoorDash",
    description: "Ecossistema oficial da DoorDash com Drive e Storefront, cobrindo entrega, webhooks e operacao de pedidos.",
    docsUrl: "https://developer.doordash.com/en-US/docs/drive/overview",
    portalUrl: "https://developer.doordash.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "oauth_login",
    accessLabel: "Entrar com DoorDash",
    accessHelp: "A DoorDash possui portal oficial e trilhas de autorizacao para parceiros aprovados.",
    capabilities: ["orders", "status_updates", "webhooks", "delivery_status"],
    regions: ["EUA", "Canada", "Australia"],
    requiredEnv: ["DOORDASH_DEVELOPER_ID", "DOORDASH_KEY_ID", "DOORDASH_SIGNING_SECRET"],
    implemented: false,
  },
  {
    id: "grubhub",
    name: "Grubhub",
    description: "APIs oficiais de marketplace e order ingestion para parceiros integradores.",
    docsUrl: "https://developer.grubhub.com/docs/getting-started",
    portalUrl: "https://developer.grubhub.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Grubhub",
    accessHelp: "A Grubhub costuma liberar integracao via portal e credenciais do parceiro integrador.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["EUA"],
    requiredEnv: ["GRUBHUB_API_KEY"],
    implemented: false,
  },
  {
    id: "deliveroo",
    name: "Deliveroo",
    description: "API oficial de order management e menu sync para restaurantes parceiros.",
    docsUrl: "https://api-docs.deliveroo.com/docs/getting-started",
    portalUrl: "https://api-docs.deliveroo.com/docs/getting-started",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Deliveroo",
    accessHelp: "A Deliveroo exige conta de parceiro e aprovacao da integracao para liberar a operacao.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["Europa", "Asia", "Emirados Arabes"],
    requiredEnv: ["DELIVEROO_API_KEY"],
    implemented: false,
  },
  {
    id: "just_eat",
    name: "Just Eat",
    description: "Developer portal oficial com APIs de menu, orders e status para parceiros do grupo Just Eat Takeaway.",
    docsUrl: "https://developers.just-eat.com/documentation/getting-started",
    portalUrl: "https://developers.just-eat.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Just Eat",
    accessHelp: "A conta entra pelo portal de desenvolvedor e depende de habilitacao do parceiro.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["Europa", "Reino Unido"],
    requiredEnv: ["JUST_EAT_API_KEY"],
    implemented: false,
  },
  {
    id: "wolt",
    name: "Wolt",
    description: "Marketplace APIs da Wolt para menu, order intake, webhooks e operacao de parceiros.",
    docsUrl: "https://developer.wolt.com/docs/marketplace-overview",
    portalUrl: "https://developer.wolt.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Wolt",
    accessHelp: "A Wolt centraliza o acesso no portal oficial e libera as credenciais por parceiro.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks", "store_sync"],
    regions: ["Europa", "Asia"],
    requiredEnv: ["WOLT_API_KEY"],
    implemented: false,
  },
  {
    id: "glovo",
    name: "Glovo",
    description: "Q-Commerce Integrations da Glovo para pedidos, webhooks e sincronizacao operacional.",
    docsUrl: "https://qcommerce-integrations.glovoapp.com/",
    portalUrl: "https://qcommerce-integrations.glovoapp.com/",
    onboarding: "restricted_partner",
    integrationModel: "partner_credentials",
    accessMode: "partner_request",
    accessLabel: "Solicitar acesso Glovo",
    accessHelp: "A Glovo trabalha com acesso restrito e liberacao direta para parceiros homologados.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["Europa", "America Latina", "Africa"],
    requiredEnv: ["GLOVO_API_KEY"],
    implemented: false,
  },
  {
    id: "foodpanda",
    name: "foodpanda",
    description: "Portal oficial de integracao da foodpanda com APIs de pedidos, menu e order management.",
    docsUrl: "https://developer.foodpanda.com/docs/",
    portalUrl: "https://developer.foodpanda.com/docs/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal foodpanda",
    accessHelp: "A foodpanda usa portal de parceiros e liberacao de credenciais por conta.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["Asia", "Europa"],
    requiredEnv: ["FOODPANDA_API_KEY"],
    implemented: false,
  },
];

function normalizeConfig(input?: Partial<MarketplaceStoredConfig>): MarketplaceStoredConfig {
  return marketplaceConfigSchema.parse({
    enabled: input?.enabled ?? false,
    merchantId: input?.merchantId ?? "",
    externalStoreId: input?.externalStoreId ?? "",
    regionHint: input?.regionHint ?? "",
    aggregationIds: input?.aggregationIds ?? [],
    notes: input?.notes ?? "",
  });
}

function parseStoredConfigs(raw: string | null | undefined): Partial<Record<MarketplaceProviderId, MarketplaceStoredConfig>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<MarketplaceStoredConfig>>;
    const result: Partial<Record<MarketplaceProviderId, MarketplaceStoredConfig>> = {};
    for (const provider of PROVIDERS) {
      if (parsed[provider.id]) {
        result[provider.id] = normalizeConfig(parsed[provider.id]);
      }
    }
    return result;
  } catch {
    return {};
  }
}

function getCredentialsReady(requiredEnv: string[]): boolean {
  if (!requiredEnv.length) return true;
  return requiredEnv.every((name) => Boolean(process.env[name]?.trim()));
}

function getConnectionState(
  definition: MarketplaceProviderDefinition,
  config: MarketplaceStoredConfig,
  credentialsReady: boolean,
): MarketplaceConnectionState {
  if (!definition.implemented) {
    if (credentialsReady) return "credentials_ready";
    return config.enabled ? "missing_credentials" : "planned";
  }
  if (config.enabled && credentialsReady) return "ready";
  if (!config.enabled && credentialsReady) return "credentials_ready";
  if (config.enabled && !credentialsReady) return "missing_credentials";
  return "disabled";
}

export async function getMarketplaceOverview() {
  const settings = await getAllStoreSettings();
  const storedConfigs = parseStoredConfigs(settings[MARKETPLACE_SETTINGS_KEY]);

  const providers = PROVIDERS.map((definition) => {
    const config = normalizeConfig(storedConfigs[definition.id]);
    const credentialsReady = getCredentialsReady(definition.requiredEnv);
    const connectionState = getConnectionState(definition, config, credentialsReady);

    return {
      ...definition,
      config,
      runtime: {
        credentialsReady,
        connectionState,
        canExecuteNativeActions: definition.implemented && credentialsReady,
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    implementedCount: providers.filter((provider) => provider.implemented).length,
    readyCount: providers.filter((provider) => provider.runtime.connectionState === "ready").length,
    plannedCount: providers.filter((provider) => !provider.implemented).length,
    providers,
  };
}

export async function saveMarketplaceConfig(providerId: MarketplaceProviderId, config: Partial<MarketplaceStoredConfig>) {
  const settings = await getAllStoreSettings();
  const storedConfigs = parseStoredConfigs(settings[MARKETPLACE_SETTINGS_KEY]);
  storedConfigs[providerId] = normalizeConfig(config);
  await setStoreSetting(MARKETPLACE_SETTINGS_KEY, JSON.stringify(storedConfigs));
  return getMarketplaceOverview();
}

export async function testMarketplaceConnection(providerId: MarketplaceProviderId) {
  if (providerId === "ifood") {
    const merchants = await listIfoodMerchants();
    return {
      success: true,
      message: merchants.length
        ? `${merchants.length} merchant(s) encontrado(s) no iFood.`
        : "Credenciais validas, mas nenhum merchant foi retornado.",
      details: merchants.map((merchant) => ({
        id: merchant.id,
        name: merchant.name,
      })),
    };
  }

  return {
    success: false,
    message: "Esta plataforma ja esta mapeada no hub, mas ainda depende da implementacao nativa apos liberacao das credenciais do parceiro.",
    details: [],
  };
}

export async function runMarketplaceCatalogSync(providerId: MarketplaceProviderId, merchantId?: string) {
  if (providerId !== "ifood") {
    throw new Error("Sincronizacao nativa de catalogo disponivel apenas para iFood nesta versao.");
  }
  return syncIfoodCatalog(merchantId);
}

export async function runMarketplacePromotionsSync(
  providerId: MarketplaceProviderId,
  input?: { merchantId?: string; aggregationIds?: string[] },
) {
  if (providerId !== "ifood") {
    throw new Error("Sincronizacao nativa de promocoes disponivel apenas para iFood nesta versao.");
  }
  return syncIfoodPromotions(input);
}

export async function pullMarketplaceOrders(providerId: MarketplaceProviderId) {
  if (providerId !== "ifood") {
    throw new Error("Importacao nativa de pedidos disponivel apenas para iFood nesta versao.");
  }
  await pollIfoodEventsOnce();
  return { success: true };
}
