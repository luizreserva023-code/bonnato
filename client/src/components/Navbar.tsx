import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useStore } from "@/contexts/StoreContext";
import { isStoreOpenWithHours, type DaySchedule } from "@/lib/storeUtils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTenantConfig } from "@/shared/tenant/use-tenant-config";
import type { inferRouterOutputs } from "@trpc/server";
import { motion } from "framer-motion";
import {
  Bell,
  BellRing,
  ChefHat,
  Clock3,
  CreditCard,
  Crown,
  Gift,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Ticket,
  Trophy,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BRAND_ASSETS } from "@/lib/brand";
import type { AppRouter } from "../../../server/routers";

const LOGO_TIPOGRAFICA_URL = BRAND_ASSETS.palmitoWordmark;
const NAVBAR_PALMITO_URL = BRAND_ASSETS.palmito;
type RouterOutputs = inferRouterOutputs<AppRouter>;
type CustomerOrderRecord = RouterOutputs["orders"]["myOrders"][number];

export function Navbar() {
  const { itemCount, setIsOpen } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { selectedStore, setShowCityModal } = useStore();
  const tenant = useTenantConfig(selectedStore?.slug);

  const { data: unreadData } = trpc.chat.totalUnread.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const { data: notifData } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const notifCount = notifData ?? 0;

  const { data: alertsUnread } = trpc.clientAlerts.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const alertsCount = alertsUnread ?? 0;

  const { data: orders } = trpc.orders.myOrders.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const customerOrders: CustomerOrderRecord[] = orders ?? [];
  const activeOrdersCount = customerOrders.filter((order: CustomerOrderRecord) => !["delivered", "cancelled"].includes(order.status)).length;

  const navLinks = [
    { href: "/", label: "Início", icon: ShoppingBag },
    { href: "/cardapio", label: "Cardápio", icon: ShoppingBag },
    { href: "/clube", label: "Clube", icon: Crown },
    { href: "/minha-conta", label: "Minha Conta", icon: User },
  ];

  const { data: storeSettings } = trpc.storeSettings.get.useQuery();
  const dbStoreHours = storeSettings?.storeHours
    ? (JSON.parse(storeSettings.storeHours as string) as Record<string, DaySchedule | null>)
    : undefined;
  const storeOpen = isStoreOpenWithHours(dbStoreHours);
  const totalAlerts = notifCount + unreadCount + alertsCount + activeOrdersCount;
  const brandName = tenant.brand.name;
  const brandTagline = tenant.brand.tagline;
  const locationLabel = selectedStore ? `Entrega em ${selectedStore.city}` : tenant.brand.deliveryLabel;
  const navIcon = tenant.brand.logos.icon || NAVBAR_PALMITO_URL;
  const navWordmark = tenant.brand.logos.wordmark || LOGO_TIPOGRAFICA_URL;

  const accountCards = [
    { tab: "pedidos", icon: <Package className="h-5 w-5" />, label: "Pedidos", badge: activeOrdersCount > 0 ? activeOrdersCount : null },
    { tab: "fidelidade", icon: <Trophy className="h-5 w-5" />, label: "Pontos", badge: null },
    { tab: "clube", icon: <Crown className="h-5 w-5" />, label: "Clube", badge: null },
    { tab: "cupons", icon: <Tag className="h-5 w-5" />, label: "Cupons", badge: null },
    { tab: "promocoes", icon: <Gift className="h-5 w-5" />, label: "Promoções", badge: null },
    { tab: "sorteios", icon: <Ticket className="h-5 w-5" />, label: "Sorteios", badge: null },
    { tab: "notificacoes", icon: notifCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />, label: "Avisos", badge: notifCount > 0 ? notifCount : null },
    { tab: "enderecos", icon: <MapPin className="h-5 w-5" />, label: "Endereços", badge: null },
    { tab: "pagamentos", icon: <Receipt className="h-5 w-5" />, label: "Pagamentos", badge: null },
    { tab: "cartoes", icon: <CreditCard className="h-5 w-5" />, label: "Cartões", badge: null },
    { tab: "perfil", icon: <User className="h-5 w-5" />, label: "Perfil", badge: null },
  ];

  function goToTab(tab: string) {
    setDrawerOpen(false);
    navigate("/minha-conta");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("minhaconta:tab", { detail: tab }));
    }, 80);
  }

  return (
    <>
      <motion.div
        className="fixed left-1/2 z-50 w-[94%] max-w-[820px] -translate-x-1/2"
        style={{ top: "14px" }}
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <nav
          className="relative overflow-hidden rounded-[26px] border border-white/12 bg-[linear-gradient(135deg,rgba(38,5,8,0.92),rgba(110,13,18,0.88)_48%,rgba(53,7,10,0.96))] shadow-[0_18px_60px_rgba(20,0,3,0.34)] backdrop-blur-2xl"
        >
          <motion.div
            className="absolute -left-10 top-[-42px] h-32 w-32 rounded-full bg-[#ff9f9f]/15 blur-3xl"
            animate={{ x: [0, 36, 0], y: [0, 16, 0] }}
            transition={{ duration: 9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-[-30px] top-2 h-24 w-24 rounded-full bg-white/10 blur-2xl"
            animate={{ x: [0, -18, 0], y: [0, 12, 0] }}
            transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />

          <div className="relative flex h-[72px] items-center justify-between px-3 sm:px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2.5">
              <motion.div whileHover={{ rotate: -6, scale: 1.04 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
                <img
                  src={navIcon}
                  alt={brandName}
                  className="h-12 w-auto object-contain sm:h-14"
                  style={{ maxWidth: "56px" }}
                />
              </motion.div>
              <div className="min-w-0">
                <img
                  src={navWordmark}
                  alt={brandName}
                  className="h-8 w-auto object-contain sm:h-10"
                  style={{ maxWidth: "172px" }}
                />
                <div className="hidden items-center gap-2 text-[11px] font-medium text-white/65 sm:flex">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-1">
                    <Clock3 className="h-3 w-3" />
                    {storeOpen ? "Cozinha aberta" : "Loja fechada"}
                  </span>
                </div>
              </div>
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <motion.button
                type="button"
                onClick={() => setShowCityModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/14"
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <MapPin className="h-3.5 w-3.5" />
                {locationLabel}
              </motion.button>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={() => setIsOpen(true)}
                className="relative rounded-2xl border border-white/10 bg-white/10 p-2.5 text-white transition hover:bg-white/16"
                aria-label="Carrinho"
                whileHover={{ y: -1.5, scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#6E0D12]">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="relative inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/12 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/16"
                aria-label="Abrir menu"
                whileHover={{ y: -1.5, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <Menu className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">Menu</span>
                {totalAlerts > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ffd7a8] px-1.5 text-[10px] font-black text-[#431007]">
                    {totalAlerts > 9 ? "9+" : totalAlerts}
                  </span>
                )}
              </motion.button>
            </div>
          </div>
        </nav>
      </motion.div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-[92vw] max-w-[430px] overflow-hidden rounded-l-[28px] border-l border-[#f0d6d4] p-0"
        >
          <div className="relative flex h-full flex-col bg-[radial-gradient(circle_at_top,_rgba(255,249,248,0.98),_rgba(255,241,239,0.94)_42%,_rgba(255,248,247,0.98)_100%)]">
            <div className="relative overflow-hidden border-b border-[#f1d9d8] px-5 pb-5 pt-6">
              <div className="absolute inset-x-8 top-0 h-16 rounded-full bg-[#a3131b]/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-[22px] bg-[linear-gradient(160deg,#9b1520_0%,#6E0D12_60%,#4a080c_100%)] p-2.5 shadow-[0_18px_40px_rgba(110,13,18,0.2)]">
                    <img src={navIcon} alt={brandName} className="h-9 w-9 object-contain" />
                  </div>
                  <div>
                    <SheetTitle className="text-base font-black text-[#2f090d]">{brandName}</SheetTitle>
                    <p className="mt-1 text-xs text-[#7e4d51]">
                      Menu premium, delivery e experiência de app em um só lugar.
                    </p>
                  </div>
                </div>
                <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${storeOpen ? "bg-[#e6f7eb] text-[#1f7a44]" : "bg-[#fff0f0] text-[#9b1520]"}`}>
                  {storeOpen ? "Aberto agora" : "Fechado agora"}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
              <div className="mb-5 rounded-[28px] border border-[#f1d0cf] bg-[linear-gradient(135deg,#5f0a10_0%,#8f141d_58%,#b92028_100%)] p-5 text-white shadow-[0_28px_60px_rgba(110,13,18,0.18)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">
                  {brandName}
                </p>
                <p className="mt-3 text-xl font-black leading-tight">
                  {brandTagline}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/78">
                  Escolha seu sabor, acompanhe seus pedidos e entre na experiência completa da Bonatto sem exagero visual.
                </p>
                <div className="mt-4">
                  <Link href="/cardapio" onClick={() => setDrawerOpen(false)} className="inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-black text-[#6E0D12] transition hover:scale-[1.01]">
                    Ver cardápio
                  </Link>
                </div>
              </div>

              <div className="mb-5">
                <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.26em] text-[#8d5a5e]">
                  Explorar
                </p>
                <div className="space-y-2">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = location === link.href;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setDrawerOpen(false)}
                        className={`group flex items-center justify-between rounded-[22px] border px-4 py-3.5 transition ${
                          isActive
                            ? "border-[#eeb8b5] bg-[#fff2f1] text-[#7f1017]"
                            : "border-[#f1e3e2] bg-white/90 text-[#351215] hover:border-[#efc5c2] hover:bg-white"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`rounded-2xl p-2 ${isActive ? "bg-[#6E0D12] text-white" : "bg-[#fff3f2] text-[#8f1118]"}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-bold">{link.label}</span>
                        </span>
                        <span className="text-xs font-semibold text-[#a76a6f] group-hover:text-[#8f1118]">abrir</span>
                      </Link>
                    );
                  })}

                  {(user?.role === "admin" || user?.role === "manager") && (
                    <Link
                      href="/admin"
                      onClick={() => setDrawerOpen(false)}
                      className="group flex items-center justify-between rounded-[22px] border border-[#f1e3e2] bg-white/90 px-4 py-3.5 text-[#351215] transition hover:border-[#efc5c2] hover:bg-white"
                    >
                      <span className="flex items-center gap-3">
                        <span className="rounded-2xl bg-[#fff3f2] p-2 text-[#8f1118]">
                          <ChefHat className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-bold">{user?.role === "manager" ? "Painel Gerente" : "Painel Admin"}</span>
                      </span>
                      <span className="text-xs font-semibold text-[#a76a6f] group-hover:text-[#8f1118]">abrir</span>
                    </Link>
                  )}
                </div>
              </div>

              {isAuthenticated && (
                <div className="mb-5">
                  <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.26em] text-[#8d5a5e]">
                    Minha conta
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {accountCards.map((card) => (
                      <button
                        key={card.tab}
                        type="button"
                        onClick={() => goToTab(card.tab)}
                        className="relative rounded-[22px] border border-[#f0e1df] bg-white/92 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-[#e6b8b4] hover:bg-white"
                      >
                        {card.badge !== null && (
                          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6E0D12] px-1 text-[9px] font-black text-white">
                            {card.badge}
                          </span>
                        )}
                        <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl bg-[#fff2f1] text-[#8f1118]">
                          {card.icon}
                        </span>
                        <span className="mt-2 block text-[10px] font-bold leading-tight text-[#462024]">
                          {card.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isAuthenticated && (
                <div className="rounded-[24px] border border-[#f1dfde] bg-white/92 p-4">
                  <p className="text-sm font-bold text-[#351215]">Entre para acompanhar pedidos e vantagens.</p>
                  <p className="mt-1 text-xs leading-5 text-[#805055]">
                    Sua conta libera recompensas, pedidos ativos, cupons e um checkout muito mais rápido.
                  </p>
                  <Link href="/login" onClick={() => setDrawerOpen(false)} className="mt-4 block">
                    <Button className="w-full gap-2 rounded-full bg-[#6E0D12] text-white hover:bg-[#56090e]">
                      <LogIn className="h-4 w-4" />
                      Entrar ou criar conta
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {isAuthenticated && (
              <div className="border-t border-[#f0dcdb] px-4 py-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-[#8a5d61] transition hover:bg-[#fff1f0] hover:text-[#9b1520]"
                  onClick={() => {
                    logout();
                    setDrawerOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
