import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import {
  formatFlavorSelection,
  getPizzaFlavorConfig,
  PIZZA_SIZE_KEYS,
} from "@/lib/pizza-flavor-config";
import { trpc } from "@/lib/trpc";
import { Clock, Flame, Minus, Plus, ShoppingCart, Star, X } from "lucide-react";
import { toast } from "sonner";

const SIZES: Record<string, { label: string; multiplier: number }[]> = {
  pizzas: [
    { label: "Pequena (4 fatias)", multiplier: 0.7 },
    { label: "Media (6 fatias)", multiplier: 1.0 },
    { label: "Grande (8 fatias)", multiplier: 1.3 },
    { label: "Familia (12 fatias)", multiplier: 1.6 },
  ],
  calzones: [
    { label: "Individual", multiplier: 1.0 },
    { label: "Duplo", multiplier: 1.8 },
  ],
};

const EXTRAS = [
  { id: 1, name: "Borda recheada (catupiry)", price: 5.0 },
  { id: 2, name: "Borda recheada (cheddar)", price: 5.0 },
  { id: 3, name: "Borda de chocolate", price: 6.0 },
  { id: 4, name: "Queijo extra", price: 4.0 },
  { id: 5, name: "Molho extra", price: 2.0 },
  { id: 6, name: "Azeitona extra", price: 2.0 },
];

type FlavorCandidate = {
  id: number;
  name: string;
  price: string;
};

