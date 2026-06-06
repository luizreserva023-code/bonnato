import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { Minus, Plus, ShoppingCart, X, Star, Clock, Flame } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Tamanhos disponíveis por categoria
const SIZES: Record<string, { label: string; multiplier: number }[]> = {
  pizzas: [
    { label: "Pequena (4 fatias)", multiplier: 0.7 },
    { label: "Média (6 fatias)", multiplier: 1.0 },
    { label: "Grande (8 fatias)", multiplier: 1.3 },
    { label: "Família (12 fatias)", multiplier: 1.6 },
  ],
  calzones: [
    { label: "Individual", multiplier: 1.0 },
    { label: "Duplo", multiplier: 1.8 },
  ],
};

// Adicionais disponíveis
const EXTRAS = [
  { id: 1, name: "Borda recheada (catupiry)", price: 5.0 },
  { id: 2, name: "Borda recheada (cheddar)", price: 5.0 },
  { id: 3, name: "Borda de chocolate", price: 6.0 },
  { id: 4, name: "Queijo extra", price: 4.0 },
  { id: 5, name: "Molho extra", price: 2.0 },
  { id: 6, name: "Azeitona extra", price: 2.0 },
];

export type ProductDetailProduct = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  featured: boolean;
  categorySlug?: string;
  imageUrl?: string | null;
};

interface ProductDetailModalProps {
  product: ProductDetailProduct | null;
  open: boolean;
  onClose: () => void;
  fallbackImg: string;
}

export function ProductDetailModal({ product, open, onClose, fallbackImg }: ProductDetailModalProps) {
  const { addItem, setIsOpen: setCartOpen } = useCart();
  const [qty, setQty] = useState(1);
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(1); // default: Média
  const [selectedExtras, setSelectedExtras] = useState<number[]>([]);
  const [notes, setNotes] = useState("");

  if (!product) return null;

  const catSlug = product.categorySlug ?? "pizzas";
  const sizes = SIZES[catSlug] ?? null;
  const basePrice = parseFloat(product.price);
  const sizeMultiplier = sizes ? sizes[selectedSizeIdx].multiplier : 1;
  const extrasTotal = selectedExtras.reduce((sum, id) => {
    const extra = EXTRAS.find((e) => e.id === id);
    return sum + (extra?.price ?? 0);
  }, 0);
  const unitPrice = basePrice * sizeMultiplier + extrasTotal;
  const totalPrice = unitPrice * qty;

  const formatPrice = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const toggleExtra = (id: number) => {
    setSelectedExtras((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    const sizeLabel = sizes ? ` (${sizes[selectedSizeIdx].label})` : "";
    const extrasLabel = selectedExtras.length
      ? ` + ${selectedExtras.map((id) => EXTRAS.find((e) => e.id === id)?.name).join(", ")}`
      : "";
    addItem({
      productId: product.id,
      productName: `${product.name}${sizeLabel}${extrasLabel}`,
      productPrice: unitPrice.toFixed(2),
      quantity: qty,
      notes: notes.trim() || undefined,
    });
    toast.success(`${product.name} adicionado ao carrinho!`, {
      action: { label: "Ver carrinho", onClick: () => setCartOpen(true) },
    });
    // reset
    setQty(1);
    setSelectedSizeIdx(1);
    setSelectedExtras([]);
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-lg w-full rounded-2xl gap-0 border-0 shadow-2xl">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        {/* Image header */}
        <div className="relative h-52 sm:h-64 bg-muted overflow-hidden">
          <img
            src={product.imageUrl ?? fallbackImg}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Badges */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {product.featured && (
              <Badge className="bg-primary text-primary-foreground gap-1 text-xs">
                <Flame className="w-3 h-3" /> Destaque
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1 text-xs bg-black/50 text-white border-0">
              <Clock className="w-3 h-3" /> 40-50 min
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs bg-black/50 text-white border-0">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> 4.8
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Name + description */}
          <div>
            <h2 className="text-xl font-black text-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {product.name}
            </h2>
            {product.description && (
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          {/* Sizes */}
          {sizes && (
            <div>
              <p className="text-sm font-bold text-foreground mb-2">Escolha o tamanho</p>
              <div className="grid grid-cols-2 gap-2">
                {sizes.map((size, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSizeIdx(idx)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedSizeIdx === idx
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-xs font-semibold text-foreground">{size.label}</p>
                    <p className="text-xs text-primary font-bold mt-0.5">
                      {formatPrice(basePrice * size.multiplier)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extras (only for pizzas/calzones) */}
          {(catSlug === "pizzas" || catSlug === "calzones") && (
            <div>
              <p className="text-sm font-bold text-foreground mb-2">Adicionais (opcional)</p>
              <div className="space-y-1.5">
                {EXTRAS.map((extra) => (
                  <button
                    key={extra.id}
                    onClick={() => toggleExtra(extra.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      selectedExtras.includes(extra.id)
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedExtras.includes(extra.id)
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}>
                        {selectedExtras.includes(extra.id) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-foreground">{extra.name}</span>
                    </div>
                    <span className="text-sm text-primary font-semibold">+{formatPrice(extra.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          <div>
            <p className="text-sm font-bold text-foreground mb-2">Observações (opcional)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola, bem passado, molho à parte..."
              rows={2}
              className="w-full text-sm border border-border rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Footer — quantity + add */}
        <div className="p-4 border-t border-border bg-background flex items-center gap-3">
          {/* Qty stepper */}
          <div className="flex items-center gap-2 border border-border rounded-xl p-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center font-bold text-sm">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add button */}
          <Button
            onClick={handleAdd}
            className="flex-1 h-11 font-bold text-sm gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Adicionar · {formatPrice(totalPrice)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
