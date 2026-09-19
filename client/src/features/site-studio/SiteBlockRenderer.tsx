import {
  ArrowRight,
  Clock3,
  Gift,
  MapPin,
  Pizza,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { SiteBlock } from "@shared/siteBuilder";

const radius = { none: "rounded-none", medium: "rounded-2xl", large: "rounded-[2rem]" } as const;
const spacingValue = { compact: "1.25rem", normal: "2.25rem", wide: "3.5rem" } as const;

export type SiteBlockData = {
  products?: Array<{ id: number; name: string; description?: string | null; price: string | number; imageUrl?: string | null }>;
  categories?: Array<{ id: number; name: string; imageUrl?: string | null }>;
  promotions?: Array<{ id: number; title: string; description?: string | null; imageUrl?: string | null; couponCode?: string | null }>;
  coupons?: Array<{ id: number; code: string; discountType: "percentage" | "fixed"; discountValue: string | number; minOrderValue?: string | number | null }>;
  rewards?: Array<{ id: number; name: string; description?: string | null; pointsCost: number }>;
  store?: { name: string; address?: string | null };
};

function blockStyle(block: SiteBlock): CSSProperties {
  const desktop = block.responsive?.desktop;
  const tablet = block.responsive?.tablet;
  const mobile = block.responsive?.mobile;
  return {
    ...(block.style.background !== "transparent" ? { background: block.style.background } : {}),
    ...(block.style.color !== "inherit" ? { color: block.style.color } : {}),
    "--site-block-desktop-spacing": spacingValue[desktop?.spacing ?? block.style.spacing],
    "--site-block-tablet-spacing": spacingValue[tablet?.spacing ?? block.style.spacing],
    "--site-block-mobile-spacing": spacingValue[mobile?.spacing ?? block.style.spacing],
    "--site-block-desktop-display": desktop?.hidden ? "none" : "block",
    "--site-block-tablet-display": tablet?.hidden ? "none" : "block",
    "--site-block-mobile-display": mobile?.hidden ? "none" : "block",
  } as CSSProperties;
}

function DynamicBadge({ editing }: { editing: boolean }) {
  if (!editing) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#171210]/[.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.16em] text-[#171210]/55">
      <span className="size-1.5 rounded-full bg-[#e51b23]" /> Conteúdo automático
    </span>
  );
}

