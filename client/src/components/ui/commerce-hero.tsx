"use client";

import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ArrowRight, Star, Clock, Truck } from "lucide-react";

const PIZZA_HERO_IMG = "/brand/pizza-hero.webp";

export interface PromoCard {
  title: string;
  description: string;
  price: string;
  image: string;
  days?: string;
  href?: string;
}

interface CommerceHeroProps {
  headline?: string;
  subheadline?: string;
  promos: PromoCard[];
  className?: string;
}

const CATEGORY_CARDS = [
  {
    name: "Pizzas",
    desc: "Mais de 20 sabores",
    emoji: "🍕",
    bg: "#6E0D12",
    img: "/brand/pizza-1-margherita.jpg",
  },
  {
    name: "Calzones",
    desc: "Recheados e crocantes",
    emoji: "🥙",
    bg: "#9b1c1c",
    img: "/brand/pizza-14.png",
  },
  {
    name: "Bebidas",
    desc: "Geladas e refrescantes",
    emoji: "🥤",
    bg: "#7f1d1d",
    img: "/brand/pizza-8.jpg",
  },
  {
    name: "Lasanhas",
    desc: "Feitas na hora",
    emoji: "🍝",
    bg: "#7a1215",
    img: "/brand/pizza-15.jpg",
  },
  {
    name: "Sorvetes",
    desc: "Para adoçar o fim",
    emoji: "🍦",
    bg: "#6E0D12",
    img: "/brand/pizza-10.webp",
  },
  {
    name: "Empanados",
    desc: "Crocantes e saborosos",
    emoji: "🍗",
    bg: "#8b1a1a",
    img: "/brand/pizza-16.jpg",
  },
];

function InfiniteCategoryCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Duplicate cards for seamless loop
  const cards = [...CATEGORY_CARDS, ...CATEGORY_CARDS];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = 220 + 12; // card width + gap
    const totalWidth = cardWidth * CATEGORY_CARDS.length;

    const animate = () => {
      if (!isPaused) {
        posRef.current -= 0.5;
        if (posRef.current <= -totalWidth) {
          posRef.current = 0;
        }
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPaused]);

  return (
    <div className="relative mt-4 z-10 pb-2 overflow-hidden">
      {/* Left shadow */}
      <div
        className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, rgba(255,255,255,0.95) 0%, transparent 100%)" }}
      />
      {/* Right shadow */}
      <div
        className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, rgba(255,255,255,0.95) 0%, transparent 100%)" }}
      />

      <div
        ref={trackRef}
        className="flex gap-3 py-3 px-4"
        style={{ willChange: "transform", width: "max-content" }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {cards.map((cat, i) => (
          <Link href="/cardapio" key={`${cat.name}-${i}`}>
            <div
              className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex-shrink-0"
              style={{ background: cat.bg, width: 220, height: 280 }}
            >
              {/* Image */}
              <img
                src={cat.img}
                alt={cat.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-85 group-hover:scale-105 transition-all duration-500"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white font-black text-base leading-tight">
                  {cat.emoji} {cat.name}
                </p>
                <p className="text-white/60 text-xs mt-0.5">{cat.desc}</p>
              </div>

              {/* Arrow on hover */}
              <div className="absolute top-3 right-3 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <ArrowRight className="w-3.5 h-3.5 text-[#6E0D12]" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CommerceHero({
  headline = "A pizza que você merece",
  subheadline = "Massa artesanal, ingredientes frescos e entrega rápida. Sabor de verdade na sua porta em até 60 minutos.",
  promos,
  className,
}: CommerceHeroProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* ── HERO BANNER ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #4a0810 0%, #6E0D12 50%, #8b1a1a 100%)" }}
      >
        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Glow behind pizza */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 70% 50%, rgba(255,100,80,0.18) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center min-h-[420px] sm:min-h-[480px] py-10 relative">
            {/* LEFT — text */}
            <motion.div
              className="flex-1 z-10 pr-4 sm:pr-8"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5">
                <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                <span className="text-white text-xs font-semibold tracking-wide">4.8 ★ · +500 avaliações</span>
              </div>

              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] mb-5"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {headline.split(" ").slice(0, 2).join(" ")}{" "}
                <span className="text-yellow-300">{headline.split(" ")[2]}</span>
                <br />
                <span className="text-white">{headline.split(" ").slice(3).join(" ")}</span>
              </h1>

              <p className="text-white/75 text-sm sm:text-base leading-relaxed max-w-sm mb-8">
                {subheadline}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/cardapio">
                  <button className="btn-gradient-animated px-8 py-3.5 rounded-full font-bold text-white text-sm shadow-lg hover:scale-105 transition-transform duration-300 flex items-center gap-2">
                    Pedir Agora
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link href="/cardapio">
                  <button className="px-8 py-3.5 rounded-full font-semibold text-white text-sm border-2 border-white/30 hover:bg-white/10 transition-all duration-300">
                    Ver Cardápio →
                  </button>
                </Link>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-5 mt-8">
                <div className="flex items-center gap-1.5 text-white/70 text-xs">
                  <Truck className="w-4 h-4 text-yellow-300" />
                  <span>Frete grátis</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                <div className="flex items-center gap-1.5 text-white/70 text-xs">
                  <Clock className="w-4 h-4 text-yellow-300" />
                  <span>40–60 min</span>
                </div>
              </div>
            </motion.div>

            {/* RIGHT — pizza image */}
            <motion.div
              className="absolute right-0 bottom-0 top-0 flex items-end justify-end pointer-events-none"
              style={{ width: "48%", maxWidth: 480 }}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              <img
                src={PIZZA_HERO_IMG}
                alt="Pizza artesanal Bonatto"
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover object-center"
                style={{
                  maskImage: "linear-gradient(to left, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)",
                  WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)",
                  filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.4))",
                }}
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── DIVISOR ── */}
      <div
        style={{
          position: "relative",
          height: "40px",
          background: "linear-gradient(135deg, #4a0810 0%, #6E0D12 50%, #8b1a1a 100%)",
          clipPath: "polygon(43% 6%, 57% 6%, 60% 0, 100% 0, 100% 100%, 53% 100%, 0 100%, 0 53%, 0 0, 40% 0)",
          borderTop: "2px solid #6E0D12",
          marginTop: "-2px",
        }}
      />

      {/* ── CATEGORY CARDS — Infinite Carousel ── */}
      <InfiniteCategoryCarousel />

      {/* ── PROMO CARDS (promos prop) ── */}
      {promos.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {promos.map((promo, index) => (
              <motion.div
                key={promo.title}
                className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6E0D12] rounded-l-2xl" />
                <div className="flex gap-4 p-5 pl-6">
                  <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-50">
                    <img
                      src={promo.image}
                      alt={promo.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 leading-snug mb-1 group-hover:text-[#6E0D12] transition-colors">
                      {promo.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{promo.description}</p>
                    <p className="mt-2 text-sm font-bold text-[#6E0D12]">{promo.price}</p>
                  </div>
                </div>
                <div className="mx-5 mb-5">
                  <Link href={promo.href ?? "/cardapio"}>
                    <button
                      className="w-full py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      style={{ backgroundColor: "#6E0D12" }}
                    >
                      {promo.days ?? "Pedir Agora"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
