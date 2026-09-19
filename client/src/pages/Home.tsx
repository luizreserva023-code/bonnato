import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useStore } from "@/contexts/StoreContext";
import {
  Clock,
  MapPin,
  ShoppingBag,
  Star,
  Truck,
  ChevronRight,
  Phone,
  Instagram,
  Facebook,
  ArrowRight,
  Crown,
  Bike,
  CheckCircle2,
  Tag,
  Gift,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { GridPattern } from "@/components/ui/grid-pattern";
import { cn } from "@/lib/utils";
import { SequentialCarousel } from "@/components/SequentialCarousel";
import { HomePopup } from "@/components/HomePopup";
import { BRAND_ASSETS } from "@/lib/brand";
import type { TenantRuntimeConfig } from "@/shared/tenant/tenant-config";
import type { Product } from "../../../drizzle/schema";
import { useAuth } from "@/_core/hooks/useAuth";
import { DEFAULT_HOME_APP_CONFIG, HomeAppHub, type HomeAppConfig } from "@/components/home/HomeAppHub";
import { productOrderHref, savePendingCoupon } from "@/lib/checkout-intent";
import { SiteBlockRenderer } from "@/features/site-studio/SiteBlockRenderer";
import { siteThemeStyle } from "@/features/site-studio/siteTheme";
import type { SitePageDocument } from "@shared/siteBuilder";

const LOGO_URL = "/brand/bonatto-logo-home.jpg";

const PIZZA_HERO_MAIN = "/brand/pizza-1-margherita.jpg";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function SlideInSection({
  children,
  className = "",
  direction = "left",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "left" | "right";
  delay?: number;
}) {
  const { ref, visible } = useReveal();
  const tx = direction === "left" ? "-80px" : "80px";
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0) translateY(0)" : `translateX(${tx}) translateY(10px)`,
        transition: `opacity 0.72s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.72s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Blur Reveal (scroll reveal com blur + fade + translateY) ───────────────
// Usa IntersectionObserver para detectar entrada na viewport e dispara
// uma transição suave de blur(20px)→0, opacity 0→1, translateY(30px)→0
function BlurRevealItem({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        filter: visible ? "blur(0px)" : "blur(16px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(28px)",
        transition: `filter 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        willChange: "filter, opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

function HomeSectionHeader({
  eyebrow,
  title,
  href,
  dark = false,
  brandTitle = false,
}: {
  eyebrow: string;
  title: string;
  href: string;
  dark?: boolean;
  brandTitle?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-5">
      <div>
        <p className={cn("text-xs font-black uppercase tracking-[.18em]", dark ? "text-[#DA1923]" : "text-[#DA1923]")}>{eyebrow}</p>
        <h2 id={`${title.toLowerCase().replace(/\s+/g, "-")}-title`} className={cn("mt-2 scroll-mt-28 text-4xl leading-none md:text-5xl", dark ? "text-white" : brandTitle ? "text-[#DA1923]" : "text-[#181513]")}>{title}</h2>
      </div>
      <Link href={href} className={cn("shrink-0 items-center gap-1 pb-1 text-xs font-black uppercase tracking-[.04em] sm:text-sm", brandTitle ? "hidden sm:flex" : "flex", dark ? "text-white/70 hover:text-white" : "text-[#DA1923]")}>
        Ver todos <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

function WhiteLabelHome({
  tenant,
  storeCity,
  products,
}: {
  tenant: TenantRuntimeConfig;
  storeCity?: string;
  products: Product[];
}) {
  const page = tenant.pages.home;
  const brand = tenant.brand;
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const highlights = [
    tenant.features.loyalty ? { icon: Star, title: "Fidelidade", description: "Benefícios para quem pede sempre." } : null,
    tenant.features.driverApp ? { icon: Bike, title: "Entrega acompanhada", description: "Acompanhe o pedido até sua chegada." } : null,
    { icon: Clock, title: "Pedido sem complicação", description: "Escolha, confirme e acompanhe em poucos passos." },
  ].filter(Boolean) as Array<{ icon: typeof Star; title: string; description: string }>;

  return (
    <main className="min-h-screen overflow-hidden" style={{ backgroundColor: brand.colors.background, color: brand.colors.text }}>
      <section className="relative isolate min-h-[680px] overflow-hidden px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background: `radial-gradient(circle at 18% 18%, ${brand.colors.accent}28, transparent 34%), radial-gradient(circle at 82% 26%, ${brand.colors.primary}22, transparent 30%)`,
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_.98fr]">
          <div className="max-w-2xl">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                {brand.logos.icon ? (
                  <img src={brand.logos.icon} alt={`Logo ${brand.name}`} className="size-full object-contain" />
                ) : (
                  <span className="text-lg font-black" style={{ color: brand.colors.primary }}>{brand.shortName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="text-lg font-black leading-tight">{brand.name}</p>
                <p className="text-sm opacity-60">{brand.tagline}</p>
              </div>
            </div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.24em]" style={{ color: brand.colors.primary }}>
              {storeCity ? `Delivery em ${storeCity}` : brand.deliveryLabel}
            </p>
            <h1 className="max-w-3xl text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              {page.title}
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 opacity-65 sm:text-lg">{page.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/cardapio">
                <Button size="lg" className="h-13 w-full gap-2 rounded-full px-7 text-white shadow-lg sm:w-auto" style={{ backgroundColor: brand.colors.primary }}>
                  <ShoppingBag className="size-5" /> Abrir cardápio
                </Button>
              </Link>
              <Link href="/pedidos">
                <Button size="lg" variant="outline" className="h-13 w-full gap-2 rounded-full border-black/10 bg-white/70 px-7 backdrop-blur sm:w-auto">
                  Acompanhar pedido <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-4 -z-10 rotate-2 rounded-[2.5rem] opacity-15" style={{ backgroundColor: brand.colors.primary }} />
            <div className="aspect-[4/4.6] overflow-hidden rounded-[2.25rem] border border-black/10 bg-white shadow-[0_30px_80px_rgba(20,10,10,.18)] sm:aspect-[4/3.7]">
              {page.heroImage ? (
                <img src={page.heroImage} alt={page.title} className="size-full object-cover" />
              ) : products[0]?.imageUrl ? (
                <img src={products[0].imageUrl} alt={products[0].name} className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center px-10 text-center" style={{ background: `linear-gradient(145deg, ${brand.colors.primary}, ${brand.colors.primaryDark})` }}>
                  {brand.logos.wordmark || brand.logos.icon ? (
                    <img src={brand.logos.wordmark || brand.logos.icon} alt={brand.name} className="max-h-32 max-w-[70%] object-contain brightness-0 invert" />
                  ) : (
                    <span className="text-5xl font-black text-white">{brand.shortName}</span>
                  )}
                  <p className="mt-5 text-sm text-white/70">{brand.deliveryLabel}</p>
                </div>
              )}
            </div>
            <div className="absolute -bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl border border-white/60 bg-white/90 px-5 py-4 shadow-xl backdrop-blur">
              <div>
                <p className="text-xs font-semibold opacity-50">Peça direto da loja</p>
                <p className="mt-0.5 font-black">Cardápio sempre atualizado</p>
              </div>
              <div className="flex size-11 items-center justify-center rounded-full text-white" style={{ backgroundColor: brand.colors.primary }}><ArrowRight className="size-5" /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/5 bg-white/55 px-4 py-8 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white px-4 py-4 shadow-sm">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${brand.colors.primary}12`, color: brand.colors.primary }}><Icon className="size-5" /></div>
              <div><h2 className="text-sm font-black">{title}</h2><p className="mt-1 text-xs leading-relaxed opacity-55">{description}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: brand.colors.primary }}>Mais pedidos</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Escolha seu favorito</h2>
            </div>
            <Link href="/cardapio" className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: brand.colors.primary }}>Ver cardápio completo <ChevronRight className="size-4" /></Link>
          </div>
          {products.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.slice(0, 6).map((product) => (
                <Link key={product.id} href="/cardapio">
                  <article className="group h-full overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <div className="aspect-[16/10] overflow-hidden bg-black/5">
                      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex size-full items-center justify-center"><ShoppingBag className="size-8 opacity-20" /></div>}
                    </div>
                    <div className="flex items-start justify-between gap-4 p-5">
                      <div><h3 className="font-black leading-tight">{product.name}</h3><p className="mt-2 line-clamp-2 text-xs leading-relaxed opacity-55">{product.description || "Preparado especialmente para o seu pedido."}</p></div>
                      <span className="shrink-0 rounded-full px-3 py-1.5 text-xs font-black text-white" style={{ backgroundColor: brand.colors.primary }}>{currency.format(Number(product.price))}</span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-black/15 bg-white/60 px-6 py-14 text-center">
              <ShoppingBag className="mx-auto size-8 opacity-20" />
              <p className="mt-3 text-sm font-bold">O cardápio desta loja está sendo preparado.</p>
            </div>
          )}
        </div>
      </section>

      <footer className="px-4 py-10 text-white sm:px-6 lg:px-8" style={{ backgroundColor: brand.colors.primaryDark }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xl font-black">{brand.name}</p><p className="mt-1 text-sm text-white/60">{brand.tagline}</p></div>
          <div className="flex flex-wrap gap-4 text-sm text-white/75">
            {tenant.contact.supportPhone && <a href={`tel:${tenant.contact.supportPhone}`} className="inline-flex items-center gap-2"><Phone className="size-4" /> {tenant.contact.supportPhone}</a>}
            {tenant.contact.instagram && <a href={tenant.contact.instagram.startsWith("http") ? tenant.contact.instagram : `https://instagram.com/${tenant.contact.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2"><Instagram className="size-4" /> Instagram</a>}
          </div>
        </div>
      </footer>
    </main>
  );
}

function HomeLegacy() {
  const { selectedStore, tenantConfig } = useStore();
  const { isAuthenticated } = useAuth();
  const isBonatto = tenantConfig.brand.key === "bonatto" || selectedStore?.isDefault === true;
  const storeId = selectedStore?.id ?? 0;
  const { data: featuredProducts } = trpc.products.list.useQuery({ categoryId: undefined, storeId: selectedStore?.id });
  const { data: carouselImages } = trpc.carousel.list.useQuery(
    { storeId: selectedStore?.id },
    { enabled: isBonatto && Boolean(selectedStore?.id) },
  );
  const { data: publicStoreSettings } = trpc.storeSettings.get.useQuery(
    { storeId: selectedStore?.id },
    { enabled: isBonatto && Boolean(selectedStore?.id) },
  );
  const { data: promotions = [] } = trpc.promotions.homeActive.useQuery(
    { storeId: selectedStore?.id },
    { enabled: isBonatto && Boolean(selectedStore?.id), staleTime: 0, refetchOnWindowFocus: true },
  );
  const { data: coupons = [] } = trpc.coupons.listPublic.useQuery(
    { storeId: selectedStore?.id },
    { enabled: isBonatto && Boolean(selectedStore?.id), staleTime: 0, refetchOnWindowFocus: true },
  );
  const { data: rewards = [] } = trpc.rewards.list.useQuery(
    { storeId },
    { enabled: isBonatto && storeId > 0, staleTime: 0, refetchOnWindowFocus: true },
  );
  const { data: clubConfig } = trpc.club.getPublicConfig.useQuery(
    { storeId },
    { enabled: isBonatto && storeId > 0, staleTime: 0, refetchOnWindowFocus: true },
  );
  const { data: memberPlan } = trpc.club.getMyPlan.useQuery(
    { storeId },
    { enabled: isBonatto && isAuthenticated && storeId > 0, retry: false },
  );
  const { data: memberPromotions = [] } = trpc.promotions.active.useQuery(
    { storeId: selectedStore?.id },
    { enabled: isBonatto && isAuthenticated && storeId > 0, retry: false },
  );
  const [, navigate] = useLocation();

  const topProducts = featuredProducts?.slice(0, 6) ?? [];

  // Usa imagens do carrossel gerenciado pelo admin; se vazio, cai para produtos
  const carouselItems = carouselImages && carouselImages.length > 0
    ? carouselImages.map((img) => {
        const matchingProduct = featuredProducts?.find((product) => product.name.trim().toLocaleLowerCase("pt-BR") === (img.title ?? "").trim().toLocaleLowerCase("pt-BR"));
        return { id: img.id, imageUrl: img.imageUrl || matchingProduct?.imageUrl || PIZZA_HERO_MAIN, name: img.title ?? matchingProduct?.name ?? "", productId: matchingProduct?.id };
      })
    : topProducts.length > 0
      ? topProducts.map((product) => ({ id: product.id, imageUrl: product.imageUrl || PIZZA_HERO_MAIN, name: product.name, productId: product.id }))
      : [{ id: -1, imageUrl: PIZZA_HERO_MAIN, name: "Destaque Bonatto", productId: undefined }];

  const startCouponOrder = (code: string) => {
    savePendingCoupon(code);
    navigate("/cardapio");
  };

  const startPromotionOrder = (promotion: { title: string; couponCode?: string | null }) => {
    if (promotion.couponCode) savePendingCoupon(promotion.couponCode);
    const matchingProduct = featuredProducts?.find((product) => product.name.trim().toLocaleLowerCase("pt-BR") === promotion.title.trim().toLocaleLowerCase("pt-BR"));
    navigate(productOrderHref(matchingProduct?.id, matchingProduct ? null : promotion.title));
  };
  let homeAppConfig: HomeAppConfig = DEFAULT_HOME_APP_CONFIG;
  if (typeof publicStoreSettings?.homeLayoutConfig === "string") {
    try {
      homeAppConfig = { ...DEFAULT_HOME_APP_CONFIG, ...JSON.parse(publicStoreSettings.homeLayoutConfig) };
    } catch {
      homeAppConfig = DEFAULT_HOME_APP_CONFIG;
    }
  }

  if (!isBonatto) {
    return <WhiteLabelHome tenant={tenantConfig} storeCity={selectedStore?.city} products={topProducts} />;
  }

  return (
    <div className="bonatto-home relative min-h-screen overflow-x-hidden bg-[#f5eee6] pb-36 md:pb-0">
      {/* Engagement popup — appears after 60s, once per session */}
      <HomePopup />

      {/* ═══════════════════════════════════════════════════════
          HERO — Headline + Carrossel Sequencial 3D
      ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 overflow-hidden bg-[#f5eee6] pb-2 pt-36">
        <div className="container text-center mb-4 px-4">
          <h1 className="mx-auto mb-2 flex max-w-[1100px] items-center justify-center">
            <span className="sr-only">Pizza não. Bonatto!</span>
            <img
              src="/brand/pizza-nao-bonatto.png"
              alt="Pizza não. Bonatto!"
              className="h-auto w-full max-w-[min(92vw,1100px)] object-contain"
              fetchPriority="high"
            />
          </h1>
        </div>
        <SequentialCarousel
          items={carouselItems}
          autoAdvance
          autoAdvanceInterval={4200}
          onCardClick={(item) => navigate(productOrderHref(item.productId, item.name))}
        />
      </section>

      <HomeAppHub config={homeAppConfig} showQuickActions={false} />

      <main className="bg-[#f5eee6] pb-14 pt-8 md:pb-20 md:pt-12">
        <div className="container flex flex-col gap-14 md:gap-20">
          <RevealSection className="order-2">
            <section aria-labelledby="promoções-title">
              <HomeSectionHeader eyebrow="Para pedir hoje" title="Promoções" href="/cardapio" />
              <div className="mt-7 flex snap-x gap-4 overflow-x-auto pb-3 [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible [&::-webkit-scrollbar]:hidden">
                {(promotions.length > 0 ? promotions.slice(0, 3) : [
                  { id: -1, title: "Ofertas fresquinhas", description: "As promoções da sua loja aparecem aqui assim que forem liberadas.", imageUrl: PIZZA_HERO_MAIN },
                ]).map((promotion) => (
                  <button key={promotion.id} type="button" onClick={() => startPromotionOrder(promotion)} className="min-w-[82vw] snap-start text-left sm:min-w-[420px] md:min-w-0">
                    <article className="group relative min-h-64 w-full overflow-hidden rounded-[1.75rem] bg-[#DA1923]">
                      {promotion.imageUrl && <img src={promotion.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />}
                      <div className="absolute inset-0 bg-black/40" />
                      <div className="absolute left-5 top-5 rounded-full bg-[#f6b31a] px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-[#3a2118]">Oferta</div>
                      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                        <h3 className="text-3xl leading-none">{promotion.title}</h3>
                        <p className="mt-2 max-w-sm text-sm text-white/75">{promotion.description}</p>
                      </div>
                    </article>
                  </button>
                ))}
              </div>
            </section>
          </RevealSection>

          <RevealSection className="order-3">
            <section aria-labelledby="cupons-title">
              <HomeSectionHeader eyebrow="Economize no checkout" title="Cupons" href={isAuthenticated ? "/minha-conta?tab=cupons" : "/login"} />
              <div className="mt-7 flex snap-x gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(coupons.length > 0 ? coupons.slice(0, 6) : [
                  { id: -1, code: "BEMVINDO", discountType: "percentage", discountValue: "10", minOrderValue: "0" },
                ]).map((coupon) => (
                  <article key={coupon.id} className="relative min-w-[280px] snap-start overflow-hidden rounded-3xl bg-[#DA1923] p-5 text-white shadow-[0_15px_35px_-28px_rgba(218,25,35,.65)] md:min-w-[340px]">
                    <span className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-[#f5eee6]" />
                    <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-[#f5eee6]" />
                    <div className="flex items-start justify-between gap-5">
                      <div className="grid size-11 place-items-center rounded-2xl bg-white/12 text-white"><Tag className="size-5" /></div>
                      <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-white/75">Cupom ativo</span>
                    </div>
                    <p className="mt-7 text-4xl font-black text-white">{coupon.discountType === "percentage" ? `${Number(coupon.discountValue)}% OFF` : `R$ ${Number(coupon.discountValue).toFixed(2).replace(".", ",")}`}</p>
                    <p className="mt-1 text-sm text-white/65">{Number(coupon.minOrderValue ?? 0) > 0 ? `Em pedidos acima de R$ ${Number(coupon.minOrderValue).toFixed(2).replace(".", ",")}` : "Aplicável no checkout"}</p>
                    <div className="mt-6 flex items-center justify-between border-t border-dashed border-white/25 pt-4">
                      <code className="text-sm font-black tracking-[.14em] text-white">{coupon.code}</code>
                      <button type="button" onClick={() => startCouponOrder(coupon.code)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#DA1923] hover:-translate-y-0.5">Usar</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </RevealSection>

          <RevealSection className="order-1">
            <section aria-labelledby="recompensas-do-clube-title">
              <HomeSectionHeader eyebrow="Seus pontos valem sabor" title="Recompensas do Clube" href={isAuthenticated ? "/minha-conta?tab=recompensas" : "/login?returnTo=%2Fminha-conta%3Ftab%3Drecompensas"} brandTitle />
              <div
                className="mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pr-[18vw] [scrollbar-width:none] sm:pr-24 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:pr-0 [&::-webkit-scrollbar]:hidden"
                role="region"
                aria-label="Recompensas disponíveis para deslizar"
              >
                {rewards.slice(0, 3).map((reward) => {
                  const rewardProduct = reward.productId ? featuredProducts?.find((product) => product.id === reward.productId) : undefined;
                  const RewardIcon = reward.rewardType === "free_delivery" ? Truck : reward.rewardType === "discount" ? Tag : Gift;

                  return (
                    <Link key={reward.id} href={isAuthenticated ? `/minha-conta?tab=recompensas&reward=${reward.id}` : `/login?returnTo=${encodeURIComponent(`/minha-conta?tab=recompensas&reward=${reward.id}`)}`} className="group min-w-[66vw] snap-start sm:min-w-[280px] md:min-w-0">
                      <article className="flex h-full min-h-[292px] flex-col overflow-hidden rounded-[1.35rem] bg-[#811017] text-white shadow-[0_18px_40px_-28px_rgba(76,10,16,.7)] ring-1 ring-black/[.06] transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#DA1923]">
                        <div className="relative grid h-36 place-items-center overflow-hidden bg-[#94151d]">
                          {rewardProduct?.imageUrl ? (
                            <img src={rewardProduct.imageUrl} alt={rewardProduct.name} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                          ) : (
                            <div className="grid size-20 place-items-center rounded-full bg-white/12 text-[#ffca32]">
                              <RewardIcon className="size-9" strokeWidth={1.8} />
                            </div>
                          )}
                          <span className="absolute left-3 top-3 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-white">Recompensa</span>
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <h3 className="text-2xl leading-none text-white">{reward.name}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/68">{reward.description}</p>
                          <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                            <p className="text-sm font-black text-white">{reward.pointsCost.toLocaleString("pt-BR")} pontos</p>
                            <span className="inline-flex items-center gap-1 text-xs font-black uppercase text-[#ffca32]">Resgatar <ChevronRight className="size-4" /></span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  );
                })}
                {rewards.length === 0 && (
                  <div className="col-span-full min-w-[75vw] rounded-[1.35rem] border border-dashed border-[#d8c6c0] bg-white px-6 py-10 text-center text-sm text-[#887672] sm:min-w-0">
                    Novas recompensas serão publicadas aqui em breve.
                  </div>
                )}
              </div>
            </section>
          </RevealSection>

          <RevealSection className="order-4">
            <section aria-labelledby="exclusivos-title" className="relative overflow-hidden rounded-[2rem] border border-[#e6deda] bg-white p-6 md:p-10">
              <div className="absolute -right-14 -top-16 size-52 rounded-full bg-[#DA1923]/[.07]" />
              <div className="relative grid items-center gap-8 lg:grid-cols-[.75fr_1.25fr]">
                <div>
                  <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-[#DA1923] text-white"><LockKeyhole className="size-5" /></div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-[#DA1923]">Só para assinantes</p>
                  <h2 id="exclusivos-title" className="mt-3 text-4xl leading-[.95] text-[#181513] md:text-5xl">Cupons exclusivos</h2>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-[#766d66]">Benefícios especiais que aparecem automaticamente para quem faz parte do Clube Bonatto.</p>
                  <Link href={memberPlan?.status === "active" ? "/minha-conta?tab=cupons" : "/clube"}>
                    <Button className="mt-6 h-11 rounded-full bg-[#DA1923] px-6 font-bold text-white hover:bg-[#DA1923]/90">
                      {memberPlan?.status === "active" ? "Ver meus cupons" : "Conhecer o Clube"}
                    </Button>
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {memberPlan?.status === "active" && memberPromotions.filter((item) => item.requiresLogin).length > 0 ? memberPromotions.filter((item) => item.requiresLogin).slice(0, 2).map((item) => (
                    <article key={item.id} className="rounded-2xl bg-[#f7f3ef] p-5">
                      <Sparkles className="size-5 text-[#DA1923]" />
                      <h3 className="mt-7 text-2xl leading-none text-[#181513]">{item.title}</h3>
                      <p className="mt-2 text-sm text-[#766d66]">{item.description}</p>
                      {item.couponCode && <code className="mt-5 block text-xs font-black tracking-[.15em] text-[#DA1923]">{item.couponCode}</code>}
                    </article>
                  )) : (clubConfig?.plans ?? []).slice(0, 2).map((plan) => (
                    <article key={plan.id} className="rounded-2xl bg-[#f7f3ef] p-5">
                      <Crown className="size-5 text-[#DA1923]" />
                      <h3 className="mt-7 text-2xl leading-none text-[#181513]">{plan.name}</h3>
                      <p className="mt-2 text-sm text-[#766d66]">{plan.discountPercent}% de desconto e vantagens todos os meses.</p>
                      <p className="mt-5 text-sm font-black text-[#181513]">R$ {Number(plan.price).toFixed(2).replace(".", ",")}/mês</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </RevealSection>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════
          CTA FINAL — faixa vermelha
      ═══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#DA1923] py-20">
        <div className="container relative z-10 text-center">
          <BlurRevealItem>
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 mb-6">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-semibold">Frete grátis em todos os pedidos</span>
            </div>
            <h2
              className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight"
            >
              Pronto para o melhor<br />sabor da cidade?
            </h2>
            <p className="text-white/80 text-lg mb-10 max-w-md mx-auto leading-relaxed">
              Monte seu pedido agora e receba em casa com toda a qualidade e carinho da Bonatto Pizza.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/cardapio">
                <Button
                  size="lg"
                  className="h-14 px-10 text-base font-bold bg-white text-[#DA1923] hover:bg-white/90 gap-2 shadow-xl hover:scale-105 transition-all rounded-xl"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Ver Cardápio Completo
                </Button>
              </Link>
              <a
                href="https://wa.me/5537991234567"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-10 text-base font-bold border-white/40 text-white hover:bg-white/10 bg-transparent gap-2 rounded-xl"
                >
                  <Phone className="w-5 h-5" />
                  Falar no WhatsApp
                </Button>
              </a>
            </div>
          </BlurRevealItem>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          ACESSO MOTOBOY
      ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#0f0204] py-8">
        <div className="container">
          <Link href="/motoboy">
            <div className="group flex items-center justify-between bg-[#1a0305] hover:bg-[#220408] border border-[#DA1923]/30 hover:border-[#DA1923]/60 rounded-2xl px-6 py-5 transition-all cursor-pointer max-w-md mx-auto">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#DA1923]/20 flex items-center justify-center shrink-0 group-hover:bg-[#DA1923]/30 transition-colors">
                  <Bike className="w-6 h-6 text-[#ff6b6b]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">
                    App do Motoboy
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">Acesso exclusivo para entregadores</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-[#ff6b6b] group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════ */}
      <footer className="bg-gray-900 text-white/60">
        <div className="container py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            {/* Brand */}
            <RevealSection delay={0}>
              <div className="flex items-center gap-3 mb-4">
                <img src={BRAND_ASSETS.palmito} alt="Bonatto Pizza" loading="lazy" decoding="async" className="w-14 h-14 object-contain" />
                <div>
                  <p className="font-black text-white text-lg">
                    Bonatto Pizza
                  </p>
                  <p className="text-xs text-white/40">Mateus Leme, MG</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-5">
                Pizzas artesanais feitas com amor e ingredientes frescos. Entregamos sabor e qualidade na sua porta.
              </p>
              <div className="flex gap-3">
                <a href="https://www.instagram.com/bonattopizza" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 bg-white/5 hover:bg-[#DA1923] border border-white/10 rounded-lg flex items-center justify-center transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="https://www.facebook.com/bonattopizza" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 bg-white/5 hover:bg-[#DA1923] border border-white/10 rounded-lg flex items-center justify-center transition-colors">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="https://wa.me/5537991234567" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 bg-white/5 hover:bg-green-500/20 border border-white/10 rounded-lg flex items-center justify-center transition-colors">
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </RevealSection>

            {/* Links */}
            <RevealSection delay={80}>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Navegação</h4>
              <ul className="space-y-2.5 text-sm">
                {[
                  { label: "Início", href: "/" },
                  { label: "Cardápio", href: "/cardapio" },
                  { label: "Minha Conta", href: "/minha-conta" },
                  { label: "Meus Pedidos", href: "/minha-conta" },
                  { label: "App do Motoboy", href: "/motoboy" },
                ].map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="hover:text-[#a01218] transition-colors flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </RevealSection>

            {/* Contact */}
            <RevealSection delay={160}>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Contato & Horários</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#7d0f14] shrink-0 mt-0.5" />
                  <span>Av José Surdo, 1032 — Centro<br />Mateus Leme/MG</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#7d0f14] shrink-0" />
                  <span>Segunda a Domingo: 18h às 23h</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#7d0f14] shrink-0" />
                  <span>WhatsApp disponível</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-green-400 font-medium">Frete grátis em todos os pedidos</span>
                </li>
              </ul>
            </RevealSection>
          </div>

          <RevealSection delay={220}>
          <div className="border-t border-white/5 pt-8 flex flex-col items-center gap-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs w-full">
              <p>© {new Date().getFullYear()} Bonatto Pizza. Todos os direitos reservados.</p>
              <p className="text-white/30">Aceitos: PIX • Cartão de Crédito • Cartão de Débito</p>
            </div>
          </div>
          </RevealSection>
        </div>
      </footer>

    </div>
  );
}

function PublishedStudioHome({ document, storeId, store }: { document: SitePageDocument; storeId: number; store: { name: string; address?: string | null } }) {
  const { data: products = [] } = trpc.products.list.useQuery({ storeId }, { staleTime: 60_000 });
  const { data: categories = [] } = trpc.categories.list.useQuery({ storeId }, { staleTime: 60_000 });
  const { data: promotions = [] } = trpc.promotions.homeActive.useQuery({ storeId }, { staleTime: 30_000 });
  const { data: coupons = [] } = trpc.coupons.listPublic.useQuery({ storeId }, { staleTime: 30_000 });
  const { data: rewards = [] } = trpc.rewards.list.useQuery({ storeId }, { staleTime: 60_000 });
  const liveData = { products, categories, promotions, coupons, rewards, store };
  return (
    <div className="min-h-screen pb-24 pt-28" style={siteThemeStyle(document.theme)}>
      <main className="mx-auto space-y-5 px-3 sm:px-5" style={{ maxWidth: "var(--site-content-width)" }}>
        {document.blocks.map((block) => <SiteBlockRenderer key={block.id} block={block} data={liveData} />)}
      </main>
    </div>
  );
}

export default function Home() {
  const { selectedStore } = useStore();
  const published = trpc.siteStudio.published.useQuery(
    { storeId: selectedStore?.id ?? 0, pageKey: "home" },
    { enabled: Boolean(selectedStore?.id), staleTime: 60_000, refetchOnWindowFocus: false },
  );
  if (published.data?.document && selectedStore) return <PublishedStudioHome document={published.data.document} storeId={selectedStore.id} store={selectedStore} />;
  return <HomeLegacy />;
}