export type ProductDetailProduct = {
  id: number;
  categoryId: number;
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
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState<number[]>([]);
  const [selectedFlavorIds, setSelectedFlavorIds] = useState<number[]>([]);
  const [notes, setNotes] = useState("");

  const storeSettingsQuery = trpc.storeSettings.get.useQuery();
  const flavorProductsQuery = trpc.products.list.useQuery(
    product?.categoryId ? { categoryId: product.categoryId } : undefined,
    { enabled: open && !!product && (product.categorySlug ?? "pizzas") === "pizzas" },
  );

  const pizzaFlavorConfig = useMemo(
    () => getPizzaFlavorConfig(storeSettingsQuery.data?.pizzaFlavorConfig),
    [storeSettingsQuery.data?.pizzaFlavorConfig],
  );

  useEffect(() => {
    if (!product || !open) return;
    setQty(1);
    setSelectedSizeIdx(1);
    setSelectedExtras([]);
    setSelectedFlavorIds([product.id]);
    setNotes("");
  }, [open, product]);

  if (!product) return null;

  const catSlug = product.categorySlug ?? "pizzas";
  const isPizza = catSlug === "pizzas";
  const multiFlavorEnabled = isPizza && pizzaFlavorConfig.enabled;
  const sizes = SIZES[catSlug] ?? null;
  const sizeKey = PIZZA_SIZE_KEYS[selectedSizeIdx] ?? "medium";
  const maxFlavors = multiFlavorEnabled ? pizzaFlavorConfig.maxFlavorsBySize[sizeKey] ?? 1 : 1;
  const flavorCandidates: FlavorCandidate[] = (flavorProductsQuery.data?.length ? flavorProductsQuery.data : [product]).map((item: ProductDetailProduct) => ({
    id: item.id,
    name: item.name,
    price: item.price,
  }));
  const selectedFlavorProducts = (selectedFlavorIds.length > 0 ? selectedFlavorIds : [product.id])
    .map((flavorId) => flavorCandidates.find((candidate: FlavorCandidate) => candidate.id === flavorId))
    .filter(Boolean) as FlavorCandidate[];
  const basePrice = multiFlavorEnabled && selectedFlavorProducts.length > 0
    ? Math.max(...selectedFlavorProducts.map((item) => parseFloat(item.price)))
    : parseFloat(product.price);
  const sizeMultiplier = sizes ? sizes[selectedSizeIdx].multiplier : 1;
  const extrasTotal = selectedExtras.reduce((sum, id) => {
    const extra = EXTRAS.find((entry) => entry.id === id);
    return sum + (extra?.price ?? 0);
  }, 0);
  const unitPrice = basePrice * sizeMultiplier + extrasTotal;
  const totalPrice = unitPrice * qty;
  const flavorSelectionLabel = formatFlavorSelection(selectedFlavorProducts.map((item) => item.name));
  const canSubmit = !multiFlavorEnabled || selectedFlavorProducts.length > 0;

  const formatPrice = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  const toggleExtra = (id: number) => {
    setSelectedExtras((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const toggleFlavor = (flavorId: number) => {
    setSelectedFlavorIds((prev) => {
      if (prev.includes(flavorId)) {
        if (prev.length === 1) return prev;
        return prev.filter((entry) => entry !== flavorId);
      }

      if (prev.length >= maxFlavors) return prev;
      return [...prev, flavorId];
    });
  };

  const handleAdd = () => {
    if (!canSubmit) return;

    const sizeLabel = sizes ? ` (${sizes[selectedSizeIdx].label})` : "";
    const flavorLabel = multiFlavorEnabled && flavorSelectionLabel ? ` - ${flavorSelectionLabel}` : "";
    const extrasLabel = selectedExtras.length
      ? ` + ${selectedExtras.map((id) => EXTRAS.find((entry) => entry.id === id)?.name).join(", ")}`
      : "";
    const mergedNotes = [
      multiFlavorEnabled && flavorSelectionLabel ? `Sabores: ${flavorSelectionLabel}` : "",
      notes.trim(),
    ].filter(Boolean).join(" | ");

    addItem({
      productId: selectedFlavorProducts[0]?.id ?? product.id,
      productName: `${multiFlavorEnabled ? "Pizza" : product.name}${sizeLabel}${flavorLabel}${extrasLabel}`,
      productPrice: unitPrice.toFixed(2),
      quantity: qty,
      notes: mergedNotes || undefined,
      configKey: multiFlavorEnabled
        ? `${sizeKey}:${selectedFlavorIds.slice().sort((a, b) => a - b).join("-")}:${selectedExtras.slice().sort((a, b) => a - b).join("-")}`
        : undefined,
    });

    toast.success(`${product.name} adicionado ao carrinho!`, {
      action: { label: "Ver carrinho", onClick: () => setCartOpen(true) },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg w-full gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Modal com detalhes do produto, selecao de tamanho, sabores, adicionais e observacoes.
        </DialogDescription>

        <div className="relative h-52 overflow-hidden bg-muted sm:h-64">
          <img
            src={product.imageUrl ?? fallbackImg}
            alt={product.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-3 flex gap-2">
            {product.featured && (
              <Badge className="gap-1 bg-primary text-xs text-primary-foreground">
                <Flame className="h-3 w-3" /> Destaque
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1 border-0 bg-black/50 text-xs text-white">
              <Clock className="h-3 w-3" /> 40-50 min
            </Badge>
            <Badge variant="secondary" className="gap-1 border-0 bg-black/50 text-xs text-white">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> 4.8
            </Badge>
          </div>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          <div>
            <h2 className="text-xl font-black text-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {product.name}
            </h2>
            {product.description && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            )}
          </div>

          {sizes && (
            <div>
              <p className="mb-2 text-sm font-bold text-foreground">Escolha o tamanho</p>
              <div className="grid grid-cols-2 gap-2">
                {sizes.map((size, idx) => (
                  <button
                    key={size.label}
                    type="button"
                    onClick={() => setSelectedSizeIdx(idx)}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      selectedSizeIdx === idx
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-xs font-semibold text-foreground">{size.label}</p>
                    <p className="mt-0.5 text-xs font-bold text-primary">
                      {formatPrice(basePrice * size.multiplier)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {multiFlavorEnabled && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">Escolha os sabores</p>
                <span className="text-xs text-muted-foreground">
                  Ate {maxFlavors} {maxFlavors === 1 ? "sabor" : "sabores"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {flavorCandidates.map((flavor: FlavorCandidate) => {
                  const selected = selectedFlavorIds.includes(flavor.id);
                  const disabled = !selected && selectedFlavorIds.length >= maxFlavors;
                  return (
                    <button
                      key={flavor.id}
                      type="button"
                      onClick={() => toggleFlavor(flavor.id)}
                      disabled={disabled}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{flavor.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Base no calculo: {formatPrice(parseFloat(flavor.price))}
                          </p>
                        </div>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            selected ? "border-primary bg-primary text-white" : "border-muted-foreground"
                          }`}
                        >
                          {selected ? "✓" : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                O valor final usa o sabor mais caro entre os selecionados neste tamanho.
              </p>
            </div>
          )}

          {(catSlug === "pizzas" || catSlug === "calzones") && (
            <div>
              <p className="mb-2 text-sm font-bold text-foreground">Adicionais (opcional)</p>
              <div className="space-y-1.5">
                {EXTRAS.map((extra) => (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => toggleExtra(extra.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all ${
                      selectedExtras.includes(extra.id)
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
                          selectedExtras.includes(extra.id)
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {selectedExtras.includes(extra.id) && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-foreground">{extra.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary">+{formatPrice(extra.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-bold text-foreground">Observacoes (opcional)</p>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex: sem cebola, bem passado, molho a parte..."
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-background p-4">
          <div className="flex items-center gap-2 rounded-xl border border-border p-1">
            <button
              onClick={() => setQty((current) => Math.max(1, current - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-bold">{qty}</span>
            <button
              onClick={() => setQty((current) => current + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            onClick={handleAdd}
            className="h-11 flex-1 gap-2 text-sm font-bold"
            disabled={!canSubmit}
          >
            <ShoppingCart className="h-4 w-4" />
            Adicionar · {formatPrice(totalPrice)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
