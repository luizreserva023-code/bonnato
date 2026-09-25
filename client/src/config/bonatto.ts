import { BRAND_ASSETS } from "@/lib/brand";
import { BONATTO_CONTACT_CONFIG, BONATTO_FEATURE_FLAGS, BONATTO_PAGE_CONFIG, BONATTO_PROVIDER_CONFIG, type BonattoRuntimeConfig } from "@shared/bonattoConfig";

export type { BonattoRuntimeConfig } from "@shared/bonattoConfig";
export const BONATTO_HEADER_COLOR = "#DA1923";

export const BONATTO_CONFIG: BonattoRuntimeConfig = {
  brand: {
    key: "bonatto", name: "Bonatto Pizza", shortName: "Bonatto",
    tagline: "Fantástica Fábrica de Sabores", adminTitle: "Painel Bonatto", deliveryLabel: "Escolha sua unidade",
    logos: { icon: BRAND_ASSETS.palmito, wordmark: BRAND_ASSETS.palmitoWordmark, favicon: "/favicon.ico", waiter: BRAND_ASSETS.driverLogo },
    colors: { primary: "#6E0D12", primaryDark: "#450709", accent: "#e05c5c", background: "#fffaf8", text: "#211719" },
  },
  features: BONATTO_FEATURE_FLAGS,
  providers: BONATTO_PROVIDER_CONFIG,
  pages: BONATTO_PAGE_CONFIG,
  contact: BONATTO_CONTACT_CONFIG,
};