export type PizzaFlavorSizeKey = "small" | "medium" | "large" | "family";

export type PizzaFlavorConfig = {
  enabled: boolean;
  pricingMode: "highest";
  maxFlavorsBySize: Record<PizzaFlavorSizeKey, number>;
};

export const DEFAULT_PIZZA_FLAVOR_CONFIG: PizzaFlavorConfig = {
  enabled: false,
  pricingMode: "highest",
  maxFlavorsBySize: {
    small: 1,
    medium: 2,
    large: 2,
    family: 3,
  },
};

export const PIZZA_SIZE_KEYS: PizzaFlavorSizeKey[] = ["small", "medium", "large", "family"];

export function getPizzaFlavorConfig(rawValue?: string | null): PizzaFlavorConfig {
  if (!rawValue) return DEFAULT_PIZZA_FLAVOR_CONFIG;

  try {
    const parsed = JSON.parse(rawValue) as Partial<PizzaFlavorConfig>;
    return {
      enabled: parsed.enabled ?? DEFAULT_PIZZA_FLAVOR_CONFIG.enabled,
      pricingMode: parsed.pricingMode === "highest" ? "highest" : DEFAULT_PIZZA_FLAVOR_CONFIG.pricingMode,
      maxFlavorsBySize: {
        small: clampFlavorCount(parsed.maxFlavorsBySize?.small),
        medium: clampFlavorCount(parsed.maxFlavorsBySize?.medium),
        large: clampFlavorCount(parsed.maxFlavorsBySize?.large),
        family: clampFlavorCount(parsed.maxFlavorsBySize?.family),
      },
    };
  } catch {
    return DEFAULT_PIZZA_FLAVOR_CONFIG;
  }
}

export function clampFlavorCount(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(4, Math.round(numeric)));
}

export function formatFlavorSelection(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];

  const portion = `1/${names.length}`;
  return names.map((name) => `${portion} ${name}`).join(" + ");
}
