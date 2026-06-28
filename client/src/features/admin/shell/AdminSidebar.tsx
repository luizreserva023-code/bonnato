import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BellOff,
  Bike,
  Bot,
  Building2,
  ChevronDown,
  ChefHat,
  ClipboardList,
  ExternalLink,
  Gift,
  Home,
  LayoutDashboard,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  Package,
  RefreshCcw,
  Settings,
  Store,
  Tag,
  Ticket,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

import { useAdminStore } from "@/contexts/AdminStoreContext";
import { Button } from "@/components/ui/button";
import { useTenantConfig } from "@/shared/tenant/use-tenant-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminTabId } from "@/shared/admin/admin-tabs";

export const BONATTO_ICON_URL = "/brand/palmito-2-circular.png";
const BONATTO_LOGO_URL = "/brand/palmito-logo-tipografica.png";
export const ADMIN_SIDEBAR_WIDTH = 224;

type AdminNavItem = {
  id: AdminTabId;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
  children?: Array<{ id: AdminTabId; label: string; icon: ReactNode; adminOnly?: boolean }>;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { id: "orders", label: "Pedidos", icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { id: "menu", label: "Cardápio", icon: <ChefHat className="h-[18px] w-[18px]" /> },
  {
    id: "inventory",
    label: "Operação",
    icon: <Package className="h-[18px] w-[18px]" />,
    children: [
      { id: "inventory", label: "Estoque", icon: <Package className="h-4 w-4" /> },
      { id: "staff", label: "Equipe", icon: <Users className="h-4 w-4" /> },
      { id: "dining", label: "Salão", icon: <Home className="h-4 w-4" /> },
    ],
  },
  {
    id: "coupons",
    label: "Marketing",
    icon: <Megaphone className="h-[18px] w-[18px]" />,
    children: [
      { id: "coupons", label: "Cupons", icon: <Tag className="h-4 w-4" /> },
      { id: "promotions", label: "Promoções", icon: <Gift className="h-4 w-4" /> },
      { id: "raffles", label: "Sorteios", icon: <Ticket className="h-4 w-4" /> },
      { id: "upsells", label: "Up-sells", icon: <Zap className="h-4 w-4" /> },
      { id: "recovery", label: "Recuperação", icon: <RefreshCcw className="h-4 w-4" /> },
    ],
  },
  {
    id: "users",
    label: "Clientes",
    icon: <Users className="h-[18px] w-[18px]" />,
    children: [
      { id: "users", label: "Usuários", icon: <Users className="h-4 w-4" /> },
      { id: "messages", label: "Mensagens", icon: <MessageCircle className="h-4 w-4" /> },
    ],
  },
  { id: "reports", label: "Relatórios", icon: <TrendingUp className="h-[18px] w-[18px]" /> },
  {
    id: "drivers",
    label: "Entregas",
    icon: <Bike className="h-[18px] w-[18px]" />,
    children: [
      { id: "drivers", label: "Motoboys", icon: <Bike className="h-4 w-4" /> },
      { id: "stores", label: "Lojas", icon: <Building2 className="h-4 w-4" />, adminOnly: true },
    ],
  },
  { id: "settings", label: "Configurações", icon: <Settings className="h-[18px] w-[18px]" /> },
];

const TOOL_LINKS = [
  { href: "/vendas", label: "Painel de Vendas", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/crm", label: "CRM", icon: <Users className="h-4 w-4" /> },
  { href: "/notificacoes", label: "Notificações", icon: <Megaphone className="h-4 w-4" /> },
  { href: "/zonas-entrega", label: "Zonas de Entrega", icon: <MapPin className="h-4 w-4" /> },
  { href: "/automacoes", label: "Automações", icon: <Bot className="h-4 w-4" /> },
];

export interface AdminSidebarProps {
  activeTab: AdminTabId;
  setActiveTab: (tab: AdminTabId) => void;
  pendingCount: number;
  unreadMessagesCount: number;
  stopAlert: () => void;
  onClose?: () => void;
  isSubscribed: boolean;
  pushLoading: boolean;
  pushSupported: boolean;
  subscribePush: () => void;
  unsubscribePush: () => void;
  isAdmin: boolean;
}

export function AdminSidebar({
  activeTab,
  setActiveTab,
  pendingCount,
  unreadMessagesCount,
  stopAlert,
  onClose,
  isSubscribed,
  pushLoading,
  pushSupported,
  subscribePush,
  unsubscribePush,
  isAdmin,
}: AdminSidebarProps) {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const { selectedStoreSlug } = useAdminStore();
  const tenant = useTenantConfig(selectedStoreSlug);

  useEffect(() => {
    for (const item of ADMIN_NAV_ITEMS) {
      if (item.children?.some((child) => child.id === activeTab)) {
        setOpenSubmenu(item.label);
        break;
      }
    }
  }, [activeTab]);

  const textMuted = "var(--admin-sidebar-text)";
  const hoverBg = "var(--admin-sidebar-hover-bg)";
  const dividerColor = "var(--admin-sidebar-divider)";

  function handleNav(id: AdminTabId) {
    setActiveTab(id);
    if (id === "orders") stopAlert();
    onClose?.();
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{
        width: `${ADMIN_SIDEBAR_WIDTH}px`,
        background: "var(--admin-sidebar-bg)",
        color: textMuted,
        borderRight: "1px solid var(--admin-sidebar-border)",
        boxShadow: "2px 0 12px rgba(0,0,0,0.15)",
      }}
    >
      <div
        className="flex min-h-[60px] items-center overflow-hidden px-3 pb-3 pt-4"
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <img src={tenant.brand.logos.icon || BONATTO_ICON_URL} alt={tenant.brand.shortName} className="h-10 w-10 shrink-0 rounded-full bg-white/10 object-contain" />
          <div className="flex min-w-0 items-center overflow-hidden">
            <img src={tenant.brand.logos.wordmark || BONATTO_LOGO_URL} alt={tenant.brand.name} className="h-8 w-auto object-contain" />
          </div>
        </div>
      </div>

      <div className="px-3 pb-1 pt-2">
        <AdminStoreSelectorSidebarDark />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-0.5">
          {ADMIN_NAV_ITEMS.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            if (tenant.features.adminTabs[item.id] === false) return null;

            const childIds = item.children?.map((child) => child.id) ?? [];
            const hasChildren = childIds.length > 0;
            const isParentActive = hasChildren && childIds.includes(activeTab);
            const isActive = activeTab === item.id || isParentActive;
            const isOpen = openSubmenu === item.label;
            const badge =
              item.id === "orders" && pendingCount > 0
                ? pendingCount
                : childIds.includes("messages") && unreadMessagesCount > 0
                  ? unreadMessagesCount
                  : null;

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => {
                    if (hasChildren) {
                      setOpenSubmenu(isOpen ? null : item.label);
                      if (!isParentActive && item.children) handleNav(item.children[0].id);
                      return;
                    }
                    handleNav(item.id);
                  }}
                  className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all"
                  style={
                    isActive
                      ? { color: "var(--admin-sidebar-text-active)", background: "var(--admin-sidebar-active-bg)", fontWeight: 600 }
                      : { color: textMuted, background: "transparent" }
                  }
                  onMouseEnter={(event) => {
                    if (!isActive) event.currentTarget.style.background = hoverBg;
                  }}
                  onMouseLeave={(event) => {
                    if (!isActive) event.currentTarget.style.background = "transparent";
                  }}
                >
                  {isActive ? (
                    <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" style={{ background: "rgba(255,255,255,0.9)" }} />
                  ) : null}
                  <span className="shrink-0" style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {hasChildren ? (
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} style={{ opacity: 0.4 }} />
                  ) : null}
                  {badge !== null ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#dc2626] text-[8px] font-bold text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </button>

                {hasChildren && isOpen ? (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 pl-3" style={{ borderColor: "rgba(255,255,255,0.20)" }}>
                    {item.children?.filter((child) => (!child.adminOnly || isAdmin) && tenant.features.adminTabs[child.id] !== false).map((child) => {
                      const isChildActive = activeTab === child.id;
                      const childBadge =
                        child.id === "orders" && pendingCount > 0
                          ? pendingCount
                          : child.id === "messages" && unreadMessagesCount > 0
                            ? unreadMessagesCount
                            : null;

                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => handleNav(child.id)}
                          className="relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-all"
                          style={
                            isChildActive
                              ? { color: "#ffffff", background: "rgba(255,255,255,0.18)" }
                              : { color: "rgba(255,255,255,0.70)", background: "transparent" }
                          }
                          onMouseEnter={(event) => {
                            if (!isChildActive) event.currentTarget.style.background = hoverBg;
                          }}
                          onMouseLeave={(event) => {
                            if (!isChildActive) event.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span className="shrink-0">{child.icon}</span>
                          <span className="flex-1 text-left">{child.label}</span>
                          {childBadge !== null ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#dc2626] text-[8px] font-bold text-white">
                              {childBadge > 9 ? "9+" : childBadge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t pt-3" style={{ borderTopColor: dividerColor }}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.50)" }}>
            Ferramentas
          </p>
          <div className="space-y-0.5">
            {TOOL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all"
                style={{ color: "rgba(255,255,255,0.70)", background: "transparent" }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = hoverBg;
                  event.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                  event.currentTarget.style.color = "rgba(255,255,255,0.70)";
                }}
              >
                <span className="shrink-0">{link.icon}</span>
                <span className="flex-1">{link.label}</span>
                <ExternalLink className="h-3 w-3 opacity-30" />
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="space-y-1 border-t px-2 pb-3 pt-2" style={{ borderTopColor: dividerColor }}>
        {pushSupported ? (
          <button
            type="button"
            onClick={isSubscribed ? unsubscribePush : subscribePush}
            disabled={pushLoading}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all"
            style={{ color: isSubscribed ? "#22c55e" : textMuted, background: "transparent" }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = hoverBg;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
          >
            {pushLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span>{isSubscribed ? "Push ativo" : "Ativar Push"}</span>
          </button>
        ) : null}

        <Link
          href="/"
          onClick={onClose}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all"
          style={{ color: textMuted, background: "transparent" }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = hoverBg;
            event.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "transparent";
            event.currentTarget.style.color = textMuted;
          }}
        >
          <Home className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1">Ver Site</span>
        </Link>

        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.25)", color: "#ffffff", borderColor: "rgba(255,255,255,0.40)" }}>
            {isAdmin ? "A" : "M"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-white">{isAdmin ? "Administrador" : "Gerente"}</p>
            <p className="truncate text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              {isAdmin ? "Acesso total" : "Acesso da loja"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminStoreSelectorSidebarDark() {
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, isManager, stores } = useAdminStore();
  if (isManager) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.12)" }}>
        <Store className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.70)" }} />
        <span className="truncate text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>{selectedStoreName}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-all"
          style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "rgba(255,255,255,0.20)";
            event.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "rgba(255,255,255,0.12)";
            event.currentTarget.style.color = "rgba(255,255,255,0.85)";
          }}
        >
          <Store className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.70)" }} />
          <span className="flex-1 truncate text-left">{selectedStoreName}</span>
          <ChevronDown className="h-3 w-3 shrink-0" style={{ color: "rgba(255,255,255,0.50)" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuItem onClick={() => setSelectedStoreId(undefined)} className={!selectedStoreId ? "font-bold text-primary" : ""}>
          Todas as lojas
        </DropdownMenuItem>
        {stores.map((store) => (
          <DropdownMenuItem key={store.id} onClick={() => setSelectedStoreId(store.id)} className={selectedStoreId === store.id ? "font-bold text-primary" : ""}>
            {store.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminStoreSelectorMobile() {
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, isManager, stores } = useAdminStore();
  if (isManager) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" style={{ background: "rgba(0,0,0,0.06)", borderColor: "rgba(0,0,0,0.12)", color: "#3a3a3a" }}>
          <Store className="h-3 w-3" />
          <span className="max-w-[100px] truncate">{selectedStoreName}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem onClick={() => setSelectedStoreId(undefined)} className={!selectedStoreId ? "font-bold text-primary" : ""}>
          Todas as lojas
        </DropdownMenuItem>
        {stores.map((store) => (
          <DropdownMenuItem key={store.id} onClick={() => setSelectedStoreId(store.id)} className={selectedStoreId === store.id ? "font-bold text-primary" : ""}>
            {store.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
