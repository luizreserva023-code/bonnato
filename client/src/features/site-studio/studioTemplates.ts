import { createSiteBlock, type SiteBlock, type SitePageDocument, type SiteTheme } from "@shared/siteBuilder";

export type StudioTemplate = {
  id: "original" | "vitrine" | "campaign" | "club";
  name: string;
  description: string;
  colors: [string, string, string];
  recommended?: boolean;
};

export const studioTemplates: StudioTemplate[] = [
  { id: "original", name: "Bonatto original", description: "Layout da Bonatto com foco em cardápio e delivery.", colors: ["#171210", "#e51b23", "#ffca28"], recommended: true },
  { id: "vitrine", name: "Vitrine clean", description: "Mais produto, fotografia e espaço em branco.", colors: ["#fffdfa", "#a60f16", "#211b18"] },
  { id: "campaign", name: "Campanha relâmpago", description: "Modelo para destacar promoções e cupons.", colors: ["#e51b23", "#ffca28", "#ffffff"] },
  { id: "club", name: "Clube", description: "Modelo focado nos planos e benefícios do clube.", colors: ["#171210", "#d6a927", "#f7f0e8"] },
];

function block(type: Parameters<typeof createSiteBlock>[0], props: Record<string, string | number | boolean> = {}, style?: Partial<SiteBlock["style"]>) {
  const item = createSiteBlock(type, `${type}-${crypto.randomUUID()}`);
  return { ...item, props: { ...item.props, ...props }, style: { ...item.style, ...style } };
}

function document(theme: SiteTheme, blocks: SiteBlock[]): SitePageDocument {
  return { schemaVersion: 1, theme, blocks };
}

export function createTemplateDocument(id: StudioTemplate["id"]): SitePageDocument {
  if (id === "vitrine") return document(
    { primary: "#a60f16", accent: "#e7b22b", dark: "#211b18", surface: "#fffdfa", text: "#211b18", headingFont: "modern", bodyFont: "modern", buttonStyle: "rounded", contentWidth: "wide" },
    [
      block("hero", { eyebrow: "Feito na hora", title: "Veja os produtos e monte seu pedido", description: "Fotos em destaque e acesso direto ao cardápio.", imageUrl: "/brand/pizza-hero.webp" }),
      block("quickLinks", { title: "O que você procura?" }),
      block("featuredProducts", { title: "Os mais pedidos", limit: 8 }),
      block("categories", { title: "Ver por categoria", limit: 8 }),
      block("testimonials", { title: "Avaliações de clientes" }),
      block("cta", { title: "Já escolheu?", description: "Seu pedido está a poucos toques." }),
    ],
  );

  if (id === "campaign") return document(
    { primary: "#e51b23", accent: "#ffca28", dark: "#201513", surface: "#fff7ed", text: "#201513", headingFont: "brand", bodyFont: "brand", buttonStyle: "pill", contentWidth: "standard" },
    [
      block("hero", { eyebrow: "Oferta do dia", title: "Hoje tem Bonatto com desconto", description: "Veja os itens que participam da promoção.", buttonLabel: "Pedir com desconto", imageUrl: "/brand/banner-combo.png" }),
      block("promotions", { title: "Ofertas de hoje", limit: 6 }),
      block("coupons", { title: "Cupons liberados", limit: 6 }),
      block("featuredProducts", { title: "Combine com a oferta", limit: 6 }),
      block("cta", { title: "Escolha seu pedido", description: "Monte seu pedido pelo cardápio." }),
    ],
  );

  if (id === "club") return document(
    { primary: "#b70f16", accent: "#d6a927", dark: "#171210", surface: "#f7f0e8", text: "#211b18", headingFont: "classic", bodyFont: "brand", buttonStyle: "rounded", contentWidth: "compact" },
    [
      block("hero", { eyebrow: "Clube Bonatto", title: "Planos para quem pede com frequência", description: "Veja o que está incluído em cada plano.", buttonLabel: "Conhecer o clube", buttonHref: "/clube", imageUrl: "/brand/mascote-caixas.webp" }),
      block("club", { title: "Benefícios do clube", description: "Pontos, descontos e vantagens para membros." }),
      block("coupons", { title: "Só para assinantes", limit: 4 }),
      block("testimonials", { title: "O que os clientes dizem" }),
      block("cta", { title: "Entre para o clube", description: "Escolha seu plano e veja os benefícios incluídos.", buttonLabel: "Ver planos", buttonHref: "/clube" }),
    ],
  );

  return document(
    { primary: "#e51b23", accent: "#ffca28", dark: "#171210", surface: "#f8f3ee", text: "#211b18", headingFont: "brand", bodyFont: "brand", buttonStyle: "pill", contentWidth: "standard" },
    [
      block("hero"), block("quickLinks"), block("promotions"), block("categories"), block("featuredProducts"), block("coupons"), block("club"), block("testimonials"), block("cta"),
    ],
  );
}

