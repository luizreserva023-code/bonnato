import { useEffect, useState, useRef, useMemo, startTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselItem {
  id: number;
  imageUrl: string;
  name: string;
}

interface SequentialCarouselProps {
  items: CarouselItem[];
  cardWidth?: number;
  cardHeight?: number;
  cardGap?: number;
  animationDuration?: number;
  sequenceDelay?: number;
  autoAdvance?: boolean;
  autoAdvanceInterval?: number;
  onCardClick?: (item: CarouselItem) => void;
}

export function SequentialCarousel({
  items,
  cardWidth = 260,
  cardHeight = 320,
  cardGap = 220,
  animationDuration = 550,
  sequenceDelay = 60,
  autoAdvance = true,
  autoAdvanceInterval = 3000,
  onCardClick,
}: SequentialCarouselProps) {
  const originalCards = useMemo(
    () => items.map((item, i) => ({ id: i, item })),
    [items]
  );

  const cards = useMemo(() => {
    if (originalCards.length === 0) return [];
    const repeatCount = 40;
    const repeated: typeof originalCards = [];
    for (let i = 0; i < repeatCount; i++) {
      repeated.push(...originalCards);
    }
    return repeated;
  }, [originalCards]);

  const startIndex = useMemo(() => {
    if (originalCards.length === 0) return 0;
    return Math.floor(cards.length / 2);
  }, [cards.length, originalCards.length]);

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isAnimating, setIsAnimating] = useState(false);
  const [cardStates, setCardStates] = useState<Map<number, { position: number; delay: number }>>(new Map());
  const mountedRef = useRef(true);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fadeStartIndex = 2;
  const threshold = 12;

  const getCardStyle = (position: number, delay: number, animate: boolean): React.CSSProperties => {
    const absPosition = Math.abs(position);
    let cumulativeTranslateX = 0;
    if (position !== 0) {
      const direction = position > 0 ? 1 : -1;
      for (let i = 1; i <= absPosition; i++) {
        const gapMultiplier = Math.max(0.3, 1 - (i - 1) * 0.15);
        cumulativeTranslateX += cardGap * gapMultiplier * direction;
      }
    }
    const scale = position === 0 ? 1 : Math.max(0.65, 1 - absPosition * 0.12);
    const opacity = absPosition <= fadeStartIndex ? Math.max(0, 1 - (absPosition - 1) * 0.3) : 0;
    const zIndex = 20 - absPosition;
    const easing = "cubic-bezier(0.34, 1.56, 0.64, 1)";

    return {
      position: "absolute",
      width: cardWidth,
      height: cardHeight,
      borderRadius: 20,
      boxShadow: position === 0
        ? "0 32px 64px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)"
        : "0 16px 40px -8px rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: `translateX(${cumulativeTranslateX}px) scale(${scale})`,
      opacity,
      zIndex,
      transition: animate
        ? `all ${animationDuration}ms ${easing} ${delay}ms`
        : "none",
      cursor: position === 0 ? "pointer" : "default",
      overflow: "hidden",
    };
  };

  const calculateCardStates = (newIndex: number, animate: boolean, prevIndex: number) => {
    const newStates = new Map<number, { position: number; delay: number }>();
    cards.forEach((_, index) => {
      const position = index - newIndex;
      const absPosition = Math.abs(position);
      if (absPosition > threshold + 5) return;
      let delay = 0;
      if (animate) {
        const direction = newIndex > prevIndex ? 1 : -1;
        if (direction > 0) {
          if (position < 0) delay = Math.max(0, (threshold - Math.abs(position)) * sequenceDelay);
          else if (position > 0) delay = (threshold + position) * sequenceDelay;
          else delay = threshold * sequenceDelay;
        } else {
          if (position > 0) delay = Math.max(0, (threshold - position) * sequenceDelay);
          else if (position < 0) delay = (threshold + Math.abs(position)) * sequenceDelay;
          else delay = threshold * sequenceDelay;
        }
      }
      newStates.set(index, { position, delay });
    });
    return newStates;
  };

  useEffect(() => {
    const initialStates = calculateCardStates(startIndex, false, startIndex);
    startTransition(() => {
      setCurrentIndex(startIndex);
      setCardStates(initialStates);
    });
  }, [startIndex]);

  const totalAnimationTime = threshold * sequenceDelay + animationDuration + 200;

  const advance = () => {
    if (isAnimating) return;
    startTransition(() => setIsAnimating(true));
    const newIndex = currentIndex + 1;
    const newStates = calculateCardStates(newIndex, true, currentIndex);
    startTransition(() => {
      setCurrentIndex(newIndex);
      setCardStates(newStates);
    });
    setTimeout(() => {
      if (!mountedRef.current) return;
      startTransition(() => setIsAnimating(false));
      if (newIndex >= startIndex + originalCards.length * 5) {
        const resetIndex = newIndex - originalCards.length * 5;
        const resetStates = calculateCardStates(resetIndex, false, resetIndex);
        startTransition(() => {
          setCurrentIndex(resetIndex);
          setCardStates(resetStates);
        });
      }
    }, totalAnimationTime);
  };

  const goBack = () => {
    if (isAnimating) return;
    startTransition(() => setIsAnimating(true));
    const newIndex = currentIndex - 1;
    const newStates = calculateCardStates(newIndex, true, currentIndex);
    startTransition(() => {
      setCurrentIndex(newIndex);
      setCardStates(newStates);
    });
    setTimeout(() => {
      if (!mountedRef.current) return;
      startTransition(() => setIsAnimating(false));
      if (newIndex <= startIndex - originalCards.length * 5) {
        const resetIndex = newIndex + originalCards.length * 5;
        const resetStates = calculateCardStates(resetIndex, false, resetIndex);
        startTransition(() => {
          setCurrentIndex(resetIndex);
          setCardStates(resetStates);
        });
      }
    }, totalAnimationTime);
  };

  // Auto advance
  useEffect(() => {
    if (!autoAdvance || items.length === 0) return;
    autoRef.current = setInterval(() => {
      advance();
    }, autoAdvanceInterval);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoAdvance, autoAdvanceInterval, currentIndex, isAnimating, items.length]);

  if (items.length === 0) return null;

  const currentItem = cards[currentIndex]?.item;

  return (
    <div className="relative w-full flex flex-col items-center" style={{ height: cardHeight + 80 }}>
      {/* Cards container */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{ height: cardHeight, overflow: "visible" }}
      >
        {cards.map((card, index) => {
          const state = cardStates.get(index);
          if (!state) return null;
          const { position, delay } = state;
          const absPosition = Math.abs(position);
          if (absPosition > threshold) return null;

          return (
            <div
              key={`${card.id}-${index}`}
              style={getCardStyle(position, delay, true)}
              onClick={() => position === 0 && onCardClick && onCardClick(card.item)}
            >
              {card.item.imageUrl ? (
                <img
                  src={card.item.imageUrl}
                  alt={card.item.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#8b0000] to-[#c0392b]">
                  <span className="text-6xl">🍕</span>
                </div>
              )}
              {/* Overlay gradient on center card */}
              {position === 0 && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-[20px] flex items-end p-4">
                  <p className="text-white font-bold text-sm leading-tight line-clamp-2">{card.item.name}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-6 mt-4">
        <button
          onClick={goBack}
          disabled={isAnimating}
          className="w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <button
          onClick={advance}
          disabled={isAnimating}
          className="w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all disabled:opacity-50"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      </div>
    </div>
  );
}
