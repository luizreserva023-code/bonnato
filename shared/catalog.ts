export type CatalogProductType =
  | "simple"
  | "sizes"
  | "variants"
  | "buildable"
  | "multi_flavor"
  | "combo"
  | "weight"
  | "quantity"
  | "variable_price";

export type MultiFlavorPricingRule =
  | "highest_price"
  | "average_price"
  | "proportional_price"
  | "size_fixed_price"
  | "base_plus_difference";

export type CatalogChannel = "all" | "delivery" | "pickup" | "dine_in" | "counter";

export type PriceBreakdownKind = "base" | "size" | "flavor" | "modifier" | "combo" | "upsell" | "discount" | "fee";

export interface CatalogSize {
  id: number;
  name: string;
  price: number;
  promotionalPrice?: number | null;
  promotionStartsAt?: Date | null;
  promotionEndsAt?: Date | null;
  minFlavors?: number | null;
  maxFlavors?: number | null;
  maxAddons?: number | null;
  active: boolean;
}

export interface CatalogModifierSizeRule {
  sizeId: number;
  enabled: boolean;
  priceOverride?: number | null;
  maxQuantityOverride?: number | null;
}

export interface CatalogModifierOption {
  id: number;
  name: string;
  price: number;
  active: boolean;
  maxQuantity: number;
  allowRepeat: boolean;
  sizeRules?: CatalogModifierSizeRule[];
}

export interface CatalogModifierGroup {
  id: number;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  freeSelections: number;
  allowRepeatedOptions: boolean;
  active: boolean;
  options: CatalogModifierOption[];
}

export interface CatalogFlavor {
  id: number;
  name: string;
  active: boolean;
  pricesBySize: Record<number, number>;
}

export interface CatalogComboGroup {
  id: number;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  active: boolean;
  items: Array<{ id: number; productId: number; sizeId?: number | null; price: number; active: boolean }>;
}

export interface CatalogAvailabilityRule {
  weekday?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  channel: CatalogChannel;
  stockLimit?: number | null;
  pausedUntil?: Date | null;
  active: boolean;
}

export interface ConfiguredCatalogProduct {
  id: number;
  storeId: number;
  name: string;
  basePrice: number;
  productType: CatalogProductType;
  pricingEngine: "legacy_v1" | "configured_v2";
  active: boolean;
  minQuantity: number;
  maxQuantity: number;
  sizes: CatalogSize[];
  modifierGroups: CatalogModifierGroup[];
  flavors: CatalogFlavor[];
  flavorSettings?: {
    enabled: boolean;
    pricingRule: MultiFlavorPricingRule;
    allowRepeatedFlavors: boolean;
  } | null;
  comboGroups: CatalogComboGroup[];
  upsellOffers: Array<{ productId: number; name: string; price: number; active: boolean }>;
  availability: CatalogAvailabilityRule[];
}

export interface ConfiguredProductSelection {
  quantity: number;
  sizeId?: number | null;
  flavorIds?: number[];
  modifiers?: Array<{ groupId: number; optionId: number; quantity: number }>;
  combos?: Array<{ groupId: number; itemId: number; quantity: number }>;
  upsells?: Array<{ productId: number; quantity: number }>;
  removedIngredients?: string[];
  channel: Exclude<CatalogChannel, "all">;
  now?: Date;
}

export interface PriceBreakdownItem {
  kind: PriceBreakdownKind;
  label: string;
  amount: number;
  quantity?: number;
}

export interface PriceCalculationResult {
  basePrice: number;
  sizePrice: number;
  flavorsPrice: number;
  modifiersPrice: number;
  comboAdditionalPrice: number;
  upsellsPrice: number;
  discounts: number;
  fees: number;
  unitTotal: number;
  total: number;
  breakdown: PriceBreakdownItem[];
  validationErrors: string[];
}

export interface OrderItemConfigurationSnapshot {
  version: 2;
  productId: number;
  productName: string;
  size?: { id: number; name: string; price: number } | null;
  flavors: Array<{ id: number; name: string; price: number }>;
  modifiers: Array<{ groupId: number; groupName: string; optionId: number; optionName: string; quantity: number; unitPrice: number; totalPrice: number }>;
  combos: Array<{ groupId: number; groupName: string; itemId: number; productId: number; quantity: number; unitPrice: number; totalPrice: number }>;
  upsells: Array<{ productId: number; name: string; quantity: number; unitPrice: number; totalPrice: number }>;
  removedIngredients: string[];
  pricing: PriceCalculationResult;
}
