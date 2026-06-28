import { getStoreSetting, setStoreSetting } from "../db.ts";

export type ClubPlanId = "bonattao" | "basico";

export type ClubPlanConfig = {
  id: ClubPlanId;
  name: string;
  badge: string;
  price: number;
  discountPercent: number;
  freeDelivery: boolean;
  freePizzaPerMonth: boolean;
  description: string;
  benefits: string[];
};

export type ClubConfig = {
  badgeLabel: string;
  sectionTitle: string;
  sectionSubtitle: string;
  ctaLabel: string;
  disclaimer: string;
  highlightItems: string[];
  checkoutTitle: string;
  checkoutSubtitle: string;
  checkoutDiscountLabel: string;
  checkoutDeliveryLabel: string;
  checkoutFreePizzaLabel: string;
  profileGuestTitle: string;
  profileGuestSubtitle: string;
  profileBenefitsTitle: string;
  profilePrimaryActionLabel: string;
  successTitle: string;
  successSubtitle: string;
  popularPlanId: ClubPlanId;
  plans: ClubPlanConfig[];
};

export const DEFAULT_CLUB_CONFIG: ClubConfig = {
  badgeLabel: "Clube do Bonatto",
  sectionTitle: "Assine, economize e ganhe pizza todo mês.",
  sectionSubtitle: "Cliente fiel merece mais. Escolha seu plano e faça parte do clube.",
  ctaLabel: "Assinar agora via PIX",
  disclaimer: "Cancele quando quiser • Pagamento via PIX • Ativação após confirmação",
  highlightItems: [
    "Pizza grátis mensal",
    "Até 20% de desconto",
    "Entrega grátis no plano premium",
    "Cancele quando quiser",
  ],
  checkoutTitle: "Benefícios do seu clube",
  checkoutSubtitle: "Seu plano ativo entra automaticamente no total deste pedido.",
  checkoutDiscountLabel: "Desconto do clube",
  checkoutDeliveryLabel: "Entrega grátis do clube",
  checkoutFreePizzaLabel: "Pizza grátis disponível para o próximo pedido.",
  profileGuestTitle: "Você ainda não é membro",
  profileGuestSubtitle:
    "Assine o Clube do Bonatto e tenha descontos exclusivos, entrega grátis e uma pizza grátis todo mês!",
  profileBenefitsTitle: "Seus benefícios",
  profilePrimaryActionLabel: "Fazer pedido com desconto",
  successTitle: "Bem-vindo ao Clube!",
  successSubtitle: "Seu plano foi ativado. Aproveite todos os benefícios exclusivos do Clube do Bonatto!",
  popularPlanId: "bonattao",
  plans: [
    {
      id: "basico",
      name: "Fã Bonatto",
      badge: "Entrada",
      price: 9.99,
      discountPercent: 15,
      freeDelivery: false,
      freePizzaPerMonth: true,
      description: "Entrou para o time. Agora é da família.",
      benefits: [
        "15% de desconto em todos os pedidos",
        "1 pizza grátis por mês",
        "Acesso a promoções exclusivas",
      ],
    },
    {
      id: "bonattao",
      name: "Sócio Bonatto",
      badge: "Mais popular",
      price: 19,
      discountPercent: 20,
      freeDelivery: true,
      freePizzaPerMonth: true,
      description: "Você não pede pizza. Você pede Bonatto.",
      benefits: [
        "20% de desconto em todos os pedidos",
        "Entrega sempre grátis",
        "1 pizza grátis por mês",
        "Acesso VIP a lançamentos e promoções",
      ],
    },
  ],
};

const CLUB_CONFIG_KEY = "clubConfig";

