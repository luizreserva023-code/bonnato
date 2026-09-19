export const SITE_PAGE_KEYS = ["home", "menu", "club", "landing"] as const;
export type SitePageKey = (typeof SITE_PAGE_KEYS)[number];

export const SITE_BLOCK_TYPES = ["hero", "quickLinks", "promotions", "categories", "featuredProducts", "coupons", "club", "testimonials", "location", "cta"] as const;
export type SiteBlockType = (typeof SITE_BLOCK_TYPES)[number];

export const SITE_DEVICES = ["desktop", "tablet", "mobile"] as const;
export type SiteDevice = (typeof SITE_DEVICES)[number];
export type SiteBlockSpacing = "compact" | "normal" | "wide";
export type SiteBlockResponsiveSetting = {
  spacing?: SiteBlockSpacing;
  hidden?: boolean;
};

export type SiteBlock = {
  id: string;
  type: SiteBlockType;
  visible: boolean;
  props: Record<string, string | number | boolean>;
  style: {
    background: string;
    color: string;
    spacing: SiteBlockSpacing;
    radius: "none" | "medium" | "large";
  };
  responsive?: Partial<Record<SiteDevice, SiteBlockResponsiveSetting>>;
};

export type SiteTheme = {
  primary: string;
  accent: string;
  dark: string;
  surface: string;
  text: string;
  headingFont: "brand" | "modern" | "classic";
  bodyFont: "brand" | "modern" | "friendly";
  buttonStyle: "pill" | "rounded" | "square";
  contentWidth: "compact" | "standard" | "wide";
};

export const DEFAULT_SITE_THEME: SiteTheme = {
  primary: "#e51b23",
  accent: "#ffca28",
  dark: "#171210",
  surface: "#f8f3ee",
  text: "#211b18",
  headingFont: "brand",
  bodyFont: "brand",
  buttonStyle: "pill",
  contentWidth: "standard",
};

export type SitePageDocument = {
  schemaVersion: 1;
  theme: SiteTheme;
  blocks: SiteBlock[];
};

export const SITE_BLOCK_LABELS: Record<SiteBlockType, string> = {
  hero: "Destaque principal",
  quickLinks: "Acessos rápidos",
  promotions: "Promoções",
  categories: "Categorias",
  featuredProducts: "Produtos em destaque",
  coupons: "Cupons",
  club: "Clube e recompensas",
  testimonials: "Depoimentos",
  location: "Localização e horário",
  cta: "Chamada para pedido",
};

export function createSiteBlock(type: SiteBlockType, id = `${type}-${Date.now()}`): SiteBlock {
  const defaults: Record<SiteBlockType, Record<string, string | number | boolean>> = {
    hero: { eyebrow: "Pizza não. Bonatto!", title: "Sabor que chega até você", description: "Escolha seus favoritos e peça em poucos toques.", buttonLabel: "Ver cardápio", buttonHref: "/cardapio", imageUrl: "" },
    quickLinks: { title: "Encontre rápido" },
    promotions: { title: "Promoções", limit: 6 },
    categories: { title: "Categorias", limit: 8 },
    featuredProducts: { title: "Mais pedidos", limit: 8 },
    coupons: { title: "Cupons para aproveitar", limit: 6 },
    club: { title: "Recompensas do Clube", description: "Seus pontos valem sabor." },
    testimonials: { title: "Quem prova, recomenda", quote: "Experiência incrível, pedido rápido e comida deliciosa.", author: "Cliente da casa" },
    location: { title: "Onde estamos", showHours: true, address: "Configure o endereço da sua loja" },
    cta: { title: "Pronto para pedir?", description: "Monte seu pedido agora.", buttonLabel: "Fazer pedido", buttonHref: "/cardapio" },
  };
  return {
    id,
    type,
    visible: true,
    props: defaults[type],
    style: { background: "transparent", color: "inherit", spacing: "normal", radius: "large" },
    responsive: { desktop: {}, tablet: {}, mobile: {} },
  };
}

export const DEFAULT_HOME_DOCUMENT: SitePageDocument = {
  schemaVersion: 1,
  theme: DEFAULT_SITE_THEME,
  blocks: ["hero", "quickLinks", "promotions", "categories", "featuredProducts", "coupons", "club", "testimonials", "cta"].map((type, index) => createSiteBlock(type as SiteBlockType, `${type}-${index + 1}`)),
};

export function parseSiteDocument(value: unknown): SitePageDocument {
  if (!value || typeof value !== "object") return DEFAULT_HOME_DOCUMENT;
  const candidate = value as Partial<SitePageDocument>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.blocks)) return DEFAULT_HOME_DOCUMENT;
  const blocks = candidate.blocks
    .filter((block): block is SiteBlock => Boolean(block && SITE_BLOCK_TYPES.includes(block.type) && typeof block.id === "string"))
    .map((block) => ({
      ...block,
      style: {
        background: block.style?.background ?? "transparent",
        color: block.style?.color ?? "inherit",
        spacing: block.style?.spacing ?? "normal",
        radius: block.style?.radius ?? "large",
      },
      responsive: {
        desktop: block.responsive?.desktop ?? {},
        tablet: block.responsive?.tablet ?? {},
        mobile: block.responsive?.mobile ?? {},
      },
    }));
  const theme = candidate.theme && typeof candidate.theme === "object"
    ? { ...DEFAULT_SITE_THEME, ...candidate.theme }
    : DEFAULT_SITE_THEME;
  return { schemaVersion: 1, theme, blocks };
}
