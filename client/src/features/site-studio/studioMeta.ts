import {
  Boxes,
  Gift,
  LayoutGrid,
  MapPin,
  MessageSquareQuote,
  MousePointerClick,
  PanelTop,
  Pizza,
  Sparkles,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type { SiteBlockType, SitePageKey } from "@shared/siteBuilder";

export const pageOptions: Array<{ value: SitePageKey; label: string }> = [
  { value: "home", label: "Página inicial" },
  { value: "menu", label: "Cardápio" },
  { value: "club", label: "Clube" },
  { value: "landing", label: "Landing page" },
];

export const blockGroups: Array<{
  label: string;
  description: string;
  blocks: Array<{ type: SiteBlockType; icon: LucideIcon }>;
}> = [
  {
    label: "Conversão",
    description: "Blocos que levam o cliente ao pedido",
    blocks: [
      { type: "hero", icon: PanelTop },
      { type: "promotions", icon: Sparkles },
      { type: "featuredProducts", icon: Pizza },
      { type: "cta", icon: MousePointerClick },
    ],
  },
  {
    label: "Navegação e benefícios",
    description: "Organize a descoberta do cardápio",
    blocks: [
      { type: "quickLinks", icon: LayoutGrid },
      { type: "categories", icon: Boxes },
      { type: "coupons", icon: Tag },
      { type: "club", icon: Gift },
    ],
  },
  {
    label: "Confiança",
    description: "Informações que reduzem dúvidas",
    blocks: [
      { type: "testimonials", icon: MessageSquareQuote },
      { type: "location", icon: MapPin },
    ],
  },
];

export const propertyLabels: Record<string, string> = {
  eyebrow: "Texto de apoio",
  title: "Título",
  description: "Descrição",
  buttonLabel: "Texto do botão",
  buttonHref: "Destino do botão",
  imageUrl: "Imagem de fundo",
  limit: "Quantidade de itens",
  showHours: "Mostrar horário",
  quote: "Depoimento",
  author: "Nome do cliente",
  address: "Endereço",
};

export const longTextProperties = new Set(["description", "quote"]);