function repairClubText(value: string): string {
  let repaired = value.trim();

  if (/[ÃƒÃ¢]/.test(repaired)) {
    try {
      const decoded = Buffer.from(repaired, "latin1").toString("utf8");
      if (decoded && !decoded.includes("\uFFFD")) {
        repaired = decoded;
      }
    } catch {
      // Keep the original value when decoding is not possible.
    }
  }

  const replacements: Array<[RegExp, string]> = [
    [/fam\?lia/gi, "família"],
    [/\/m\?s/gi, "/mês"],
    [/grtis/gi, "grátis"],
    [/promo\?\?es/gi, "promoções"],
    [/lan\?amentos/gi, "lançamentos"],
    [/S\?cio/gi, "Sócio"],
    [/Ativa\?\?o/gi, "Ativação"],
    [/fa\?a/gi, "faça"],
    [/m\?s/gi, "mês"],
    [/n\?o/gi, "não"],
    [/Voc\?/gi, "Você"],
  ];

  for (const [pattern, replacement] of replacements) {
    repaired = repaired.replace(pattern, replacement);
  }

  return repaired;
}

function normalizeBenefitList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === "string" ? repairClubText(item) : ""))
    .filter(Boolean);
  return normalized.length ? normalized : fallback;
}

function normalizeConfigList(value: unknown, fallback: string[]): string[] {
  return normalizeBenefitList(value, fallback);
}

function normalizePlanId(value: unknown, fallback: ClubPlanId): ClubPlanId {
  return value === "bonattao" || value === "basico" ? value : fallback;
}

function normalizePlan(input: unknown, fallback: ClubPlanConfig): ClubPlanConfig {
  if (!input || typeof input !== "object") return fallback;
  const plan = input as Partial<ClubPlanConfig>;

  return {
    id: normalizePlanId(plan.id, fallback.id),
    name: typeof plan.name === "string" && plan.name.trim() ? repairClubText(plan.name) : fallback.name,
    badge: typeof plan.badge === "string" && plan.badge.trim() ? repairClubText(plan.badge) : fallback.badge,
    price: typeof plan.price === "number" && Number.isFinite(plan.price) ? plan.price : fallback.price,
    discountPercent:
      typeof plan.discountPercent === "number" && Number.isFinite(plan.discountPercent)
        ? plan.discountPercent
        : fallback.discountPercent,
    freeDelivery: typeof plan.freeDelivery === "boolean" ? plan.freeDelivery : fallback.freeDelivery,
    freePizzaPerMonth:
      typeof plan.freePizzaPerMonth === "boolean" ? plan.freePizzaPerMonth : fallback.freePizzaPerMonth,
    description:
      typeof plan.description === "string" && plan.description.trim()
        ? repairClubText(plan.description)
        : fallback.description,
    benefits: normalizeBenefitList(plan.benefits, fallback.benefits),
  };
}

