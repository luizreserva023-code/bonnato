import { useState } from "react";
import { ShoppingBag, Flame, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PIZZA_FALLBACK = "/brand/pizza-hero.webp";

interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  imageUrl?: string | null;
  featured?: boolean | null;
  category?: { name: string } | null;
}

interface ShowcasePizzaCardProps {
  product: Product;
  onAdd: () => void;
  className?: string;
}

/**
 * ShowcasePizzaCard — replica o estilo do Framer "Showcase Card":
 *
 * • Card branco com bordas muito arredondadas (2xl/3xl)
 * • Imagem ocupa toda a área superior (aspect-[4/3])
 * • Gradiente escuro no rodapé da imagem
 * • Nome e categoria sobrepostos na imagem (canto inferior esquerdo)
 * • Badge "Top" no canto superior direito quando featured
 * • Área inferior branca com preço + botão Adicionar
 * • Seta chevron centralizada entre imagem e área inferior (indicador de expansão)
 * • Hover: leve scale-up + sombra vermelha
 */
export function ShowcasePizzaCard({ product, onAdd, className }: ShowcasePizzaCardProps) {
  const [imgError, setImgError] = useState(false);
  const categoryName = product.category?.name ?? "Pizza";

  return (
    <div
      className={cn(
        "group relative bg-white rounded-[28px] overflow-hidden",
        "shadow-[0_4px_24px_rgba(0,0,0,0.10)]",
        "hover:shadow-[0_8px_40px_rgba(220,38,38,0.22)]",
        "hover:-translate-y-1.5 transition-all duration-300 ease-out",
        "cursor-pointer",
        className
      )}
    >
      {/* ── Image area ── */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-[28px]">
        <img
          src={imgError ? PIZZA_FALLBACK : (product.imageUrl ?? PIZZA_FALLBACK)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          onError={() => setImgError(true)}
        />

        {/* Bottom gradient — text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Featured badge — top right */}
        {product.featured && (
          <div className="absolute top-3 right-3">
            <span className="bg-[#6E0D12] btn-bonatto text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
              <Flame className="w-2.5 h-2.5" />
              Top
            </span>
          </div>
        )}

        {/* Name + category — bottom left overlay */}
        <div className="absolute bottom-3 left-4">
          <p className="text-white font-black text-lg leading-tight drop-shadow-md">{product.name}</p>
          <p className="text-white/75 text-xs font-medium mt-0.5 drop-shadow-sm">{categoryName}</p>
        </div>
      </div>

      {/* ── Chevron divider ── */}
      <div className="flex items-center justify-center py-2 bg-white border-t border-gray-100">
        <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-[#7d0f14] transition-colors duration-200" />
      </div>

      {/* ── Bottom info area ── */}
      <div className="px-5 pb-5 pt-1 bg-white flex items-center justify-between gap-3">
        <div>
          <span className="text-2xl font-black text-[#6E0D12] leading-none">
            R$ {parseFloat(product.price).toFixed(2).replace(".", ",")}
          </span>
          {product.description && (
            <p className="text-gray-400 text-xs mt-1 line-clamp-1 max-w-[140px]">{product.description}</p>
          )}
        </div>

        <Button
          size="sm"
          className="gap-1.5 font-bold text-xs h-9 px-4 rounded-2xl bg-[#6E0D12] btn-bonatto hover:bg-[#5a0a0f] text-white shrink-0 shadow-md hover:shadow-[#f9d0d0]"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}
