import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  ChefHat,
  Coffee,
  Croissant,
  GlassWater,
  IceCreamCone,
  Pizza,
  Sandwich,
  ShoppingBag,
  Soup,
  Star,
  UtensilsCrossed,
} from "lucide-react";

import { CATEGORY_MEDIA, FALLBACK_PIZZA_IMAGE } from "@/lib/brand";

type CategoryLike = {
  icon?: string | null;
  slug?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  description?: string | null;
};

const CATEGORY_ICON_REGISTRY = {
  pizza: Pizza,
  calzone: Sandwich,
  pasta: Soup,
  drink: GlassWater,
  dessert: IceCreamCone,
  snack: Croissant,
  combo: BadgePercent,
  kitchen: ChefHat,
  coffee: Coffee,
  menu: UtensilsCrossed,
  featured: Star,
  default: ShoppingBag,
} as const satisfies Record<string, LucideIcon>;

export const CATEGORY_ICON_OPTIONS = [
  { value: "pizza", label: "Pizza", Icon: CATEGORY_ICON_REGISTRY.pizza },
  { value: "calzone", label: "Calzone / Lanche", Icon: CATEGORY_ICON_REGISTRY.calzone },
  { value: "pasta", label: "Massas", Icon: CATEGORY_ICON_REGISTRY.pasta },
  { value: "drink", label: "Bebidas", Icon: CATEGORY_ICON_REGISTRY.drink },
  { value: "dessert", label: "Sobremesas", Icon: CATEGORY_ICON_REGISTRY.dessert },
  { value: "snack", label: "Empanados / Extras", Icon: CATEGORY_ICON_REGISTRY.snack },
  { value: "combo", label: "Promoções / Combos", Icon: CATEGORY_ICON_REGISTRY.combo },
  { value: "kitchen", label: "Especial da casa", Icon: CATEGORY_ICON_REGISTRY.kitchen },
  { value: "coffee", label: "Cafés", Icon: CATEGORY_ICON_REGISTRY.coffee },
  { value: "menu", label: "Categoria genérica", Icon: CATEGORY_ICON_REGISTRY.menu },
  { value: "featured", label: "Destaque", Icon: CATEGORY_ICON_REGISTRY.featured },
] as const;

const CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  pizza: CATEGORY_MEDIA.pizzas,
  calzone: CATEGORY_MEDIA.calzones,
  pasta: CATEGORY_MEDIA.lasanhas,
  drink: CATEGORY_MEDIA.bebidas,
  dessert: CATEGORY_MEDIA.sorvetes,
  snack: CATEGORY_MEDIA.empanados,
  combo: CATEGORY_MEDIA.promocoes,
  kitchen: CATEGORY_MEDIA.pizzas,
  coffee: CATEGORY_MEDIA.extras,
  menu: CATEGORY_MEDIA.extras,
  featured: CATEGORY_MEDIA.promocoes,
  default: FALLBACK_PIZZA_IMAGE,
};

const CATEGORY_DESCRIPTION_FALLBACKS: Record<string, string> = {
  pizza: "Sabores artesanais para pedir sem pensar duas vezes.",
  calzone: "Recheios generosos e massa no ponto certo.",
  pasta: "Opções quentes, cremosas e com cara de prato especial.",
  drink: "Bebidas geladas para acompanhar cada fatia.",
  dessert: "Final doce para fechar o pedido em alta.",
  snack: "Acompanhamentos e extras para completar a mesa.",
  combo: "Ofertas e combinações para aproveitar melhor.",
  kitchen: "Criações da casa com assinatura Bonatto.",
  coffee: "Pausa rápida com sabor e conforto.",
  menu: "Seleção pronta para navegar com facilidade.",
  featured: "Escolhas com mais saída e mais desejo.",
  default: "Escolhas pensadas para combinar com o seu momento.",
};

const CATEGORY_KEY_ALIASES: Record<string, string> = {
  pizza: "pizza",
  pizzas: "pizza",
  calzone: "calzone",
  calzones: "calzone",
  lanche: "calzone",
  lanches: "calzone",
  massa: "pasta",
  massas: "pasta",
  lasanha: "pasta",
  lasanhas: "pasta",
  bebida: "drink",
  bebidas: "drink",
  drink: "drink",
  drinks: "drink",
  refrigerante: "drink",
  refrigerantes: "drink",
  suco: "drink",
  sucos: "drink",
  sobremesa: "dessert",
  sobremesas: "dessert",
  sorvete: "dessert",
  sorvetes: "dessert",
  doce: "dessert",
  doces: "dessert",
  empanado: "snack",
  empanados: "snack",
  extra: "snack",
  extras: "snack",
  porcao: "snack",
  porcoes: "snack",
  porção: "snack",
  porções: "snack",
  promocao: "combo",
  promocoes: "combo",
  promoção: "combo",
  promoções: "combo",
  combo: "combo",
  combos: "combo",
  cafe: "coffee",
  cafes: "coffee",
  café: "coffee",
  cafés: "coffee",
  destaque: "featured",
  especial: "kitchen",
  especiais: "kitchen",
};

function normalizeCategoryToken(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveCategoryIconKey(category?: CategoryLike | string | null) {
  const candidates = typeof category === "string"
    ? [category]
    : [category?.icon, category?.slug, category?.name];

  for (const candidate of candidates) {
    const normalized = normalizeCategoryToken(candidate);
    if (!normalized) continue;
    if (normalized in CATEGORY_ICON_REGISTRY) {
      return normalized as keyof typeof CATEGORY_ICON_REGISTRY;
    }
    if (normalized in CATEGORY_KEY_ALIASES) {
      return CATEGORY_KEY_ALIASES[normalized] as keyof typeof CATEGORY_ICON_REGISTRY;
    }
  }

  return "default";
}

export function getCategoryIcon(category?: CategoryLike | string | null): LucideIcon {
  return CATEGORY_ICON_REGISTRY[resolveCategoryIconKey(category)] ?? CATEGORY_ICON_REGISTRY.default;
}

export function getCategoryImage(category?: CategoryLike | null) {
  const imageUrl = category?.imageUrl?.trim();
  if (imageUrl) return imageUrl;
  return CATEGORY_IMAGE_FALLBACKS[resolveCategoryIconKey(category)] ?? CATEGORY_IMAGE_FALLBACKS.default;
}

export function getCategoryDescription(category?: CategoryLike | null) {
  const description = category?.description?.trim();
  if (description) return description;
  return CATEGORY_DESCRIPTION_FALLBACKS[resolveCategoryIconKey(category)] ?? CATEGORY_DESCRIPTION_FALLBACKS.default;
}