function normalizeConfig(input: unknown): ClubConfig {
  if (!input || typeof input !== "object") return DEFAULT_CLUB_CONFIG;
  const raw = input as Partial<ClubConfig>;

  const fallbackPlansById = Object.fromEntries(
    DEFAULT_CLUB_CONFIG.plans.map((plan) => [plan.id, plan]),
  ) as Record<ClubPlanId, ClubPlanConfig>;

  const providedPlans = Array.isArray(raw.plans) ? raw.plans : [];
  const normalizedPlans = (["basico", "bonattao"] as ClubPlanId[]).map((planId) => {
    const provided = providedPlans.find(
      (plan) => plan && typeof plan === "object" && (plan as Partial<ClubPlanConfig>).id === planId,
    );
    return normalizePlan(provided, fallbackPlansById[planId]);
  });

  return {
    badgeLabel:
      typeof raw.badgeLabel === "string" && raw.badgeLabel.trim()
        ? repairClubText(raw.badgeLabel)
        : DEFAULT_CLUB_CONFIG.badgeLabel,
    sectionTitle:
      typeof raw.sectionTitle === "string" && raw.sectionTitle.trim()
        ? repairClubText(raw.sectionTitle)
        : DEFAULT_CLUB_CONFIG.sectionTitle,
    sectionSubtitle:
      typeof raw.sectionSubtitle === "string" && raw.sectionSubtitle.trim()
        ? repairClubText(raw.sectionSubtitle)
        : DEFAULT_CLUB_CONFIG.sectionSubtitle,
    ctaLabel:
      typeof raw.ctaLabel === "string" && raw.ctaLabel.trim()
        ? repairClubText(raw.ctaLabel)
        : DEFAULT_CLUB_CONFIG.ctaLabel,
    disclaimer:
      typeof raw.disclaimer === "string" && raw.disclaimer.trim()
        ? repairClubText(raw.disclaimer)
        : DEFAULT_CLUB_CONFIG.disclaimer,
    highlightItems: normalizeConfigList(raw.highlightItems, DEFAULT_CLUB_CONFIG.highlightItems),
    checkoutTitle:
      typeof raw.checkoutTitle === "string" && raw.checkoutTitle.trim()
        ? repairClubText(raw.checkoutTitle)
        : DEFAULT_CLUB_CONFIG.checkoutTitle,
    checkoutSubtitle:
      typeof raw.checkoutSubtitle === "string" && raw.checkoutSubtitle.trim()
        ? repairClubText(raw.checkoutSubtitle)
        : DEFAULT_CLUB_CONFIG.checkoutSubtitle,
    checkoutDiscountLabel:
      typeof raw.checkoutDiscountLabel === "string" && raw.checkoutDiscountLabel.trim()
        ? repairClubText(raw.checkoutDiscountLabel)
        : DEFAULT_CLUB_CONFIG.checkoutDiscountLabel,
    checkoutDeliveryLabel:
      typeof raw.checkoutDeliveryLabel === "string" && raw.checkoutDeliveryLabel.trim()
        ? repairClubText(raw.checkoutDeliveryLabel)
        : DEFAULT_CLUB_CONFIG.checkoutDeliveryLabel,
    checkoutFreePizzaLabel:
      typeof raw.checkoutFreePizzaLabel === "string" && raw.checkoutFreePizzaLabel.trim()
        ? repairClubText(raw.checkoutFreePizzaLabel)
        : DEFAULT_CLUB_CONFIG.checkoutFreePizzaLabel,
    profileGuestTitle:
      typeof raw.profileGuestTitle === "string" && raw.profileGuestTitle.trim()
        ? repairClubText(raw.profileGuestTitle)
        : DEFAULT_CLUB_CONFIG.profileGuestTitle,
    profileGuestSubtitle:
      typeof raw.profileGuestSubtitle === "string" && raw.profileGuestSubtitle.trim()
        ? repairClubText(raw.profileGuestSubtitle)
        : DEFAULT_CLUB_CONFIG.profileGuestSubtitle,
    profileBenefitsTitle:
      typeof raw.profileBenefitsTitle === "string" && raw.profileBenefitsTitle.trim()
        ? repairClubText(raw.profileBenefitsTitle)
        : DEFAULT_CLUB_CONFIG.profileBenefitsTitle,
    profilePrimaryActionLabel:
      typeof raw.profilePrimaryActionLabel === "string" && raw.profilePrimaryActionLabel.trim()
        ? repairClubText(raw.profilePrimaryActionLabel)
        : DEFAULT_CLUB_CONFIG.profilePrimaryActionLabel,
    successTitle:
      typeof raw.successTitle === "string" && raw.successTitle.trim()
        ? repairClubText(raw.successTitle)
        : DEFAULT_CLUB_CONFIG.successTitle,
    successSubtitle:
      typeof raw.successSubtitle === "string" && raw.successSubtitle.trim()
        ? repairClubText(raw.successSubtitle)
        : DEFAULT_CLUB_CONFIG.successSubtitle,
    popularPlanId: normalizePlanId(raw.popularPlanId, DEFAULT_CLUB_CONFIG.popularPlanId),
    plans: normalizedPlans,
  };
}

export async function getClubConfig(): Promise<ClubConfig> {
  const stored = await getStoreSetting(CLUB_CONFIG_KEY);
  if (!stored) return DEFAULT_CLUB_CONFIG;

  try {
    return normalizeConfig(JSON.parse(stored));
  } catch {
    return DEFAULT_CLUB_CONFIG;
  }
}

export async function saveClubConfig(config: ClubConfig): Promise<void> {
  const normalized = normalizeConfig(config);
  await setStoreSetting(CLUB_CONFIG_KEY, JSON.stringify(normalized));
}

export async function getClubPlanConfig(planId: string | null | undefined): Promise<ClubPlanConfig | null> {
  if (planId !== "bonattao" && planId !== "basico") return null;
  const config = await getClubConfig();
  return config.plans.find((plan) => plan.id === planId) ?? null;
}
