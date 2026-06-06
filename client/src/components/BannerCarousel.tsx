import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

// Fallback banners shown while loading or if no slides are configured
const FALLBACK_BANNERS = [
  {
    id: 1,
    imageUrl: "/brand/banner-combo.png",
    videoUrl: null as string | null,
    title: "Combo Especial",
    ctaLink: "/cardapio",
  },
];

function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

function getYouTubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`;
}

interface BannerSlide {
  id: number;
  imageUrl: string | null;
  videoUrl: string | null;
  title: string;
  ctaLink: string | null;
}

/** Injeta <link rel="preload"> no <head> para as primeiras N imagens do carrossel */
function usePreloadImages(urls: string[], count = 2) {
  useEffect(() => {
    if (!urls.length) return;
    const links: HTMLLinkElement[] = [];
    urls.slice(0, count).forEach((url) => {
      if (!url) return;
      const existing = document.querySelector(`link[rel="preload"][href="${url}"]`);
      if (existing) return;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      document.head.appendChild(link);
      links.push(link);
    });
    return () => {
      links.forEach((l) => l.parentNode?.removeChild(l));
    };
  }, [urls, count]);
}

/** Pré-carrega as próximas imagens via Image() para tê-las em cache antes de exibir */
function usePrefetchNext(banners: BannerSlide[], current: number) {
  useEffect(() => {
    if (banners.length <= 1) return;
    const nextIdx = (current + 1) % banners.length;
    const next = banners[nextIdx];
    if (next?.imageUrl && !next.videoUrl) {
      const img = new Image();
      img.src = next.imageUrl;
    }
  }, [banners, current]);
}

function VideoSlide({ videoUrl }: { videoUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  if (isYouTubeUrl(videoUrl)) {
    const embedUrl = getYouTubeEmbedUrl(videoUrl);
    if (!embedUrl) return null;
    return (
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allow="autoplay; encrypted-media"
        allowFullScreen
        title="Banner vídeo"
        style={{ border: "none", pointerEvents: "none" }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className="w-full h-full object-cover object-center"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
    />
  );
}

export function BannerCarousel() {
  const { data: slides } = trpc.menuSlides.list.useQuery();

  const banners: BannerSlide[] =
    slides && slides.length > 0
      ? slides.map((s) => ({
          id: s.id,
          imageUrl: s.imageUrl ?? null,
          videoUrl: (s as any).videoUrl ?? null,
          title: s.title,
          ctaLink: s.ctaLink ?? "/cardapio",
        }))
      : FALLBACK_BANNERS;

  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Preload das primeiras 2 imagens assim que os dados chegam
  const imageUrls = banners
    .filter((b) => b.imageUrl && !b.videoUrl)
    .map((b) => b.imageUrl as string);
  usePreloadImages(imageUrls, 2);

  // Prefetch do próximo slide enquanto o atual está visível
  usePrefetchNext(banners, current);

  const goTo = useCallback(
    (index: number) => {
      if (animating) return;
      setAnimating(true);
      setCurrent(index);
      setTimeout(() => setAnimating(false), 500);
    },
    [animating]
  );

  const next = useCallback(
    () => goTo((current + 1) % banners.length),
    [current, goTo, banners.length]
  );
  const prev = useCallback(
    () => goTo((current - 1 + banners.length) % banners.length),
    [current, goTo, banners.length]
  );

  useEffect(() => {
    setCurrent(0);
  }, [banners.length]);

  // Auto-advance only for image slides; video slides auto-advance after 12s
  useEffect(() => {
    if (banners.length <= 1) return;
    const currentBanner = banners[current];
    const delay = currentBanner?.videoUrl ? 12000 : 5500;
    const t = setTimeout(next, delay);
    return () => clearTimeout(t);
  }, [next, banners, current]);

  if (!banners.length) return null;

  return (
    <section className="w-full bg-[#0d0d0d]">
      <div className="w-full">
        {/* 16:9 aspect ratio — full-width */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "16/9" }}
        >
          {banners.map((b, i) => {
            const hasVideo = !!b.videoUrl;
            const isActive = i === current;
            // Pré-renderiza o próximo slide (invisível) para que já esteja no DOM e carregado
            const isNext = i === (current + 1) % banners.length;
            return (
              <div
                key={b.id}
                className="absolute inset-0 transition-opacity duration-500"
                style={{
                  opacity: isActive ? 1 : 0,
                  zIndex: isActive ? 1 : 0,
                  pointerEvents: isActive ? "auto" : "none",
                }}
              >
                {hasVideo ? (
                  <div className="w-full h-full">
                    <VideoSlide videoUrl={b.videoUrl!} />
                  </div>
                ) : b.imageUrl ? (
                  <Link href={b.ctaLink ?? "/cardapio"}>
                    <img
                      src={b.imageUrl}
                      alt={b.title}
                      className="w-full h-full object-cover object-center cursor-pointer"
                      // Slide ativo e próximo carregam com prioridade alta; demais são lazy
                      loading={isActive || isNext ? "eager" : "lazy"}
                      // fetchpriority hint para o browser priorizar o slide atual
                      {...(isActive ? { fetchPriority: "high" } : isNext ? { fetchPriority: "low" } : {})}
                      decoding={isActive ? "sync" : "async"}
                      draggable={false}
                    />
                  </Link>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#4a0810] to-[#6E0D12]">
                    <span className="text-white text-2xl font-bold opacity-60">{b.title}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Navigation arrows */}
          {banners.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm transition-all duration-200"
                aria-label="Banner anterior"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm transition-all duration-200"
                aria-label="Próximo banner"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {banners.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: i === current ? 20 : 6,
                    height: 6,
                    background: i === current ? "#ffffff" : "rgba(255,255,255,0.45)",
                  }}
                  aria-label={`Banner ${i + 1}${banners[i]?.videoUrl ? " (vídeo)" : ""}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
