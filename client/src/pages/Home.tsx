import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Clock,
  MapPin,
  ShoppingBag,
  Star,
  Truck,
  Flame,
  Award,
  ChevronRight,
  Phone,
  Instagram,
  Facebook,
  Leaf,
  Zap,
  Heart,
  Quote,
  CheckCircle2,
  ArrowRight,
  Crown,
  Bike,
} from "lucide-react";
import { Link } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { useEffect, useRef, useState } from "react";
import { GridPattern } from "@/components/ui/grid-pattern";
import { cn } from "@/lib/utils";
import { SequentialCarousel } from "@/components/SequentialCarousel";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ShinyButton } from "@/components/ui/shiny-button";
import { HomePopup } from "@/components/HomePopup";
import { BRAND_ASSETS } from "@/lib/brand";

const LOGO_URL = "/brand/bonatto-logo-home.jpg";

const PIZZA_HERO_MAIN = "/brand/pizza-1-margherita.jpg";
const CALZONE_IMG = "/brand/pizza-14.png";
const LASANHA_IMG = "/brand/pizza-15.jpg";
const BEBIDA_IMG = "/brand/pizza-8.jpg";
const SORVETE_IMG = "/brand/pizza-10.webp";
const EMPANADO_IMG = "/brand/pizza-16.jpg";

const CATEGORIES = [
  { name: "Pizzas", emoji: "🍕", img: PIZZA_HERO_MAIN, desc: "Mais de 20 sabores" },
  { name: "Calzones", emoji: "🥙", img: CALZONE_IMG, desc: "Recheados e crocantes" },
  { name: "Lasanhas", emoji: "🍝", img: LASANHA_IMG, desc: "Feitas na hora" },
  { name: "Bebidas", emoji: "🥤", img: BEBIDA_IMG, desc: "Geladas e refrescantes" },
  { name: "Sorvetes", emoji: "🍦", img: SORVETE_IMG, desc: "Para adoçar o fim" },
  { name: "Empanados", emoji: "🍗", img: EMPANADO_IMG, desc: "Crocantes e saborosos" },
];

const TESTIMONIALS = [
  {
    name: "Maria Fernanda",
    rating: 5,
    text: "A melhor pizza de Mateus Leme! Massa crocante, recheio generoso e entrega super rápida. Já pedi mais de 10 vezes!",
    avatar: "MF",
  },
  {
    name: "Carlos Eduardo",
    rating: 5,
    text: "Simplesmente incrível! A pizza de Calabresa é de outro nível. Sempre chega quentinha e no tempo prometido.",
    avatar: "CE",
  },
  {
    name: "Ana Paula",
    rating: 5,
    text: "Atendimento excelente e pizza deliciosa. O calzone de frango com catupiry é sensacional. Super recomendo!",
    avatar: "AP",
  },
];

const DIFERENCIAIS = [
  {
    icon: Leaf,
    title: "Ingredientes Artesanais",
    desc: "Selecionamos os melhores ingredientes frescos para garantir sabor e qualidade em cada fatia.",
  },
  {
    icon: Award,
    title: "Massa Própria",
    desc: "Nossa massa é preparada diariamente na casa, com fermentação natural e receita exclusiva.",
  },
  {
    icon: Zap,
    title: "Entrega Rápida",
    desc: "Entregamos em até 60 minutos com frete grátis para toda a região de Mateus Leme.",
  },
];

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

