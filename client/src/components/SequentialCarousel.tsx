import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselItem {
  id: number;
  imageUrl: string;
  name: string;
  productId?: number;
}

interface SequentialCarouselProps {
  items: CarouselItem[];
  autoAdvance?: boolean;
  autoAdvanceInterval?: number;
  onCardClick?: (item: CarouselItem) => void;
  cardWidth?: number;
  cardHeight?: number;
  cardGap?: number;
  animationDuration?: number;
  sequenceDelay?: number;
}

export function SequentialCarousel({
  items,
  autoAdvance = true,
  autoAdvanceInterval = 4200,
  onCardClick,
}: SequentialCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wideImages, setWideImages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (currentIndex < items.length) return;
    setCurrentIndex(0);
  }, [currentIndex, items.length]);

  useEffect(() => {
    if (!autoAdvance || items.length < 2) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % items.length);
    }, autoAdvanceInterval);
    return () => window.clearInterval(timer);
  }, [autoAdvance, autoAdvanceInterval, items.length]);

  if (!items.length) return null;
  const currentItem = items[currentIndex] ?? items[0];
  const preserveFullImage = wideImages[currentItem.id] === true;
  const navigate = (direction: number) => setCurrentIndex((index) => (index + direction + items.length) % items.length);

  return (
    <div className="mx-auto w-full max-w-[940px] px-3 pb-5 sm:px-4">
      <div className="relative overflow-hidden rounded-[16px] border border-black/[.06] bg-[#DA1923] shadow-[0_18px_38px_-30px_rgba(88,12,18,0.55)] sm:rounded-[20px]">
        <button type="button" aria-label="Item anterior" onClick={() => navigate(-1)} className="absolute left-2.5 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-[#9f1119]/80 text-white transition-colors hover:bg-[#7f0d14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:left-4 md:size-10">
          <ChevronLeft className="size-5" />
        </button>

        <button type="button" className="group relative block h-[220px] w-full overflow-hidden text-left sm:h-[300px] lg:h-[350px]" onClick={() => onCardClick?.(currentItem)}>
          {currentItem.imageUrl ? (
            <>
              {preserveFullImage && <img aria-hidden="true" src={currentItem.imageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl" />}
              <img
                key={currentItem.id}
                src={currentItem.imageUrl}
                alt={currentItem.name || "Destaque Bonatto"}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  const aspectRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
                  setWideImages((current) => current[currentItem.id] === (aspectRatio > 2.4) ? current : { ...current, [currentItem.id]: aspectRatio > 2.4 });
                }}
                className={`relative h-full w-full animate-[adminFadeIn_0.3s_ease-out] ${preserveFullImage ? "object-contain p-3 sm:p-5" : "object-cover"}`}
              />
            </>
          ) : <div className="h-full w-full bg-[#DA1923]" />}
          {currentItem.imageUrl && <span className="sr-only">Abrir {currentItem.name || "destaque"} no cardápio</span>}
          {!currentItem.imageUrl && currentItem.name && (
            <div className="absolute inset-x-0 bottom-0 z-10 px-14 pb-8 text-center text-white sm:px-20 sm:pb-10">
              <p className="text-2xl leading-none sm:text-4xl lg:text-5xl">{currentItem.name}</p>
              <span className="mt-3 inline-flex rounded-full bg-[#DA1923] px-5 py-2.5 text-xs font-black uppercase tracking-[0.04em] text-white transition-transform group-hover:-translate-y-0.5 sm:px-6 sm:text-sm">Ver no cardápio</span>
            </div>
          )}
        </button>

        <button type="button" aria-label="Próximo item" onClick={() => navigate(1)} className="absolute right-2.5 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-[#9f1119]/80 text-white transition-colors hover:bg-[#7f0d14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:right-4 md:size-10">
          <ChevronRight className="size-5" />
        </button>

        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 sm:bottom-4" aria-label="Selecionar item do slider">
          {items.slice(0, 8).map((item, index) => <button key={item.id} type="button" aria-label={`Mostrar ${item.name}`} onClick={() => setCurrentIndex(index)} className={`h-1.5 rounded-full transition-all ${index === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70"}`} />)}
        </div>
      </div>
    </div>
  );
}
