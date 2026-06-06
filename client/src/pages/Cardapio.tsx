import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import {
  Minus, Plus, ShoppingCart, LogIn, Heart, ChevronRight,
  Star, Clock, MapPin, Tag, ChevronDown, Search, X,
  Menu, Bell, BellRing, Package, Trophy, Crown, Gift, Ticket, Receipt, CreditCard, User, ChefHat, ShoppingBag, LogOut
} from "lucide-react";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { ProductDetailModal, type ProductDetailProduct } from "@/components/ProductDetailModal";
import { isStoreOpenWithHours, nextOpenTimeWithHours, type DaySchedule } from "@/lib/storeUtils";
import { useStore } from "@/contexts/StoreContext";
import { BRAND_ASSETS, CATEGORY_MEDIA } from "@/lib/brand";

// ─── Assets ─────────────────────────────────────────────────────────────────
const LOGO_URL = BRAND_ASSETS.heroLogo;
const BANNER_URL = BRAND_ASSETS.navbarBg;
const PALMITO_URL = BRAND_ASSETS.palmitoMenu;

const PIZZA_IMGS: Record<string, string> = {
  pizzas: CATEGORY_MEDIA.pizzas,
  calzones: CATEGORY_MEDIA.calzones,
  lasanhas: CATEGORY_MEDIA.lasanhas,
  empanados: CATEGORY_MEDIA.empanados,
  sorvetes: CATEGORY_MEDIA.sorvetes,
  bebidas: CATEGORY_MEDIA.bebidas,
  extras: CATEGORY_MEDIA.extras,
  promocoes: CATEGORY_MEDIA.promocoes,
};