export default function Home() {
  const { data: featuredProducts } = trpc.products.list.useQuery({ categoryId: undefined });
  const { data: carouselImages } = trpc.carousel.list.useQuery();
  const { addItem } = useCart();
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const topProducts = featuredProducts?.slice(0, 6) ?? [];

  // Usa imagens do carrossel gerenciado pelo admin; se vazio, cai para produtos
  const carouselItems = carouselImages && carouselImages.length > 0
    ? carouselImages.map((img) => ({ id: img.id, imageUrl: img.imageUrl, name: img.title ?? "" }))
    : topProducts.map((p) => ({ id: p.id, imageUrl: p.imageUrl ?? "", name: p.name }));

  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial((i) => (i + 1) % TESTIMONIALS.length), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative min-h-screen bg-white overflow-x-hidden">
      {/* Engagement popup — appears after 60s, once per session */}
      <HomePopup />

      {/* Grid Pattern Background — z-0 para ficar atrás de todo conteúdo */}
      <GridPattern
        width={40}
        height={40}
        x={-1}
        y={-1}
        className={cn(
          "fill-[#fce8e8]/20 stroke-[#f9d0d0]/20 z-0",
          "[mask-image:radial-gradient(ellipse_at_top,white_20%,transparent_70%)]",
        )}
      />

      {/* ═══════════════════════════════════════════════════════
          HERO — Headline + Carrossel Sequencial 3D
      ═══════════════════════════════════════════════════════ */}
      <section className="pt-36 pb-2 bg-white overflow-hidden relative z-10">
        <div className="container text-center mb-4 px-4">
          <h1 className="font-extrabold text-gray-900 leading-tight mb-2 whitespace-nowrap text-[clamp(1.9rem,6.5vw,4rem)]">
            Sua fome não espera.<br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #8b0000 0%, #e63946 100%)" }}
            >A gente também não.</span>
          </h1>
          <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto mt-3">
            Escolha o seu sabor, a gente cuida do resto. É simples assim.
          </p>
        </div>
        {/* Carrossel responsivo: menor no mobile, maior no desktop */}
        <div className="block sm:hidden">
          <SequentialCarousel
            items={carouselItems}
            cardWidth={120}
            cardHeight={155}
            cardGap={95}
            autoAdvance={true}
            autoAdvanceInterval={2800}
            onCardClick={() => window.location.href = "/cardapio"}
          />
        </div>
        <div className="hidden sm:block">
          <SequentialCarousel
            items={carouselItems}
            cardWidth={180}
            cardHeight={230}
            cardGap={145}
            autoAdvance={true}
            autoAdvanceInterval={2800}
            onCardClick={() => window.location.href = "/cardapio"}
          />
        </div>
      </section>

      {/* DIVISOR */}
      <section className="bg-[#6E0D12] py-2 overflow-hidden">
        <div className="flex" style={{ animation: "tickerScroll 18s linear infinite" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center shrink-0">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center">
                  <img src={BRAND_ASSETS.whiteLogo} alt="Bonatto" className="h-8 w-auto object-contain mx-6" style={{ filter: "brightness(0) invert(1)" }} />
                  <span className="text-white/40 text-sm mx-1 select-none">•</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO MASCOTE — entrega + diferenciais
      ═══════════════════════════════════════════════════════ */}
      <section className="py-16 bg-white overflow-hidden">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">

            {/* Mascote com animação de entrada da esquerda */}
            <RevealSection className="flex-shrink-0 flex justify-center">
              <div
                style={{
                  animation: "mascoteBounce 3.5s ease-in-out infinite",
                }}
              >
                <img
                  src={BRAND_ASSETS.mascot}
                  alt="Mascote Bonatto Pizza segurando caixas"
                  loading="lazy"
                  decoding="async"
                  className="w-44 h-auto md:w-56 object-contain drop-shadow-2xl"
                />
              </div>
            </RevealSection>

            {/* Copy + diferenciais */}
            <div className="flex-1 text-center md:text-left">
              <RevealSection>
                <p className="text-[#6E0D12] font-bold text-sm uppercase tracking-widest mb-3">Peça Agora</p>
                <h2
                  className="text-3xl md:text-4xl font-black text-gray-900 leading-tight mb-3"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Sua fome tem limite?{" "}
                  <span className="text-[#6E0D12]">A gente não tem.</span>
                </h2>
                <p className="text-gray-500 text-base mb-8 max-w-md">
                  Do simples ao exagerado, temos o tamanho certo pra você. Peça quantas quiser — a gente dá conta.
                </p>
              </RevealSection>
              <div className="space-y-4 mb-8">
                {[
                  { emoji: "🍕", title: "Mais de 20 sabores", desc: "Pizzas tradicionais, especiais e doces. Tem pra todo gosto e toda fome." },
                  { emoji: "🚀", title: "Entrega em 40–60 min", desc: "Frete grátis para toda a região de Mateus Leme, sem mínimo de pedido." },
                  { emoji: "📦", title: "Qualquer tamanho", desc: "Broto, média, grande ou família — do individual ao festão, a escolha é sua." },
                ].map((item, i) => (
                  <RevealSection key={item.title} delay={i * 100}>
                    <div className="flex items-start gap-4 text-left">
                      <div className="w-11 h-11 bg-[#fdf2f2] rounded-xl flex items-center justify-center text-xl shrink-0">
                        {item.emoji}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                        <p className="text-gray-500 text-xs leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </RevealSection>
                ))}
              </div>
              <RevealSection delay={350}>
                <Link href="/cardapio">
                  <ShinyButton>
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5" />
                      Montar meu pedido
                    </span>
                  </ShinyButton>
                </Link>
              </RevealSection>
            </div>
          </div>
        </div>
      </section>

      {/* Keyframe da animação flutuante do mascote */}
      <style>{`
        @keyframes mascoteBounce {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-14px) rotate(1deg); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════
          DIVISOR — Ticker infinito com logo
      ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#6E0D12] py-2 overflow-hidden">
        <div className="flex" style={{ animation: "tickerScroll 18s linear infinite" }}>
          {/* Duplicamos 4x para garantir loop contínuo sem gaps */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center shrink-0">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center">
                  <img
                    src={BRAND_ASSETS.whiteLogo}
                    alt="Bonatto Pizza"
                    className="h-8 w-auto object-contain mx-6"
                    style={{ filter: "brightness(0) invert(1)" }}
                  />
                  <span className="text-white/40 text-sm mx-1 select-none">•</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Keyframe do ticker */}
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-25%); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════
          CATEGORIAS
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 bg-gray-50">
        <div className="container">
          <BlurRevealItem className="text-center mb-12">
            <p className="text-[#6E0D12] font-bold text-sm uppercase tracking-widest mb-2">Cardápio Completo</p>
            <h2
              className="text-4xl md:text-5xl font-black text-gray-900 leading-tight"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              O que você vai <span className="text-[#6E0D12]">pedir hoje?</span>
            </h2>
          </BlurRevealItem>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-hidden">
            {CATEGORIES.map((cat, i) => (
              <SlideInSection
                key={cat.name}
                direction={i % 2 === 0 ? "left" : "right"}
                delay={Math.floor(i / 2) * 90}
              >
                <Link href="/cardapio">
                  <div className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 aspect-[4/3] ring-1 ring-black/5">
                    <img
                      src={cat.img}
                      alt={cat.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-black text-lg leading-tight">{cat.emoji} {cat.name}</p>
                      <p className="text-white/70 text-xs mt-0.5">{cat.desc}</p>
                    </div>
                    <div className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-4 h-4 text-[#6E0D12]" />
                    </div>
                  </div>
                </Link>
              </SlideInSection>
            ))}
          </div>

          <RevealSection className="text-center mt-8" delay={200}>
            <Link href="/cardapio">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 font-bold border-[#f9d0d0] text-[#6E0D12] hover:bg-[#fdf2f2] gap-2 rounded-xl"
              >
                Ver cardápio completo
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DIVISOR — Ticker entre cardápio e diferenciais
      ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#6E0D12] py-2 overflow-hidden">
        <div className="flex" style={{ animation: "tickerScroll 18s linear infinite" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center shrink-0">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center">
                  <img
                    src={BRAND_ASSETS.whiteLogo}
                    alt="Bonatto Pizza"
                    className="h-8 w-auto object-contain mx-6"
                    style={{ filter: "brightness(0) invert(1)" }}
                  />
                  <span className="text-white/40 text-sm mx-1 select-none">•</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DIFERENCIAIS
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 bg-white relative overflow-hidden">
        {/* Fundo: GridPattern claro */}
        <GridPattern
          width={40}
          height={40}
          x={-1}
          y={-1}
          className={cn(
            "absolute inset-0 h-full w-full stroke-gray-200 fill-transparent",
            "[mask-image:radial-gradient(ellipse_at_center,white_50%,transparent_85%)]"
          )}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(110,13,18,0.06)_0%,_transparent_65%)] pointer-events-none" />

        <div className="container relative z-10">
          <BlurRevealItem className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#6E0D12]/10 border border-[#6E0D12]/30 rounded-full px-4 py-1.5 mb-4">
              <span className="text-[#6E0D12] font-bold text-xs uppercase tracking-widest">Por que a Bonatto?</span>
            </div>
            <h2
              className="text-4xl md:text-5xl font-black text-gray-900 leading-tight"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Feita com <span className="text-[#6E0D12]">paixão</span>, entregue com <span className="text-[#6E0D12]">cuidado</span>
            </h2>
          </BlurRevealItem>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-hidden">
            {[
              { emoji: "🌿", title: "Ingredientes Artesanais", desc: "Frescos e selecionados em cada fatia" },
              { emoji: "🍕", title: "Massa Própria", desc: "Fermentada diariamente, receita exclusiva" },
              { emoji: "🚀", title: "Entrega Rápida", desc: "Até 60 min, frete grátis em Mateus Leme" },
              { emoji: "❤️", title: "Feita com Amor", desc: "Cada pizza é preparada com cuidado e carinho" },
            ].map(({ emoji, title, desc }, i) => (
              <SlideInSection key={title} direction={i % 2 === 0 ? "left" : "right"} delay={Math.floor(i / 2) * 90}>
                <div className="group bg-white hover:bg-[#fdf2f2] border border-gray-100 hover:border-[#6E0D12]/30 rounded-2xl p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(110,13,18,0.12)] h-full flex flex-col items-center">
                  <div className="text-4xl mb-3">{emoji}</div>
                  <h3 className="text-gray-900 font-black text-sm leading-tight mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {title}
                  </h3>
                   <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                </div>
              </SlideInSection>
            ))}
          </div>
        </div>
      </section>

      {/* DIVISOR */}
      <section className="bg-[#6E0D12] py-2 overflow-hidden">
        <div className="flex" style={{ animation: "tickerScroll 18s linear infinite" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center shrink-0">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center">
                  <img src={BRAND_ASSETS.whiteLogo} alt="Bonatto" className="h-8 w-auto object-contain mx-6" style={{ filter: "brightness(0) invert(1)" }} />
                  <span className="text-white/40 text-sm mx-1 select-none">•</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          CLUBE BONATTOTO
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 bg-white relative overflow-hidden">
        {/* Fundo: GridPattern claro */}
        <GridPattern
          width={40}
          height={40}
          x={-1}
          y={-1}
          className={cn(
            "absolute inset-0 h-full w-full stroke-gray-200 fill-transparent",
            "[mask-image:radial-gradient(ellipse_at_center,white_50%,transparent_85%)]"
          )}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(110,13,18,0.05)_0%,_transparent_65%)] pointer-events-none" />

        <div className="container relative z-10">
          {/* Header */}
          <BlurRevealItem className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#6E0D12]/10 border border-[#6E0D12]/30 rounded-full px-4 py-1.5 mb-4">
              <Crown className="w-4 h-4 text-[#6E0D12]" />
              <span className="text-[#6E0D12] font-bold text-xs uppercase tracking-widest">Clube do Bonatto</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-4"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Assine, economize e
              <span className="block text-[#6E0D12]">
                ganhe pizza todo mês.
              </span>
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Cliente fiel merece mais. Escolha seu plano e faça parte do clube.
            </p>
          </BlurRevealItem>

          {/* Cards dos planos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto overflow-hidden">

            {/* Plano Fã Bonatto */}
            <SlideInSection direction="left" delay={0}>
              <Link href="/clube">
                <div className="group relative rounded-2xl border border-gray-200 bg-white hover:border-[#6E0D12]/40 hover:shadow-[0_8px_30px_rgba(110,13,18,0.10)] transition-all duration-300 hover:-translate-y-1 cursor-pointer p-7 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-[#fdf2f2] flex items-center justify-center">
                      <Star className="w-5 h-5 text-[#6E0D12]" />
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-black text-xl">Fã Bonatto</h3>
                      <p className="text-gray-400 text-xs">Entrou pro time. Agora é da família.</p>
                    </div>
                  </div>
                  <div className="mb-6">
                    <span className="text-4xl font-black text-gray-900">R$ 9,99</span>
                    <span className="text-gray-400 text-sm">/mês</span>
                  </div>
                  <ul className="space-y-3 flex-1 mb-6">
                    {["15% de desconto em todos os pedidos", "1 pizza grátis por mês", "Acesso a promoções exclusivas"].map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="w-full py-3 rounded-xl text-center text-sm font-bold border border-[#6E0D12] text-[#6E0D12] group-hover:bg-[#6E0D12] group-hover:text-white transition-all">
                    Quero ser Fã →
                  </div>
                </div>
              </Link>
            </SlideInSection>

            {/* Plano Sócio Bonatto — PREMIUM */}
            <SlideInSection direction="right" delay={80}>
              <Link href="/clube">
                <div className="group relative rounded-2xl border-2 border-[#6E0D12] bg-white hover:shadow-[0_8px_40px_rgba(110,13,18,0.18)] transition-all duration-300 hover:-translate-y-1 cursor-pointer p-7 h-full flex flex-col">
                  {/* Badge premium */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-[#6E0D12] text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">
                      ⭐ Mais popular
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-[#6E0D12] flex items-center justify-center shadow-lg shadow-[#6E0D12]/30">
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-black text-xl">Sócio Bonatto</h3>
                      <p className="text-gray-400 text-xs">Você não pede pizza. Você manda fazer.</p>
                    </div>
                  </div>
                  <div className="mb-6">
                    <span className="text-4xl font-black text-gray-900">R$ 19,00</span>
                    <span className="text-gray-400 text-sm">/mês</span>
                  </div>
                  <ul className="space-y-3 flex-1 mb-6">
                    {["20% de desconto em todos os pedidos", "Entrega sempre grátis", "1 pizza grátis por mês", "Acesso VIP a lançamentos e promoções"].map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-[#6E0D12] flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div
                    className="w-full py-3 rounded-xl text-center text-sm font-black text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #6E0D12 0%, #a01218 100%)' }}
                  >
                    Quero ser Sócio →
                  </div>
                </div>
              </Link>
            </SlideInSection>
          </div>

          {/* Rodapé da seção */}
          <RevealSection className="text-center mt-10" delay={200}>
            <p className="text-gray-400 text-sm">
              Cancele quando quiser · Pagamento via PIX · Ativação imediata
            </p>
          </RevealSection>
        </div>
      </section>

      {/* DIVISOR */}
      <section className="bg-[#6E0D12] py-2 overflow-hidden">
        <div className="flex" style={{ animation: "tickerScroll 18s linear infinite" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center shrink-0">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center">
                  <img src={BRAND_ASSETS.whiteLogo} alt="Bonatto" className="h-8 w-auto object-contain mx-6" style={{ filter: "brightness(0) invert(1)" }} />
                  <span className="text-white/40 text-sm mx-1 select-none">•</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DEPOIMENTOS
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 bg-white">
        <div className="container">
          <BlurRevealItem className="text-center mb-12">
            <p className="text-[#6E0D12] font-bold text-sm uppercase tracking-widest mb-2">Depoimentos</p>
            <h2
              className="text-4xl md:text-5xl font-black text-gray-900 leading-tight"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              O que nossos clientes <span className="text-[#6E0D12]">dizem</span>
            </h2>
          </BlurRevealItem>

          {/* Cards de depoimentos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
            {TESTIMONIALS.map((t, i) => (
              <BlurRevealItem key={t.name} delay={i * 100}>
                <div
                  className={`p-6 rounded-2xl border transition-all duration-300 ${
                    i === activeTestimonial
                      ? "border-[#f9d0d0] bg-[#fdf2f2] shadow-lg shadow-[#fce8e8]"
                      : "border-gray-100 bg-white hover:border-[#fce8e8] hover:shadow-md"
                  }`}
                >
                  <Quote className="w-8 h-8 text-[#f9d0d0] mb-4" />
                  <p className="text-gray-600 text-sm leading-relaxed mb-5">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#6E0D12] btn-bonatto rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-gray-900 font-bold text-sm">{t.name}</p>
                      <div className="flex gap-0.5 mt-0.5">
                        {[1,2,3,4,5].map(s => <Star key={s} className="w-3 h-3 text-yellow-400 fill-yellow-400" />)}
                      </div>
                    </div>
                  </div>
                </div>
              </BlurRevealItem>
            ))}
          </div>

          {/* Indicadores */}
          <div className="flex justify-center gap-2 mt-8">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeTestimonial ? "w-8 bg-[#6E0D12] btn-bonatto" : "w-2 bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* DIVISOR */}
      <section className="bg-[#6E0D12] py-2 overflow-hidden">
        <div className="flex" style={{ animation: "tickerScroll 18s linear infinite" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center shrink-0">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center">
                  <img src={BRAND_ASSETS.whiteLogo} alt="Bonatto" className="h-8 w-auto object-contain mx-6" style={{ filter: "brightness(0) invert(1)" }} />
                  <span className="text-white/40 text-sm mx-1 select-none">•</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          CTA FINAL — faixa vermelha
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 bg-[#6E0D12] btn-bonatto relative overflow-hidden">
        {/* Padrão de fundo sutil */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="container relative z-10 text-center">
          <BlurRevealItem>
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 mb-6">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-semibold">Frete grátis em todos os pedidos</span>
            </div>
            <h2
              className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight"
              style={{ fontFamily: "'Poppins', sans-serif" }}
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
                  className="h-14 px-10 text-base font-bold bg-white text-[#6E0D12] hover:bg-white/90 gap-2 shadow-xl hover:scale-105 transition-all rounded-xl"
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
            <div className="group flex items-center justify-between bg-[#1a0305] hover:bg-[#220408] border border-[#6E0D12]/30 hover:border-[#6E0D12]/60 rounded-2xl px-6 py-5 transition-all cursor-pointer max-w-md mx-auto">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#6E0D12]/20 flex items-center justify-center shrink-0 group-hover:bg-[#6E0D12]/30 transition-colors">
                  <Bike className="w-6 h-6 text-[#ff6b6b]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
                  <p className="font-black text-white text-lg" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
                  className="w-9 h-9 bg-white/5 hover:bg-[#6E0D12] btn-bonatto/20 border border-white/10 rounded-lg flex items-center justify-center transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="https://www.facebook.com/bonattopizza" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 bg-white/5 hover:bg-[#6E0D12] btn-bonatto/20 border border-white/10 rounded-lg flex items-center justify-center transition-colors">
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

      {/* CTA FLUTUANTE MOBILE */}
      <div className="fixed bottom-6 left-4 right-4 z-50 md:hidden">
        <Link href="/cardapio">
          <ShinyButton className="w-full h-14">
            <span className="flex items-center justify-center gap-2.5">
              <ShoppingBag className="w-5 h-5" />
              FAZER PEDIDO AGORA
            </span>
          </ShinyButton>
        </Link>
      </div>
    </div>
  );
}
