import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { ShoppingCart, X, Zap, TrendingDown } from "lucide-react";
import { useState } from "react";

interface UpsellModalProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  cartProductIds: number[];
  cartTotal: number;
}

type Phase = "upsell" | "downsell" | "done";

export function UpsellModal({ open, onAccept, onDecline, cartProductIds, cartTotal }: UpsellModalProps) {
  const { addItem } = useCart();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("upsell");

  const { data: upsells, isLoading } = trpc.upsells.forCart.useQuery(
    { productIds: cartProductIds, cartTotal },
    { enabled: open }
  );

  const { data: products } = trpc.products.list.useQuery(
    { categoryId: undefined },
    { enabled: open }
  );

  if (!open) return null;

  const allUpsells = upsells ?? [];
  const upsellItems = allUpsells.filter((u) => u.type === "upsell");
  const downsellItems = allUpsells.filter((u) => u.type === "downsell");

  // No offers at all → proceed directly
  if (!isLoading && allUpsells.length === 0) {
    onAccept();
    return null;
  }

  // Determine which list we're showing
  const activeList = phase === "downsell" ? downsellItems : upsellItems;
  const current = activeList[currentIndex];

  // If current phase has no item → advance
  if (!isLoading && !current) {
    if (phase === "upsell" && downsellItems.length > 0) {
      // Will be handled by decline
    } else {
      onAccept();
      return null;
    }
  }

  if (!current) {
    onAccept();
    return null;
  }

  const suggestedProduct = products?.find((p) => p.id === current.suggestedProductId);
  const originalPrice = suggestedProduct ? parseFloat(suggestedProduct.price) : 0;
  const discountPct = current.discountPercent ?? 0;
  const discountedPrice = discountPct > 0 ? originalPrice * (1 - discountPct / 100) : originalPrice;
  const isUpsellPhase = phase === "upsell";

  const goNextInPhase = () => {
    if (currentIndex + 1 < activeList.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      onAccept();
    }
  };

  const handleAccept = () => {
    if (suggestedProduct) {
      addItem({
        productId: suggestedProduct.id,
        productName: suggestedProduct.name,
        productPrice: discountedPrice.toFixed(2),
        imageUrl: suggestedProduct.imageUrl ?? undefined,
        quantity: 1,
      });
    }
    goNextInPhase();
  };

  const handleDecline = () => {
    if (isUpsellPhase && downsellItems.length > 0) {
      // Transition to downsell phase: offer a cheaper/smaller alternative
      setPhase("downsell");
      setCurrentIndex(0);
    } else {
      goNextInPhase();
    }
  };

  const headerColor = isUpsellPhase ? "bg-primary" : "bg-orange-500";
  const headerIcon = isUpsellPhase ? <Zap className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />;
  const headerLabel = isUpsellPhase ? "Oferta Especial!" : "Espere! Temos uma oferta menor para você";

  return (
    <Dialog open={open} onOpenChange={() => handleDecline()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Colored header */}
        <div className={`p-5 text-white ${headerColor}`}>
          <div className="flex items-center gap-2 mb-1">
            {headerIcon}
            <span className="text-sm font-semibold uppercase tracking-wide">{headerLabel}</span>
          </div>
          <DialogTitle className="text-xl font-black text-white">{current.title}</DialogTitle>
        </div>

        {/* Body */}
        <div className="p-5">
          {suggestedProduct ? (
            <div className="flex gap-4 items-center mb-4">
              {suggestedProduct.imageUrl ? (
                <img
                  src={suggestedProduct.imageUrl}
                  alt={suggestedProduct.name}
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-bold text-base">{suggestedProduct.name}</p>
                {suggestedProduct.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{suggestedProduct.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {discountPct > 0 && (
                    <span className="text-sm text-muted-foreground line-through">
                      R$ {originalPrice.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  <span className="font-black text-lg text-primary">
                    R$ {discountedPrice.toFixed(2).replace(".", ",")}
                  </span>
                  {discountPct > 0 && (
                    <Badge className="bg-green-100 text-green-800 border-0 text-xs">
                      -{discountPct}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
              Carregando produto...
            </div>
          )}

          {current.description && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mb-4">{current.description}</p>
          )}

          {/* Phase indicator */}
          {phase === "downsell" && (
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 rounded-lg p-3 mb-4 text-sm">
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span>Recusou a oferta anterior? Que tal esta opção mais acessível?</span>
            </div>
          )}

          {/* Progress dots */}
          {activeList.length > 1 && (
            <div className="flex justify-center gap-1.5 mb-4">
              {activeList.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button className="w-full gap-2" onClick={handleAccept}>
              <ShoppingCart className="w-4 h-4" />
              {isUpsellPhase ? "Sim, quero adicionar!" : "Aceitar esta oferta"}
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleDecline}>
              <X className="w-4 h-4 mr-1" />
              {isUpsellPhase && downsellItems.length > 0 ? "Não, mas veja outra oferta" : "Não, obrigado"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
