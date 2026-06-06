import { useRef } from "react";

const PIZZA_PHOTOS = [
  { url: "/brand/pizza-1-margherita.jpg", label: "Margherita" },
  { url: "/brand/pizza-2-calabresa.jpg", label: "Calabresa" },
  { url: "/brand/pizza-3-portuguesa.jpg", label: "Portuguesa" },
  { url: "/brand/pizza-4-frango.jpg", label: "Frango" },
  { url: "/brand/pizza-5-mussarela.jpg", label: "Mussarela" },
  { url: "/brand/pizza-6-pepperoni.jpg", label: "Pepperoni" },
  { url: "/brand/pizza-7-quatro-queijos.webp", label: "Quatro Queijos" },
  { url: "/brand/pizza-8.jpg", label: "Quatro Queijos" },
  { url: "/brand/pizza-9.jpg", label: "Gourmet" },
  { url: "/brand/pizza-10.webp", label: "Napolitana" },
  { url: "/brand/pizza-11.jpg", label: "Especial" },
  { url: "/brand/pizza-12.jpg", label: "Pepperoni" },
  { url: "/brand/pizza-13.jpeg", label: "Forno a Lenha" },
  { url: "/brand/pizza-14.png", label: "Quatro Queijos" },
  { url: "/brand/pizza-15.jpg", label: "Frango Catupiry" },
  { url: "/brand/pizza-16.jpg", label: "Frango Catupiry" },
  { url: "/brand/pizza-17.jpg", label: "Calabresa" },
];

// Triplicate for seamless loop
const TRACK = [...PIZZA_PHOTOS, ...PIZZA_PHOTOS, ...PIZZA_PHOTOS];

const CARD_W = 200; // px
const GAP = 16;     // px
const SPEED = 35;   // seconds for full loop

export function InfinitePhotoCarousel() {
  const totalW = PIZZA_PHOTOS.length * (CARD_W + GAP);

  return (
    <section className="w-full bg-[#0d0d0d] py-10 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-8 px-4">
        <p className="text-xs font-bold tracking-[0.25em] text-[#7d0f14] uppercase mb-2">Galeria</p>
        <h2 className="text-2xl md:text-3xl font-black text-white">
          Feitas com <span className="text-[#7d0f14]">amor</span> e ingredientes frescos
        </h2>
      </div>

      {/* Track wrapper — fade edges */}
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        <div
          className="flex"
          style={{
            gap: GAP,
            animation: `scroll-left ${SPEED}s linear infinite`,
            width: "max-content",
          }}
        >
          {TRACK.map((photo, i) => (
            <div
              key={i}
              className="relative shrink-0 overflow-hidden rounded-xl bg-[#1a1a1a] group"
              style={{ width: CARD_W, height: CARD_W }}
            >
              <img
                src={photo.url}
                alt={photo.label}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/brand/pizza-1-margherita.jpg";
                }}
              />
              {/* Label on hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                <span className="text-white text-xs font-semibold tracking-wide">{photo.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scroll-left {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-${totalW}px); }
        }
      `}</style>
    </section>
  );
}
