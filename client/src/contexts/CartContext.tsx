import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface CartItem {
  lineId?: string;
  productId: number;
  productName: string;
  productPrice: string;
  quantity: number;
  notes?: string;
  imageUrl?: string;
  configKey?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (lineIdOrProductId: string | number) => void;
  updateQuantity: (lineIdOrProductId: string | number, quantity: number) => void;
  updateNotes: (lineIdOrProductId: string | number, notes: string) => void;
  clearCart: () => void;
  /** Substitui todo o carrinho pelos itens fornecidos (restaurar carrinho abandonado) */
  replaceCart: (items: CartItem[]) => void;
  itemCount: number;
  subtotal: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

function createLineId(item: Pick<CartItem, "productId" | "configKey">) {
  return `${item.productId}-${item.configKey ?? "default"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveItemIdentity(item: CartItem) {
  return item.lineId ?? item.productId;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("bonatto_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("bonatto_cart", JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === item.productId && (i.configKey ?? "") === (item.configKey ?? ""),
      );
      if (existing) {
        return prev.map((i) =>
          resolveItemIdentity(i) === resolveItemIdentity(existing)
            ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
            : i
        );
      }
      return [...prev, { ...item, lineId: item.lineId ?? createLineId(item), quantity: item.quantity ?? 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((lineIdOrProductId: string | number) => {
    setItems((prev) => prev.filter((i) => resolveItemIdentity(i) !== lineIdOrProductId));
  }, []);

  const updateQuantity = useCallback((lineIdOrProductId: string | number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => resolveItemIdentity(i) !== lineIdOrProductId));
    } else {
      setItems((prev) =>
        prev.map((i) => (resolveItemIdentity(i) === lineIdOrProductId ? { ...i, quantity } : i))
      );
    }
  }, []);

  const updateNotes = useCallback((lineIdOrProductId: string | number, notes: string) => {
    setItems((prev) =>
      prev.map((i) => (resolveItemIdentity(i) === lineIdOrProductId ? { ...i, notes } : i))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const replaceCart = useCallback((newItems: CartItem[]) => {
    setItems(
      newItems.map((item) => ({
        ...item,
        lineId: item.lineId ?? createLineId(item),
      })),
    );
  }, []);

  // Listen for cart:addItem custom events (used by Checkout upsell/downsell)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) addItem(detail);
    };
    window.addEventListener("cart:addItem", handler);
    return () => window.removeEventListener("cart:addItem", handler);
  }, [addItem]);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + parseFloat(i.productPrice) * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, updateNotes, clearCart, replaceCart, itemCount, subtotal, isOpen, setIsOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