export function SiteBlockRenderer({ block, editing = false, data }: { block: SiteBlock; editing?: boolean; data?: SiteBlockData }) {
  if (!block.visible && !editing) return null;

  const style = blockStyle(block);
  const title = String(block.props.title ?? "");
  const shell = `site-block-responsive ${radius[block.style.radius]} ${!block.visible ? "opacity-35 grayscale" : ""}`;
  const headingStyle = { fontFamily: "var(--site-heading-font)" };
  const buttonStyle = { borderRadius: "var(--site-button-radius)" };

  if (block.type === "hero") {
    return (
      <section className={`${shell} relative min-h-[24rem] overflow-hidden bg-[var(--site-dark)] px-7 text-white sm:px-12`} style={style}>
        {block.props.imageUrl ? (
          <img src={String(block.props.imageUrl)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        ) : (
          <>
            <div className="absolute -right-24 -top-28 size-80 rounded-full bg-[var(--site-primary)]" />
            <div className="absolute -bottom-20 right-12 size-48 rotate-12 rounded-[2.5rem] border-[28px] border-[var(--site-accent)] opacity-90" />
            <div className="absolute right-28 top-28 hidden text-[9rem] font-black leading-none text-white/[.07] sm:block">B</div>
          </>
        )}
        <div className="relative z-10 flex min-h-[20rem] max-w-xl flex-col justify-center py-8">
          <p className="text-[10px] font-black uppercase tracking-[.28em] text-[var(--site-accent)]">{String(block.props.eyebrow ?? "")}</p>
          <h1 className="mt-4 text-balance text-4xl font-black uppercase leading-[.9] tracking-[-.045em] sm:text-6xl" style={headingStyle}>{String(block.props.title ?? "")}</h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/72 sm:text-base">{String(block.props.description ?? "")}</p>
          <a href={String(block.props.buttonHref ?? "/cardapio")} style={buttonStyle} className="mt-7 inline-flex w-fit items-center gap-2 bg-[var(--site-primary)] px-5 py-3 text-sm font-black transition-transform duration-150 active:scale-[.97]">
            {String(block.props.buttonLabel ?? "Pedir agora")}<ArrowRight className="size-4" />
          </a>
        </div>
      </section>
    );
  }

  if (block.type === "quickLinks") {
    return (
      <section className={`${shell} px-4`} style={style}>
        <h2 className="mb-5 text-2xl font-black uppercase tracking-[-.035em]" style={headingStyle}>{title}</h2>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[[Sparkles,"Ofertas"],[Tag,"Cupons"],[Gift,"Clube"],[ShoppingBag,"Cardápio"]].map(([Icon,label]) => {
            const ItemIcon = Icon as typeof Sparkles;
            return <div key={String(label)} className="grid min-h-24 place-items-center rounded-2xl bg-white p-3 text-center shadow-[0_10px_25px_rgba(75,25,15,.06)]"><span className="grid size-9 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--site-primary)_10%,white)]"><ItemIcon className="size-4 text-[var(--site-primary)]"/></span><span className="text-[11px] font-black">{String(label)}</span></div>;
          })}
        </div>
      </section>
    );
  }

  if (["promotions", "featuredProducts", "categories", "coupons"].includes(block.type)) {
    const icons = { promotions: Sparkles, featuredProducts: Pizza, categories: ShoppingBag, coupons: Tag };
    const Icon = icons[block.type as keyof typeof icons];
    const limit = Math.min(Number(block.props.limit ?? 4), 8);
    const isCategory = block.type === "categories";
    const isCoupon = block.type === "coupons";
    const liveItems = block.type === "featuredProducts"
      ? (data?.products ?? []).map((item) => ({ key: item.id, title: item.name, subtitle: `R$ ${Number(item.price).toFixed(2).replace(".", ",")}`, imageUrl: item.imageUrl, href: `/cardapio?product=${item.id}` }))
      : block.type === "categories"
        ? (data?.categories ?? []).map((item) => ({ key: item.id, title: item.name, subtitle: "Ver produtos", imageUrl: item.imageUrl, href: `/cardapio?categoria=${item.id}` }))
        : block.type === "promotions"
          ? (data?.promotions ?? []).map((item) => ({ key: item.id, title: item.title, subtitle: item.description || "Oferta disponível", imageUrl: item.imageUrl, href: item.couponCode ? `/cardapio?coupon=${encodeURIComponent(item.couponCode)}` : "/cardapio" }))
          : (data?.coupons ?? []).map((item) => ({ key: item.id, title: item.discountType === "percentage" ? `${Number(item.discountValue)}% OFF` : `R$ ${Number(item.discountValue).toFixed(2).replace(".", ",")} OFF`, subtitle: item.code, imageUrl: null, href: `/cardapio?coupon=${encodeURIComponent(item.code)}` }));
    const displayItems = liveItems.slice(0, limit);
    if (!editing && displayItems.length === 0) return null;
    const previewItems = displayItems.length ? displayItems : Array.from({ length: Math.max(2, Math.min(limit, 4)) }, (_, index) => ({ key: index, title: isCategory ? `Categoria ${index + 1}` : isCoupon ? `${10 + index * 5}% OFF` : `Produto ${index + 1}`, subtitle: "Atualizado pelo painel", imageUrl: null, href: "/cardapio" }));
    return (
      <section className={`${shell} px-4`} style={style}>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><DynamicBadge editing={editing}/><h2 className="mt-2 text-2xl font-black uppercase tracking-[-.035em]" style={headingStyle}>{title}</h2></div>
          <span className="shrink-0 text-xs font-black text-[var(--site-primary)]">Ver todos</span>
        </div>
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
          {previewItems.map((item) => (
            <a href={item.href} key={item.key} className={`min-w-[46%] snap-start overflow-hidden bg-white shadow-[0_12px_32px_rgba(75,25,15,.07)] transition-transform active:scale-[.98] ${isCategory ? "rounded-[1.75rem] p-3 text-center" : "rounded-2xl"}`}>
              <div className={`grid place-items-center overflow-hidden bg-[#f5ece7] ${isCategory ? "mx-auto aspect-square w-full rounded-full" : "aspect-[4/3]"}`}>{item.imageUrl ? <img src={item.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : <Icon className="size-8 text-[var(--site-primary)]"/>}</div>
              <div className={isCategory ? "px-1 pb-2 pt-3" : "p-3"}><strong className="line-clamp-2 text-sm">{item.title}</strong><p className="mt-1 line-clamp-2 text-[11px] text-black/45">{item.subtitle}</p></div>
            </a>
          ))}
        </div>
      </section>
    );
  }

  if (block.type === "club") {
    const rewards = data?.rewards?.length
      ? data.rewards.slice(0, 4)
      : [{ id: -1, name: "Desconto no pedido", description: "Troque pontos por vantagens reais", pointsCost: 300 }, { id: -2, name: "Entrega grátis", description: "Mais sabor, sem custo de entrega", pointsCost: 500 }];
    return (
      <section className={`${shell} relative overflow-hidden bg-[var(--site-dark)] px-6 text-white sm:px-9`} style={style}>
        <div className="absolute -right-12 -top-16 size-44 rounded-full bg-[var(--site-primary)] opacity-25" />
        <p className="relative text-[10px] font-black uppercase tracking-[.22em] text-[var(--site-primary)]">Seus pontos valem sabor</p>
        <h2 className="relative mt-2 text-3xl font-black uppercase tracking-[-.04em]" style={headingStyle}>{title}</h2>
        <p className="relative mt-2 text-sm text-white/55">{String(block.props.description ?? "")}</p>
        <div className="relative mt-6 flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">{rewards.map((reward)=><div key={reward.id} className="min-w-[46%] snap-start rounded-2xl border border-white/10 bg-white/[.055] p-4"><Gift className="size-5 text-[var(--site-primary)]"/><strong className="mt-8 block text-sm">{reward.name}</strong><span className="mt-1 block text-[10px] text-white/40">{reward.pointsCost} pontos</span></div>)}</div>
      </section>
    );
  }

  if (block.type === "testimonials") {
    return <section className={`${shell} px-4`} style={style}><h2 className="text-2xl font-black uppercase tracking-[-.035em]" style={headingStyle}>{title}</h2><blockquote className="mt-5 rounded-2xl bg-white p-6 shadow-[0_12px_32px_rgba(75,25,15,.07)]"><div className="flex gap-1 text-[var(--site-accent)]">{Array.from({length:5}).map((_,i)=><Star key={i} className="size-4 fill-current"/>)}</div><p className="mt-5 text-base font-semibold leading-relaxed">“{String(block.props.quote ?? "Experiência incrível, pedido rápido e comida deliciosa.")}”</p><footer className="mt-4 text-xs font-black text-black/45">{String(block.props.author ?? "Cliente da casa")}</footer></blockquote></section>;
  }

  if (block.type === "location") {
    return <section className={`${shell} px-4`} style={style}><h2 className="text-2xl font-black uppercase tracking-[-.035em]" style={headingStyle}>{title}</h2><div className="mt-5 grid min-h-48 grid-cols-[1fr_auto] items-end overflow-hidden rounded-2xl bg-[#ded5cd] p-5"><div><MapPin className="size-8 text-[var(--site-primary)]"/><p className="mt-4 max-w-[22ch] text-sm font-bold">{String(data?.store?.address || block.props.address || "Configure o endereço da sua loja")}</p></div>{Boolean(block.props.showHours)&&<span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[10px] font-black"><Clock3 className="size-3"/>Aberto agora</span>}</div></section>;
  }

  return <section className={`${shell} relative overflow-hidden bg-[var(--site-primary)] px-7 text-white sm:px-10`} style={style}><div className="absolute -right-10 -top-16 size-44 rounded-full bg-[var(--site-accent)]"/><h2 className="relative max-w-lg text-3xl font-black uppercase tracking-[-.04em]" style={headingStyle}>{title}</h2><p className="relative mt-2 max-w-md text-sm text-white/75">{String(block.props.description ?? "")}</p><a href={String(block.props.buttonHref ?? "/cardapio")} style={{...buttonStyle,color:"var(--site-primary)"}} className="relative mt-6 inline-flex bg-white px-5 py-3 text-sm font-black transition-transform duration-150 active:scale-[.97]">{String(block.props.buttonLabel ?? "Fazer pedido")}</a></section>;
}