const CAT_ICONS: Record<string, string> = {
  pizzas: "🍕", calzones: "🥙", lasanhas: "🍝", empanados: "🍗",
  sorvetes: "🍦", bebidas: "🥤", extras: "🧂", promocoes: "🔥",
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

// ─── Cardapio Menu Drawer ────────────────────────────────────────────────────
function CardapioMenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const { data: unreadData } = trpc.chat.totalUnread.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 30000 });
  const unreadCount = (unreadData as any)?.count ?? 0;
  const { data: notifData } = trpc.notifications.unreadCount.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60000 });
  const notifCount = (notifData as number) ?? 0;
  const { data: orders } = trpc.orders.myOrders.useQuery(undefined as never, { enabled: isAuthenticated, refetchInterval: 30000 });
  const activeOrdersCount = (orders as any[])?.filter((o) => !["delivered", "cancelled"].includes(o.status)).length ?? 0;
  const navLinks = [
    { href: "/", label: "Início" },
    { href: "/cardapio", label: "Cardápio" },
    { href: "/minha-conta", label: "Minha Conta" },
  ];
  const accountCards = [
    { tab: "pedidos", icon: <Package className="w-6 h-6" />, label: "Pedidos", badge: activeOrdersCount > 0 ? activeOrdersCount : null, color: "text-primary", bg: "bg-primary/10" },
    { tab: "fidelidade", icon: <Trophy className="w-6 h-6" />, label: "Pontos", badge: null, color: "text-yellow-600", bg: "bg-yellow-50" },
    { tab: "clube", icon: <Crown className="w-6 h-6" />, label: "Clube", badge: null, color: "text-[#7d0f14]", bg: "bg-[#fdf2f2]" },
    { tab: "cupons", icon: <Tag className="w-6 h-6" />, label: "Cupons", badge: null, color: "text-green-600", bg: "bg-green-50" },
    { tab: "promocoes", icon: <Gift className="w-6 h-6" />, label: "Promoções", badge: null, color: "text-purple-600", bg: "bg-purple-50" },
    { tab: "sorteios", icon: <Ticket className="w-6 h-6" />, label: "Sorteios", badge: null, color: "text-blue-600", bg: "bg-blue-50" },
    { tab: "notificacoes", icon: notifCount > 0 ? <BellRing className="w-6 h-6" /> : <Bell className="w-6 h-6" />, label: "Avisos", badge: notifCount > 0 ? notifCount : null, color: "text-orange-500", bg: "bg-orange-50" },
    { tab: "enderecos", icon: <MapPin className="w-6 h-6" />, label: "Endereços", badge: null, color: "text-teal-600", bg: "bg-teal-50" },
    { tab: "pagamentos", icon: <Receipt className="w-6 h-6" />, label: "Pagamentos", badge: null, color: "text-indigo-600", bg: "bg-indigo-50" },
    { tab: "cartoes", icon: <CreditCard className="w-6 h-6" />, label: "Cartões", badge: null, color: "text-slate-600", bg: "bg-slate-100" },
    { tab: "perfil", icon: <User className="w-6 h-6" />, label: "Perfil", badge: null, color: "text-gray-600", bg: "bg-gray-100" },
  ];
  function goToTab(tab: string) {
    onClose();
    navigate("/minha-conta");
    setTimeout(() => { window.dispatchEvent(new CustomEvent("minhaconta:tab", { detail: tab })); }, 80);
  }
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[320px] sm:w-[380px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-black text-base shrink-0 overflow-hidden">
                  {(user as any)?.avatarUrl
                    ? <img src={(user as any).avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    : (user?.name ?? "U")[0].toUpperCase()
                  }
                </div>
                <div>
                  <SheetTitle className="text-sm font-bold leading-tight">{user?.name?.split(" ")[0] ?? "Olá!"}</SheetTitle>
                  <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
                </div>
              </>
            ) : (
              <SheetTitle className="text-base font-bold">Menu</SheetTitle>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-muted text-foreground">
                {link.href === "/" && <ShoppingBag className="w-4 h-4" />}
                {link.href === "/cardapio" && <ShoppingBag className="w-4 h-4" />}
                {link.href === "/minha-conta" && <User className="w-4 h-4" />}
                {link.label}
              </Link>
            ))}
            {(user as any)?.role === "admin" && (
              <Link href="/admin" onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-muted text-foreground">
                <ChefHat className="w-4 h-4" />
                Painel Admin
              </Link>
            )}
          </div>
          {isAuthenticated && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">Minha Conta</p>
              <div className="grid grid-cols-3 gap-2.5">
                {accountCards.map((card) => (
                  <button key={card.tab} type="button" onClick={() => goToTab(card.tab)}
                    className="relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-border bg-background hover:border-primary/40 hover:bg-muted/50 transition-all active:scale-95">
                    {card.badge !== null && (
                      <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">{card.badge}</span>
                    )}
                    <span className={`${card.color} ${card.bg} p-2 rounded-xl`}>{card.icon}</span>
                    <span className="text-[11px] font-semibold text-foreground leading-tight text-center">{card.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isAuthenticated && (
            <Link href="/login" onClick={onClose}>
              <Button className="w-full gap-2"><LogIn className="w-4 h-4" /> Entrar / Criar Conta</Button>
            </Link>
          )}
        </div>
        {isAuthenticated && (
          <div className="px-4 py-4 border-t">
            <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => { logout(); onClose(); }}>
              <LogOut className="w-4 h-4" /> Sair da conta
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Restaurant Header (iFood style) ─────────────────────────────────────────
function RestaurantHeader({
  storeSettings,
  isOpen,
  onSearchOpen,
  onMenuOpen,
}: {
  storeSettings: Record<string, string> | undefined;
  isOpen: boolean;
  onSearchOpen: () => void;
  onMenuOpen: () => void;
}) {
  const { itemCount, setIsOpen: openCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { data: orders } = trpc.orders.myOrders.useQuery(undefined as never, { enabled: isAuthenticated, refetchInterval: 30000 });
  const activeOrdersCount = (orders as any[])?.filter((o) => !["delivered", "cancelled"].includes(o.status)).length ?? 0;
  const { data: notifData } = trpc.notifications.unreadCount.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60000 });
  const notifCount = (notifData as number) ?? 0;
  const minOrder = storeSettings?.minOrderValue ? parseFloat(storeSettings.minOrderValue) : 0;
  const deliveryFee = storeSettings?.deliveryFee ? parseFloat(storeSettings.deliveryFee) : 0;

  return (
    <div className="relative">
      {/* Banner */}
      <div className="relative h-44 sm:h-56 overflow-hidden bg-gray-900">
        <img
          src={BANNER_URL}
          alt="Bonatto Pizza"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        {/* Overlay suave para dar profundidade */}
        <div className="absolute inset-0 bg-black/20" />
        {/* Tipografia centralizada */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={PALMITO_URL}
            alt="Palmito"
            className="w-[70%] max-w-xs sm:max-w-sm object-contain drop-shadow-lg"
            loading="eager"
          />
        </div>
        {/* Top bar: visível apenas no desktop (md+) */}
        <div className="hidden md:flex absolute top-3 left-3 right-3 items-center justify-between">
          {/* Carrinho */}
          <button onClick={() => openCart(true)}
            className="relative w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            aria-label="Carrinho">
            <ShoppingCart className="w-4 h-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </button>
          {/* Busca + Menu */}
          <div className="flex items-center gap-2">
            <button onClick={onSearchOpen}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              aria-label="Buscar">
              <Search className="w-4 h-4" />
            </button>
            <button onClick={onMenuOpen}
              className="relative w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              aria-label="Menu">
              <Menu className="w-4 h-4" />
              {isAuthenticated && (activeOrdersCount + notifCount) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {(activeOrdersCount + notifCount) > 9 ? "9+" : activeOrdersCount + notifCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-background rounded-t-2xl -mt-5 relative z-10 shadow-sm">
        {/* Logo + Name row */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-background shadow-lg shrink-0 -mt-10 bg-white">
            <img src={LOGO_URL} alt="Bonatto" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="font-black text-lg text-foreground leading-tight">BONATTO PIZZA</h1>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span>Pizzas artesanais</span>
              {minOrder > 0 && (
                <>
                  <span className="mx-1">•</span>
                  <span>Mín. {fmt(minOrder)}</span>
                </>
              )}
            </div>
          </div>
          <div className={`shrink-0 mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${isOpen ? "bg-green-100 text-green-700" : "bg-[#fce8e8] text-[#5a0a0f]"}`}>
            {isOpen ? "Aberto" : "Fechado"}
          </div>
        </div>

        {/* Rating + Delivery row */}
        <div className="border-t border-border mx-4" />
        <div className="flex items-center gap-4 px-4 py-3">
          <button className="flex items-center gap-1.5 text-sm">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-foreground">4.8</span>
            <span className="text-muted-foreground text-xs">(500+ avaliações)</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>

        {/* Delivery info row */}
        <div className="border-t border-border mx-4" />
        <div className="flex items-center gap-2 px-4 py-3">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">Padrão • 40-60 min</span>
          <span className="mx-1 text-muted-foreground">•</span>
          {deliveryFee === 0 ? (
            <span className="text-sm font-bold text-green-600">Grátis</span>
          ) : (
            <span className="text-sm text-muted-foreground">{fmt(deliveryFee)}</span>
          )}
          <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
        </div>
      </div>
    </div>
  );
}

// ─── Category Nav (sticky) ────────────────────────────────────────────────────
function CategoryNav({
  categories,
  loading,
  selected,
  onSelect,
}: {
  categories?: { id: number; name: string; slug: string }[];
  loading: boolean;
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  return (
    <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex gap-2 overflow-x-auto pb-2 pt-2 px-4 scrollbar-hide">
          <button
            onClick={() => onSelect(null)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selected === null ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            <span>🍽️</span><span>Todos</span>
          </button>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />)
            : categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selected === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                <span>{CAT_ICONS[cat.slug] ?? "🍽️"}</span><span>{cat.name}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Product Card (iFood style) ───────────────────────────────────────────────
function ProductCard({
  product, cartQty, imgUrl, onDetail, isFavorite, onToggleFavorite, onAdd, onUpdateQty, badge,
}: {
  product: { id: number; name: string; description: string | null; price: string; featured: boolean; originalPrice?: string | null };
  cartQty: number; imgUrl: string; onDetail: () => void;
  isFavorite?: boolean; onToggleFavorite?: () => void;
  onAdd: () => void; onUpdateQty: (q: number) => void;
  badge?: "Mais pedido" | "Destaque" | "Novo" | "Promoção";
}) {
  const price = parseFloat(product.price);
  const origPrice = product.originalPrice ? parseFloat(product.originalPrice) : null;
  const hasDiscount = origPrice !== null && origPrice > price;
  const inCart = cartQty > 0;

  const badgeColor: Record<string, string> = {
    "Mais pedido": "bg-orange-500 text-white",
    "Destaque": "bg-primary text-primary-foreground",
    "Novo": "bg-blue-500 text-white",
    "Promoção": "bg-green-600 text-white",
  };

  return (
    <div className="group bg-card rounded-2xl border border-border hover:border-primary/40 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative w-full aspect-[4/3] cursor-pointer overflow-hidden bg-muted" onClick={onDetail}>
        <img src={imgUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        {/* Badge */}
        {badge && (
          <div className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md shadow ${badgeColor[badge]}`}>
            {badge}
          </div>
        )}
        {hasDiscount && !badge && (
          <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
            Promoção
          </div>
        )}
        {/* Favorite */}
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-colors"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite ? "fill-[#fdf2f2]0 text-[#7d0f14]" : "text-white"}`} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="flex-1">
          <h3
            className="font-bold text-sm text-foreground leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
            onClick={onDetail}
          >
            {product.name}
          </h3>
          {product.description && (
            <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>
        <div className="flex items-end justify-between gap-2 mt-auto">
          <div className="flex flex-col">
            {hasDiscount && (
              <span className="text-muted-foreground text-xs line-through leading-none">{fmt(origPrice!)}</span>
            )}
            <span className="text-primary font-black text-base leading-tight">{fmt(price)}</span>
          </div>
          {inCart ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onUpdateQty(cartQty - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-sm font-bold text-primary">{cartQty}</span>
              <button onClick={() => onUpdateQty(cartQty + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Plus className="w-3 h-3" />Adicionar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Peça Novamente (horizontal scroll) ──────────────────────────────────────
type AnyProduct = {
  id: number;
  name: string;
  price: string;
  description: string | null;
  featured: boolean;
  categoryId: number;
  originalPrice?: string | null;
  [key: string]: unknown;
};

function PecaNovamente({
  orders,
  products,
  categories,
  items,
  onAdd,
  onUpdateQty,
  onDetail,
}: {
  orders: Array<{ id: number; items: Array<{ productId: number; productName: string; quantity: number }> }>;
  products: AnyProduct[];
  categories: Array<{ id: number; name: string; slug: string }>;
  items: Array<{ productId: number; quantity: number }>;
  onAdd: (product: AnyProduct) => void;
  onUpdateQty: (id: number, q: number) => void;
  onDetail: (product: AnyProduct, imgUrl: string, catSlug: string) => void;
}) {
  // Pegar os produtos dos últimos pedidos (sem repetir)
  const recentProductIds = useMemo(() => {
    const seen = new Set<number>();
    const ids: number[] = [];
    for (const order of orders.slice(0, 5)) {
      for (const item of order.items ?? []) {
        if (!seen.has(item.productId)) {
          seen.add(item.productId);
          ids.push(item.productId);
        }
      }
    }
    return ids.slice(0, 6);
  }, [orders]);

  const recentProducts = useMemo(
    () => recentProductIds.map(id => products.find(p => p.id === id)).filter(Boolean) as typeof products,
    [recentProductIds, products]
  );

  if (recentProducts.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-black text-foreground mb-3 px-4 sm:px-0">Peça novamente</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 px-4 sm:px-0 scrollbar-hide">
        {recentProducts.map((product) => {
          const cat = categories.find(c => c.id === product.categoryId);
          const slug = cat?.slug ?? "pizzas";
          const imgUrl = PIZZA_IMGS[slug] ?? PIZZA_IMGS["pizzas"];
          const cartQty = items.find(i => i.productId === product.id)?.quantity ?? 0;
          return (
            <div key={product.id} className="shrink-0 w-44 bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
              <div
                className="relative w-full h-28 cursor-pointer overflow-hidden bg-muted"
                onClick={() => onDetail(product, imgUrl, slug)}
              >
                <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-foreground line-clamp-2 leading-tight mb-1">{product.name}</p>
                <p className="text-primary font-black text-sm mb-2">{fmt(parseFloat(product.price))}</p>
                {cartQty > 0 ? (
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => onUpdateQty(product.id, cartQty - 1)} className="w-6 h-6 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold text-primary w-4 text-center">{cartQty}</span>
                    <button onClick={() => onUpdateQty(product.id, cartQty + 1)} className="w-6 h-6 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onAdd(product)}
                    className="w-full text-xs font-bold text-primary border border-primary rounded-full py-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Adicionar à sacola
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Search Overlay ───────────────────────────────────────────────────────────
function SearchOverlay({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Search className="w-5 h-5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar no cardápio..."
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base outline-none"
        />
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
      {value.trim() === "" && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Digite para buscar produtos
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Cardapio() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [bottomBarVisible, setBottomBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const { requireStore, stores } = useStore();

  // Ao entrar no cardápio com múltiplas lojas, abrir o modal de seleção se necessário
  useEffect(() => {
    if (stores.length > 1) requireStore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores.length]);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 60) {
        setBottomBarVisible(true);
      } else if (currentY > lastScrollY.current + 8) {
        // rolando para baixo
        setBottomBarVisible(false);
      } else if (currentY < lastScrollY.current - 8) {
        // rolando para cima
        setBottomBarVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { data: categories, isLoading: catsLoading } = trpc.categories.list.useQuery();
  const { data: products, isLoading: prodsLoading } = trpc.products.list.useQuery(
    selectedCategoryId !== null ? { categoryId: selectedCategoryId } : {}
  );
  const { data: storeSettings } = trpc.storeSettings.get.useQuery();
  const { addItem, setIsOpen, items, updateQuantity } = useCart();
  const { isAuthenticated } = useAuth();
  const { data: favoritesData } = trpc.favorites.list.useQuery(undefined, { enabled: isAuthenticated });
  const favoriteIds = new Set((favoritesData ?? []).map((f: { productId: number }) => f.productId));
  const toggleFavMutation = trpc.favorites.toggle.useMutation({ onSuccess: () => trpc.useUtils().favorites.list.invalidate() });
  // Últimos pedidos para "Peça novamente"
  const { data: myOrders } = trpc.orders.myOrders.useQuery(undefined as never, { enabled: isAuthenticated });
  // Horários dinâmicos do banco (com fallback para os padrão)
  const dbStoreHours = storeSettings?.storeHours
    ? (JSON.parse(storeSettings.storeHours as string) as Record<string, DaySchedule | null>)
    : undefined;
  const isOpen = isStoreOpenWithHours(dbStoreHours);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }, [products, search]);

  const totalCartItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = items.reduce((sum, i) => sum + parseFloat(String(i.productPrice)) * i.quantity, 0);

  const handleAdd = (product: (typeof filteredProducts)[0]) => {
    addItem({ productId: product.id, productName: product.name, productPrice: product.price, quantity: 1 });
  };

  const getCategoryImg = (slug: string) => PIZZA_IMGS[slug] ?? PIZZA_IMGS["pizzas"];

  const [detailProduct, setDetailProduct] = useState<ProductDetailProduct | null>(null);
  const [detailImg, setDetailImg] = useState("");
  const openDetail = (product: (typeof filteredProducts)[0], imgUrl: string, catSlug: string) => {
    setDetailProduct({ ...product, categorySlug: catSlug });
    setDetailImg(imgUrl);
  };

  const scrollToCategory = useCallback((id: number | null) => {
    setSelectedCategoryId(id);
    if (id === null) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setTimeout(() => {
      const el = document.getElementById(`cat-section-${id}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }, 50);
  }, []);

  // Determine badge for product
  const getProductBadge = (product: typeof filteredProducts[0], index: number): "Mais pedido" | "Destaque" | "Novo" | "Promoção" | undefined => {
    if (product.featured) return "Destaque";
    if (index === 0) return "Mais pedido";
    return undefined;
  };

  const renderGrid = (prods: typeof filteredProducts) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {prods.map((product, idx) => {
        const cat = categories?.find((c) => c.id === product.categoryId);
        const slug = cat?.slug ?? "pizzas";
        return (
          <ProductCard
            key={product.id}
            product={product}
            cartQty={items.find(i => i.productId === product.id)?.quantity ?? 0}
            onAdd={() => handleAdd(product)}
            onUpdateQty={(q) => updateQuantity(product.id, q)}
            imgUrl={getCategoryImg(slug)}
            onDetail={() => openDetail(product, getCategoryImg(slug), slug)}
            isFavorite={favoriteIds.has(product.id)}
            onToggleFavorite={isAuthenticated ? () => toggleFavMutation.mutate({ productId: product.id }) : undefined}
            badge={getProductBadge(product, idx)}
          />
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Search overlay */}
      <SearchOverlay
        open={searchOpen}
        value={search}
        onChange={setSearch}
        onClose={() => { setSearchOpen(false); setSearch(""); }}
      />

      {/* Login banner */}
      {!isAuthenticated && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="container py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-amber-800">
              <LogIn className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm font-medium">Crie sua conta para finalizar pedidos e acompanhar entregas!</span>
            </div>
            <Link href="/login?returnTo=/cardapio">
              <Button size="sm" className="gap-1.5 shrink-0 text-xs h-8"><LogIn className="w-3 h-3" /> Entrar</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Cardapio Menu Drawer */}
      <CardapioMenuDrawer open={menuDrawerOpen} onClose={() => setMenuDrawerOpen(false)} />

      {/* Restaurant Header */}
      <RestaurantHeader
        storeSettings={storeSettings as Record<string, string> | undefined}
        isOpen={isOpen}
        onSearchOpen={() => setSearchOpen(true)}
        onMenuOpen={() => setMenuDrawerOpen(true)}
      />

      {/* Closed store banner */}
      {!isOpen && (
        <div className="mx-4 mt-3 px-3 py-2 bg-[#fdf2f2] border border-[#f9d0d0] rounded-lg flex items-center gap-2 text-[#5a0a0f] text-xs font-medium">
          <span>🔒</span>
          <span>Loja fechada no momento. Você pode visualizar o cardápio mas não realizar pedidos.</span>
        </div>
      )}

      {/* Category Nav (sticky) */}
      {!search && (
        <CategoryNav
          categories={categories}
          loading={catsLoading}
          selected={selectedCategoryId}
          onSelect={scrollToCategory}
        />
      )}

      {/* Content */}
      <div className="container py-6">
        {/* Peça Novamente */}
        {isAuthenticated && myOrders && myOrders.length > 0 && products && categories && !search && selectedCategoryId === null && (
          <PecaNovamente
            orders={(myOrders as unknown) as Array<{ id: number; items: Array<{ productId: number; productName: string; quantity: number }> }>}
            products={products}
            categories={categories}
            items={items}
            onAdd={(p) => handleAdd(p as typeof filteredProducts[0])}
            onUpdateQty={updateQuantity}
            onDetail={(p, img, slug) => openDetail(p as typeof filteredProducts[0], img, slug)}
          />
        )}

        {/* Products */}
        {prodsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <div className="flex justify-between pt-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-7 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-xl font-medium">Nenhum produto encontrado</p>
            <p className="text-sm mt-2">Tente outra categoria ou termo de busca</p>
          </div>
        ) : search || selectedCategoryId !== null ? (
          renderGrid(filteredProducts)
        ) : (
          categories?.map((cat) => {
            const catProducts = filteredProducts.filter((p) => p.categoryId === cat.id);
            if (catProducts.length === 0) return null;
            return (
              <section key={cat.id} id={`cat-section-${cat.id}`} className="mb-12">
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-border">
                  <span className="text-2xl">{CAT_ICONS[cat.slug] ?? "🍽️"}</span>
                  <h2 className="text-lg font-black text-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>{cat.name}</h2>
                  <Badge variant="secondary" className="ml-auto text-xs">{catProducts.length} itens</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {catProducts.map((product, idx) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      cartQty={items.find(i => i.productId === product.id)?.quantity ?? 0}
                      onAdd={() => handleAdd(product)}
                      onUpdateQty={(q) => updateQuantity(product.id, q)}
                      imgUrl={getCategoryImg(cat.slug)}
                      onDetail={() => openDetail(product, getCategoryImg(cat.slug), cat.slug)}
                      isFavorite={favoriteIds.has(product.id)}
                      onToggleFavorite={isAuthenticated ? () => toggleFavMutation.mutate({ productId: product.id }) : undefined}
                      badge={getProductBadge(product, idx)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <ProductDetailModal product={detailProduct} open={!!detailProduct} onClose={() => setDetailProduct(null)} fallbackImg={detailImg} />

      {/* Mobile bottom navigation bar — visível apenas no mobile (some no desktop) */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-in-out ${bottomBarVisible ? "translate-y-0" : "translate-y-full"}`}>
        <div className="flex items-center justify-around px-2 py-2 pb-[env(safe-area-inset-bottom,8px)]">
          {/* Busca */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl text-muted-foreground hover:text-primary transition-colors"
            aria-label="Buscar"
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-medium">Buscar</span>
          </button>

          {/* Carrinho */}
          <button
            onClick={() => setIsOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl relative text-muted-foreground hover:text-primary transition-colors"
            aria-label="Carrinho"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              {totalCartItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {totalCartItems > 9 ? "9+" : totalCartItems}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Sacola</span>
          </button>

          {/* Menu */}
          <button
            onClick={() => setMenuDrawerOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl relative text-muted-foreground hover:text-primary transition-colors"
            aria-label="Menu"
          >
            <div className="relative">
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </div>
      </div>

      {/* Espaço para não sobrepor conteúdo com a barra inferior no mobile */}
      <div className="md:hidden h-16" />

      {/* Floating cart button — apenas no desktop (mobile usa barra inferior) */}
      {totalCartItems > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50 items-center gap-3 px-5 py-3 rounded-full font-semibold text-sm active:scale-95 transition-transform shadow-2xl"
          style={{ background: "linear-gradient(135deg, #c0392b 0%, #8b0000 100%)", boxShadow: "0 4px 32px rgba(192,57,43,0.55)", color: "#fff" }}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            <span className="absolute -top-1.5 -right-1.5 bg-white text-[#5a0a0f] text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">{totalCartItems}</span>
          </div>
          <span>Ver sacola</span>
          <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
          <ChevronRight className="w-4 h-4 opacity-70" />
        </button>
      )}
    </div>
  );
}
