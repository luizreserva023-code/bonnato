import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Clock, Minus, MessageSquare, Plus, ShoppingCart, Trash2, LogIn, X } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, updateNotes, itemCount, subtotal } = useCart();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});



  const handleCheckout = () => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsOpen(false);
      toast.info("Faça login para finalizar seu pedido 🍕", { duration: 3000 });
      setTimeout(() => {
        navigate("/login?returnTo=/checkout");
      }, 800);
      return;
    }

    setIsOpen(false);
    navigate("/checkout");
  };

  const toggleNotes = (productId: number) => {
    setExpandedNotes((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Seu Pedido
            {itemCount > 0 && (
              <span className="ml-auto bg-primary text-primary-foreground text-sm rounded-full w-6 h-6 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground p-8">
            <ShoppingCart className="w-16 h-16 opacity-20" />
            <p className="text-lg font-medium">Seu carrinho está vazio</p>
            <p className="text-sm text-center">Adicione itens do cardápio para começar seu pedido</p>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Ver Cardápio
            </Button>
          </div>
        ) : (
          <>
            {/* Estimativa de entrega */}
            <div className="px-6 py-2.5 bg-green-50 border-b border-green-100 flex items-center gap-2 text-sm text-green-700">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Entrega estimada: <strong>40–50 minutos</strong></span>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight">{item.productName}</p>
                      <p className="text-primary font-semibold text-sm mt-0.5">
                        R$ {(parseFloat(item.productPrice) * item.quantity).toFixed(2).replace(".", ",")}
                      </p>
                      <button
                        onClick={() => toggleNotes(item.productId)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        {expandedNotes[item.productId] ? "Ocultar obs." : item.notes ? "Ver obs." : "Adicionar obs."}
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Observação inline expansível */}
                  {expandedNotes[item.productId] && (
                    <div className="relative">
                      <textarea
                        value={item.notes ?? ""}
                        onChange={(e) => updateNotes(item.productId, e.target.value)}
                        placeholder="Ex: sem cebola, massa fina, borda recheada..."
                        rows={2}
                        className="w-full text-xs border rounded-lg px-3 py-2 resize-none bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                      />
                      {item.notes && (
                        <button
                          onClick={() => updateNotes(item.productId, "")}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t px-6 py-4 space-y-3 bg-background">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal ({itemCount} {itemCount === 1 ? "item" : "itens"})</span>
                <span className="font-semibold">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Taxa de entrega</span>
                <span className="text-green-600 font-medium">Grátis 🎉</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-lg font-black">
                <span>Total</span>
                <span className="text-primary">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>

              {!authLoading && !isAuthenticated && (
                <p className="text-xs text-muted-foreground text-center">
                  <LogIn className="w-3 h-3 inline mr-1" />
                  Você precisará fazer login para finalizar o pedido
                </p>
              )}

              <Button
                onClick={handleCheckout}
                className="w-full h-12 text-base font-semibold gap-2"
                size="lg"
                disabled={authLoading}
              >
                {!authLoading && !isAuthenticated ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    Entrar e Finalizar Pedido
                  </>
                ) : (
                  "Finalizar Pedido →"
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
