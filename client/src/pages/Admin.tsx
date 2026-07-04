import { OrderChat } from "@/components/OrderChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { clampFlavorCount, getPizzaFlavorConfig } from "@/lib/pizza-flavor-config";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  Clock,
  Crown,
  DollarSign,
  Gift,
  Loader2,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  Tag,
  Ticket,
  TrendingUp,
  Users,
  Zap,
  Bike,
  Copy,
  MapPin,
  MessageCircle,
  Phone,
  PlusCircle,
  Trash2,
  CheckCircle,
  XCircle,
  Menu,
  X,
  Home,
  ExternalLink,
  LayoutDashboard,
  Megaphone,
  Bot,
  Upload,
  ImageIcon,
  RefreshCcw,
  FileText,
  Truck,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { MapView } from "@/components/Map";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area, ComposedChart, ReferenceLine } from "recharts";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, BellOff } from "lucide-react";
import { JoinedPagination } from "@/components/ui/joined-pagination";
import { MarketplacesTab } from "./admin/MarketplacesTab";
import { NetworkFinanceTab } from "./admin/NetworkFinanceTab";
import { StoresTab } from "./admin/StoresTab";
import { Building2, Store, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminStoreProvider, useAdminStore } from "@/contexts/AdminStoreContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CATEGORY_ICON_OPTIONS, getCategoryIcon, getCategoryImage } from "@/lib/category-visuals";
import { BRAND_ASSETS } from "@/lib/brand";
import {
  loadMagnificCategoryImages,
  loadMagnificIcons,
  type MagnificCategoryImageAsset,
  type MagnificIconAsset,
} from "@/lib/magnific-assets";
import {
  AdminPage,
  AdminTopbar,
  AdminSurface,
  AdminStat,
  AdminStatGrid,
  AdminSearch,
  AdminChipGroup,
  AdminEmptyState,
  AdminPill,
  AdminSectionLabel,
} from "@/components/admin/ui";

const STATUS_LABELS: Record<string, { label: string; color: string; next?: string }> = {
  pending: { label: "Aguardando", color: "bg-[#fce8e8] text-[#6E0D12]", next: "confirmed" },
  confirmed: { label: "Confirmado", color: "bg-[#fdf5f5] text-[#5a0a0f]", next: "preparing" },
  preparing: { label: "Preparando", color: "bg-[#f9d0d0] text-[#450709]", next: "out_for_delivery" },
  out_for_delivery: { label: "Saiu p/ Entrega", color: "bg-[#f5b8b8] text-[#2d0508]", next: "delivered" },
  delivered: { label: "Entregue", color: "bg-[#f0fdf4] text-[#166534]" },
  cancelled: { label: "Cancelado", color: "bg-[#fce8e8] text-[#450709]" },
};

const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "Cartão Crédito",
  debit_card: "Cartão Débito",
  pix: "PIX",
  cash: "Dinheiro",
};

type AdminTab = "dashboard" | "orders" | "messages" | "menu" | "club" | "coupons" | "reports" | "network" | "distribution" | "promotions" | "raffles" | "upsells" | "users" | "drivers" | "settings" | "payments" | "marketplaces" | "stores" | "recovery";
type ClubAdminPlanId = "bonattao" | "basico";
type ClubAdminPlan = {
  id: ClubAdminPlanId;
  name: string;
  badge: string;
  price: number;
  discountPercent: number;
  freeDelivery: boolean;
  freePizzaPerMonth: boolean;
  description: string;
  benefits: string[];
};
type ClubAdminConfig = {
  badgeLabel: string;
  sectionTitle: string;
  sectionSubtitle: string;
  ctaLabel: string;
  disclaimer: string;
  highlightItems: string[];
  checkoutTitle: string;
  checkoutSubtitle: string;
  checkoutDiscountLabel: string;
  checkoutDeliveryLabel: string;
  checkoutFreePizzaLabel: string;
  profileGuestTitle: string;
  profileGuestSubtitle: string;
  profileBenefitsTitle: string;
  profilePrimaryActionLabel: string;
  successTitle: string;
  successSubtitle: string;
  popularPlanId: ClubAdminPlanId;
  plans: ClubAdminPlan[];
};

// ─── Admin Theme Context ─────────────────────────────────────────────────────
// Dark mode removed — admin always uses light theme

// ─── Sidebar nav groups ───────────────────────────────────────────────────────
// Abas marcadas com adminOnly=true ficam ocultas para managers
type NavItem = { id: AdminTab; label: string; icon: React.ReactNode; adminOnly?: boolean; children?: Array<{ id: AdminTab; label: string; icon: React.ReactNode; adminOnly?: boolean }> };

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard" as AdminTab, label: "Dashboard", icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: "orders" as AdminTab, label: "Pedidos", icon: <ClipboardList className="w-[18px] h-[18px]" /> },
  { id: "menu" as AdminTab, label: "Cardápio", icon: <ChefHat className="w-[18px] h-[18px]" /> },
  { id: "club" as AdminTab, label: "Clube", icon: <Crown className="w-[18px] h-[18px]" /> },
  {
    id: "coupons" as AdminTab, label: "Marketing", icon: <Megaphone className="w-[18px] h-[18px]" />,
    children: [
      { id: "coupons" as AdminTab, label: "Cupons", icon: <Tag className="w-4 h-4" /> },
      { id: "promotions" as AdminTab, label: "Promoções", icon: <Gift className="w-4 h-4" /> },
      { id: "raffles" as AdminTab, label: "Sorteios", icon: <Ticket className="w-4 h-4" /> },
      { id: "upsells" as AdminTab, label: "Up-sells", icon: <Zap className="w-4 h-4" /> },
      { id: "recovery" as AdminTab, label: "Recuperação", icon: <RefreshCcw className="w-4 h-4" /> },
    ],
  },
  {
    id: "users" as AdminTab, label: "Clientes", icon: <Users className="w-[18px] h-[18px]" />,
    children: [
      { id: "users" as AdminTab, label: "Usuários", icon: <Users className="w-4 h-4" /> },
      { id: "messages" as AdminTab, label: "Mensagens", icon: <MessageCircle className="w-4 h-4" /> },
    ],
  },
  { id: "reports" as AdminTab, label: "Relatórios", icon: <TrendingUp className="w-[18px] h-[18px]" /> },
  { id: "network" as AdminTab, label: "Rede & Financeiro", icon: <Building2 className="w-[18px] h-[18px]" /> },
  { id: "distribution" as AdminTab, label: "Centro de Distribuição", icon: <Package className="w-[18px] h-[18px]" /> },
  {
    id: "drivers" as AdminTab, label: "Entregas", icon: <Bike className="w-[18px] h-[18px]" />,
    children: [
      { id: "drivers" as AdminTab, label: "Motoboys", icon: <Bike className="w-4 h-4" /> },
      { id: "stores" as AdminTab, label: "Lojas", icon: <Building2 className="w-4 h-4" />, adminOnly: true },
    ],
  },
  { id: "payments" as AdminTab, label: "Pagamentos", icon: <DollarSign className="w-[18px] h-[18px]" />, adminOnly: true },
  { id: "marketplaces" as AdminTab, label: "Marketplaces", icon: <Truck className="w-[18px] h-[18px]" />, adminOnly: true },
  { id: "settings" as AdminTab, label: "Configurações", icon: <Settings className="w-[18px] h-[18px]" /> },
];

// AdminThemeToggleButton removed — dark mode disabled

// ─── Brand assets ────────────────────────────────────────────────────────────
// Mesmas logos e cores da Navbar da loja
const BONATTO_ICON_URL = BRAND_ASSETS.palmito;
const BONATTO_LOGO_URL = BRAND_ASSETS.palmitoWordmark;

// ─── Framer Motion variants for hover-expand sidebar ───────────────────────
const sidebarMotionVariants = {
  open:   { width: '224px' },
  closed: { width: '64px'  },
};
const sidebarTransition = { ease: 'easeOut', duration: 0.22 } as const;
const labelVariants = {
  open:   { opacity: 1, x: 0,   display: 'block' },
  closed: { opacity: 0, x: -8, transitionEnd: { display: 'none' } },
};
const labelTransition = { duration: 0.15 };

// ─── Collapsible Admin Sidebar (bordô único) ─────────────────────────────────
function AdminSidebar({
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
  collapsed,
  onToggleCollapse,
}: {
  activeTab: AdminTab;
  setActiveTab: (t: AdminTab) => void;
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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  // Sidebar sempre expandida — sem hover-expand
  const isHovered = true;
  const isCollapsed = false;

  function handleNav(id: AdminTab) {
    setActiveTab(id);
    if (id === "orders") stopAlert();
    onClose?.();
  }

  const TOOLS = [
    { href: '/vendas', label: 'Painel de Vendas', icon: <BarChart3 className="w-4 h-4" /> },
    { href: '/crm', label: 'CRM', icon: <Users className="w-4 h-4" /> },
    { href: '/notificacoes', label: 'Notificações', icon: <Megaphone className="w-4 h-4" /> },
    { href: '/zonas-entrega', label: 'Zonas de Entrega', icon: <MapPin className="w-4 h-4" /> },
    { href: '/automacoes', label: 'Automações', icon: <Bot className="w-4 h-4" /> },
  ];

  // Submenus colapsáveis
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  // Auto-expand submenu when active tab is inside it
  useEffect(() => {
    for (const item of NAV_ITEMS) {
      if (item.children?.some(c => c.id === activeTab)) {
        setOpenSubmenu(item.label);
        break;
      }
    }
  }, [activeTab]);

  // Palette via CSS variables — sidebar uses white text on red gradient
  const sidebarBg = 'var(--admin-sidebar-bg)';
  const textMuted = 'var(--admin-sidebar-text)';
  const textActive = 'var(--admin-sidebar-text-active)';
  const hoverBg = 'var(--admin-sidebar-hover-bg)';
  const dividerColor = 'var(--admin-sidebar-divider)';

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: sidebarBg, color: textMuted, borderRight: `1px solid var(--admin-sidebar-border)`, width: '224px', boxShadow: '2px 0 12px rgba(0,0,0,0.15)' }}
    >
      {/* ── Header: logo ── */}
      <div className="flex items-center px-3 pt-4 pb-3 overflow-hidden" style={{ borderBottom: `1px solid ${dividerColor}`, minHeight: 60 }}>
        <div className="flex items-center gap-2 min-w-0">
          <img src={BONATTO_ICON_URL} alt="Bonatto" className="w-10 h-10 object-contain shrink-0 rounded-full" />
          <div className="min-w-0 overflow-hidden flex items-center">
            <img src={BONATTO_LOGO_URL} alt="Bonatto Pizza" className="h-8 w-auto object-contain" />
          </div>
        </div>
      </div>

      {/* ── Seletor de loja (apenas expandido) ── */}
      {!isCollapsed && (
        <div className="px-3 pt-2 pb-1">
          <AdminStoreSelectorSidebarDark />
        </div>
      )}

      {/* ── Nav items ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const hasChildren = item.children && item.children.length > 0;
            const childIds = item.children?.map(c => c.id) ?? [];
            const isParentActive = hasChildren && childIds.includes(activeTab);
            const isDirectActive = !hasChildren && activeTab === item.id;
            const isActive = isDirectActive || isParentActive;
            const isOpen = openSubmenu === item.label;
            const badge = item.id === 'orders' && pendingCount > 0 ? pendingCount
              : childIds.includes('messages' as AdminTab) && unreadMessagesCount > 0 ? unreadMessagesCount
              : null;

            return (
              <div key={item.label}>
                <button
                  onClick={() => {
                    if (hasChildren) {
                      setOpenSubmenu(isOpen ? null : item.label);
                      if (!isParentActive && item.children) handleNav(item.children[0].id);
                    } else {
                      handleNav(item.id);
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                    isCollapsed ? 'justify-center px-0 w-10 h-10 mx-auto' : ''
                  }`}
                  style={isActive
                    ? { color: 'var(--admin-sidebar-text-active)', background: 'var(--admin-sidebar-active-bg)', fontWeight: 600 }
                    : { color: textMuted, background: 'transparent' }
                  }
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = hoverBg; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <span className="shrink-0" style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                  {!isCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                  {!isCollapsed && hasChildren && (
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ opacity: 0.4 }} />
                  )}
                  {badge !== null && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#dc2626] text-white text-[8px] font-bold flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>
                  )}
                </button>
                {/* Submenu children */}
                {hasChildren && isOpen && !isCollapsed && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
                    {item.children!.filter(c => !c.adminOnly || isAdmin).map((child) => {
                      const isChildActive = activeTab === child.id;
                      const childBadge = child.id === 'orders' && pendingCount > 0 ? pendingCount
                        : child.id === 'messages' && unreadMessagesCount > 0 ? unreadMessagesCount
                        : null;
                      return (
                        <button
                          key={child.id}
                          onClick={() => handleNav(child.id)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all relative"
                          style={isChildActive
                            ? { color: '#ffffff', background: 'rgba(255,255,255,0.18)' }
                            : { color: 'rgba(255,255,255,0.70)', background: 'transparent' }
                          }
                          onMouseEnter={e => { if (!isChildActive) (e.currentTarget as HTMLButtonElement).style.background = hoverBg; }}
                          onMouseLeave={e => { if (!isChildActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          <span className="shrink-0">{child.icon}</span>
                          <span className="flex-1 text-left">{child.label}</span>
                          {childBadge !== null && (
                            <span className="w-4 h-4 rounded-full bg-[#dc2626] text-white text-[8px] font-bold flex items-center justify-center">{childBadge > 9 ? '9+' : childBadge}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Ferramentas externas */}
        {!isCollapsed && (
          <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${dividerColor}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: 'rgba(255,255,255,0.50)' }}>Ferramentas</p>
            <div className="space-y-0.5">
              {TOOLS.map((link) => (
                <Link key={link.href} href={link.href} onClick={onClose}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium w-full transition-all"
                  style={{ color: 'rgba(255,255,255,0.70)', background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = hoverBg; (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.70)'; }}
                >
                  <span className="shrink-0">{link.icon}</span>
                  <span className="flex-1">{link.label}</span>
                  <ExternalLink className="w-3 h-3 opacity-30" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="px-2 pb-3 pt-2 space-y-1" style={{ borderTop: `1px solid ${dividerColor}` }}>
        {pushSupported && (
          <button
            onClick={isSubscribed ? unsubscribePush : subscribePush}
            disabled={pushLoading}
            title={isCollapsed ? (isSubscribed ? 'Push ativo' : 'Ativar Push') : undefined}
            className={`transition-all ${
              isCollapsed
                ? 'w-10 h-10 rounded-lg flex items-center justify-center mx-auto'
                : 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium'
            }`}
            style={{ color: isSubscribed ? '#22c55e' : textMuted, background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = hoverBg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            {pushLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {!isCollapsed && <span>{isSubscribed ? 'Push ativo' : 'Ativar Push'}</span>}
          </button>
        )}
        <Link href="/" onClick={onClose}
          title={isCollapsed ? 'Ver Site' : undefined}
          className={`transition-all ${
            isCollapsed
              ? 'w-10 h-10 rounded-lg flex items-center justify-center mx-auto'
              : 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium w-full'
          }`}
          style={{ color: textMuted, background: 'transparent' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = hoverBg; (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = textMuted; }}
        >
          <Home className="w-[18px] h-[18px] shrink-0" />
          {!isCollapsed && <span className="flex-1">Ver Site</span>}
        </Link>
        {/* Dark mode toggle */}

        {/* Avatar */}
        <div className={`flex items-center gap-2.5 px-2 py-2 ${
          isCollapsed ? 'justify-center' : ''
        }`}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: 'rgba(255,255,255,0.25)', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.40)' }}>
            {isAdmin ? 'A' : 'M'}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate" style={{ color: '#ffffff' }}>{isAdmin ? 'Administrador' : 'Gerente'}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{isAdmin ? 'Acesso total' : 'Acesso da loja'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Polling de pedidos para detectar novos (apenas quando autenticado como admin)
  const { data: allOrdersForAlert } = trpc.orders.list.useQuery(
    { limit: 100 },
    { refetchInterval: 15000, enabled: !loading && isAuthenticated && user?.role === "admin" }
  );
  const alertOrderIds = allOrdersForAlert?.map(o => o.id);
  const { stopAlert } = useNewOrderAlert(alertOrderIds, !loading && isAuthenticated && user?.role === "admin");
  const { isSubscribed, isLoading: pushLoading, isSupported: pushSupported, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications();
  const pendingCount = allOrdersForAlert?.filter(o => o.status === "pending").length ?? 0;
  const { data: totalUnreadData } = trpc.chat.totalUnread.useQuery(undefined, {
    refetchInterval: 15000,
    enabled: !loading && isAuthenticated && user?.role === "admin",
  });
  const unreadMessagesCount = totalUnreadData?.count ?? 0;

  const isAdmin = user?.role === "admin";

  // Estado de collapse da sidebar (persistido no localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('bonatto_admin_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('bonatto_admin_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  }

  // Dark mode removed — always light

  const sidebarProps = {
    activeTab,
    setActiveTab,
    pendingCount,
    unreadMessagesCount,
    stopAlert,
    isSubscribed,
    pushLoading,
    pushSupported: pushSupported ?? false,
    subscribePush,
    unsubscribePush,
    isAdmin,
    collapsed: sidebarCollapsed,
    onToggleCollapse: toggleSidebar,
  };

  // Label da aba ativa para o header mobile
  const activeLabel = NAV_ITEMS.flatMap(item => item.children ? [item, ...item.children] : [item]).find(i => i.id === activeTab)?.label ?? "Admin";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "manager")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <ChefHat className="w-16 h-16 text-muted-foreground opacity-30" />
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        <Link href="/"><Button variant="outline">Voltar ao Início</Button></Link>
      </div>
    );
  }

  return (
    <AdminStoreProvider>
    {/* Grid background wrapper */}
    <div data-admin-theme="light" className="min-h-screen flex" style={{
      background: 'var(--admin-bg)',
      color: 'var(--admin-text)',
    }}>
      {/* ── Desktop Sidebar fixa expandida (lg+) ── */}
      <aside
        className="hidden lg:flex shrink-0 sticky top-0 h-screen flex-col"
        style={{ width: 224, zIndex: 50 }}
      >
        <AdminSidebar {...sidebarProps} />
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64" style={{ background: 'var(--admin-sidebar-bg)' }}>
          <SheetTitle className="sr-only">Menu de navegação do painel admin</SheetTitle>
          <AdminSidebar {...sidebarProps} onClose={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3" style={{ background: 'var(--admin-mobile-header-bg)', borderBottom: `1px solid var(--admin-mobile-header-border)`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <button onClick={() => setMobileSidebarOpen(true)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--admin-text)' }}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <img src={BONATTO_ICON_URL} alt="Bonatto" className="w-7 h-7 object-contain rounded-full" />
            <span className="font-semibold text-sm" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--admin-mobile-header-text)' }}>{activeLabel}</span>
          </div>
          <AdminStoreSelectorMobile />
          {pendingCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-[#a01218] opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-[#7d0f14] text-white text-[9px] font-black items-center justify-center">{pendingCount}</span>
            </span>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8" style={{ background: 'var(--admin-bg)' }}>
          <div key={activeTab} style={{ animation: 'adminFadeIn 0.18s ease-out' }}>
            {activeTab === "dashboard" && <DeliveryDashboardTab />}
            {activeTab === "orders" && <OrdersTab onOpenOrder={stopAlert} />}
            {activeTab === "menu" && <MenuTab />}
            {activeTab === "club" && <ClubTab />}
            {activeTab === "coupons" && <CouponsTab />}
            {activeTab === "promotions" && <PromotionsTab />}
            {activeTab === "raffles" && <RafflesTab />}
            {activeTab === "upsells" && <UpsellsTab />}
            {activeTab === "users" && <UsersTab />}
            {activeTab === "reports" && <ReportsTab />}
            {activeTab === "network" && <NetworkFinanceTab />}
            {activeTab === "distribution" && <NetworkFinanceTab mode="distribution" />}
            {activeTab === "drivers" && <DriversTab />}
            {activeTab === "messages" && <MessagesTab />}
            {activeTab === "payments" && isAdmin && <PaymentsTab />}
            {activeTab === "marketplaces" && isAdmin && <MarketplacesTab />}
            {activeTab === "settings" && <SettingsTab />}
            {activeTab === "stores" && isAdmin && <StoresTab />}
            {activeTab === "recovery" && <RecoveryTab />}
          </div>
        </main>
      </div>
    </div>
    </AdminStoreProvider>
  );
}

// ─── Store Selector (Admin only) ─────────────────────────────────────────────
function AdminStoreSelectorSidebar() {
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, isManager, stores } = useAdminStore();
  if (isManager) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground text-xs font-medium transition-all border border-sidebar-border/50">
          <Store className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span className="flex-1 text-left truncate">{selectedStoreName}</span>
          <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuItem onClick={() => setSelectedStoreId(undefined)} className={!selectedStoreId ? "font-bold text-primary" : ""}>
          Todas as lojas
        </DropdownMenuItem>
        {stores.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => setSelectedStoreId(s.id)} className={selectedStoreId === s.id ? "font-bold text-primary" : ""}>
            {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Versão escura do seletor de loja para a sidebar bordô
function AdminStoreSelectorSidebarDark() {
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, isManager, stores } = useAdminStore();
  if (isManager) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.12)' }}>
        <Store className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.70)' }} />
        <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{selectedStoreName}</span>
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.20)'; (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)'; }}
        >
          <Store className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.70)' }} />
          <span className="flex-1 text-left truncate">{selectedStoreName}</span>
          <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.50)' }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuItem onClick={() => setSelectedStoreId(undefined)} className={!selectedStoreId ? "font-bold text-primary" : ""}>
          Todas as lojas
        </DropdownMenuItem>
        {stores.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => setSelectedStoreId(s.id)} className={selectedStoreId === s.id ? "font-bold text-primary" : ""}>
            {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminStoreSelectorMobile() {
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, isManager, stores } = useAdminStore();
  if (isManager) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" style={{ background: 'rgba(0,0,0,0.06)', borderColor: 'rgba(0,0,0,0.12)', color: '#3a3a3a' }}>
          <Store className="w-3 h-3" />
          <span className="max-w-[100px] truncate">{selectedStoreName}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem onClick={() => setSelectedStoreId(undefined)} className={!selectedStoreId ? "font-bold text-primary" : ""}>
          Todas as lojas
        </DropdownMenuItem>
        {stores.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => setSelectedStoreId(s.id)} className={selectedStoreId === s.id ? "font-bold text-primary" : ""}>
            {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── DASHBOARD TAB ───────────────────────────────────────────────────────────
function DashboardTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId } = useAdminStore();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [timezoneOffset] = useState(() => new Date().getTimezoneOffset());

  // Queries
  const { data: orders, isLoading } = trpc.orders.list.useQuery({ limit: 20, storeId: selectedStoreId });
  const { data: dailyRevenue } = trpc.reports.dailyRevenue.useQuery({ days: 7, storeId: selectedStoreId, timezoneOffset });
  const { data: todaySummary } = trpc.reports.todaySummary.useQuery(
    { timezoneOffset, storeId: selectedStoreId },
    { refetchInterval: 30000 }
  );
  const [startDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; });
  const [endDate] = useState(() => new Date());
  const { data: topProducts } = trpc.reports.topProducts.useQuery({ limit: 10, storeId: selectedStoreId });
  const { data: topCategories } = trpc.reports.topCategories.useQuery({ startDate, endDate, storeId: selectedStoreId });

  // Derived values
  const pendingOrders = orders?.filter((o) => o.status === "pending").length ?? 0;
  const confirmedOrders = orders?.filter((o) => o.status === "confirmed").length ?? 0;
  const preparingOrders = orders?.filter((o) => o.status === "preparing").length ?? 0;
  const outForDelivery = orders?.filter((o) => o.status === "out_for_delivery").length ?? 0;
  const activeOrders = pendingOrders + confirmedOrders + preparingOrders + outForDelivery;
  const todayRevenue = parseFloat(String(todaySummary?.today?.totalRevenue ?? 0));
  const yesterdayRevenue = parseFloat(String(todaySummary?.yesterday?.totalRevenue ?? 0));
  const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0;
  const todayOrders = todaySummary?.today?.totalOrders ?? 0;
  const yesterdayOrders = todaySummary?.yesterday?.totalOrders ?? 0;
  const ordersChange = yesterdayOrders > 0 ? ((todayOrders - yesterdayOrders) / yesterdayOrders * 100) : 0;
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const chartData = dailyRevenue?.map((d) => ({
    date: new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    isToday: d.date === todayStr,
    receita: parseFloat(String(d.totalRevenue ?? 0)),
    pedidos: d.totalOrders,
  })) ?? [];
  const totalPeriodo = chartData.reduce((s, d) => s + d.receita, 0);
  const mediaDiaria = chartData.length > 0 ? totalPeriodo / chartData.length : 0;
  const ticketMedio = todayOrders > 0 ? todayRevenue / todayOrders : 0;
  const initials = (name: string) => name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const catColors = ['#e05c5c','#c0392b','#e87070','#a93226','#f08080','#922b21','#f4a0a0','#7b241c'];
  const catTotal = topCategories?.reduce((s, c) => s + c.totalQuantity, 0) ?? 0;
  const pieData = topCategories?.map((c, i) => ({ name: c.categoryName, value: c.totalQuantity, fill: catColors[i % catColors.length] })) ?? [];
  const userName = user?.name ?? (user?.role === 'admin' ? 'Administrador' : 'Gerente');
  const firstNameOnly = userName.split(' ')[0];

  const filteredOrders = orders?.filter(o =>
    !searchQuery || o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || String(o.id).includes(searchQuery)
  ) ?? [];

  const handleRefresh = () => {
    utils.orders.list.invalidate();
    utils.reports.dailyRevenue.invalidate();
    utils.reports.todaySummary.invalidate();
  };

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e8ebf0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    padding: 20,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--admin-font)', color: 'var(--admin-text)' }}>
      {/* ── Topbar: saudação + busca ── */}
      <div style={{ ...cardStyle, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #e05c5c 0%, #c0392b 100%)' }}>
            {firstNameOnly.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Bem-vindo de volta</p>
            <p className="text-sm font-bold" style={{ color: 'var(--admin-text-heading)' }}>Olá, {firstNameOnly}!</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end" style={{ maxWidth: 400 }}>
          <div className="relative flex-1" style={{ maxWidth: 280 }}>
            <input
              type="text"
              placeholder="Buscar pedido ou cliente..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs rounded-lg pl-8 pr-3 py-2 outline-none"
              style={{ background: '#f0f2f5', border: '1px solid #e8ebf0', color: 'var(--admin-text)', height: 36 }}
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--admin-text-muted)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <button onClick={handleRefresh} className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: '#f0f2f5', border: '1px solid #e8ebf0', color: 'var(--admin-text-muted)' }}
            title="Atualizar">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── KPI Cards — 3 colunas com sparkline ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Receita Hoje',
            value: `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`,
            sub: revenueChange !== 0 ? `${revenueChange > 0 ? '+' : ''}${revenueChange.toFixed(0)}% vs ontem` : 'Mesmo que ontem',
            trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'neutral',
            dataKey: 'receita' as const,
          },
          {
            label: 'Pedidos Hoje',
            value: String(todayOrders),
            sub: ordersChange !== 0 ? `${ordersChange > 0 ? '+' : ''}${ordersChange.toFixed(0)}% vs ontem` : 'Mesmo que ontem',
            trend: ordersChange > 0 ? 'up' : ordersChange < 0 ? 'down' : 'neutral',
            dataKey: 'pedidos' as const,
          },
          {
            label: 'Ticket Médio',
            value: `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`,
            sub: `${activeOrders} pedido${activeOrders !== 1 ? 's' : ''} ativo${activeOrders !== 1 ? 's' : ''}`,
            trend: 'neutral' as const,
            dataKey: 'receita' as const,
          },
        ].map((kpi, ki) => (
          <div key={kpi.label} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 8px' }}>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--admin-text-muted)' }}>{kpi.label}</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--admin-text-heading)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {kpi.trend === 'up' && <TrendingUp className="w-3 h-3" style={{ color: '#16a34a' }} />}
                {kpi.trend === 'down' && <TrendingUp className="w-3 h-3 rotate-180" style={{ color: '#dc2626' }} />}
                <span className="text-[11px]" style={{ color: kpi.trend === 'up' ? '#16a34a' : kpi.trend === 'down' ? '#dc2626' : 'var(--admin-text-muted)' }}>{kpi.sub}</span>
              </div>
            </div>
            {/* Sparkline */}
            <div style={{ height: 52 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`sparkGrad${ki}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e05c5c" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#e05c5c" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey={kpi.dataKey} stroke="#e05c5c" strokeWidth={1.5} fill={`url(#sparkGrad${ki})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* ── Linha 2: Tabela de produtos (1/3) + Gráfico de linha (1/3) + Pedidos recentes (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tabela de produtos mais vendidos */}
        <div style={cardStyle}>
          <p className="text-sm font-bold mb-3" style={{ color: 'var(--admin-text-heading)' }}>Produtos mais vendidos</p>
          {!topProducts || topProducts.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--admin-text-muted)' }}>Sem dados disponíveis</p>
          ) : (
            <div className="space-y-0">
              {topProducts.slice(0, 10).map((product, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: i < topProducts.length - 1 ? '1px solid #f0f2f5' : 'none' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold w-5 text-right shrink-0" style={{ color: 'var(--admin-text-muted)' }}>{i + 1}</span>
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--admin-text-heading)' }}>{product.productName}</span>
                  </div>
                  <span className="text-xs font-bold shrink-0 ml-2" style={{ color: '#e05c5c' }}>{product.totalQuantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gráfico de linha — receita 7 dias */}
        <div style={cardStyle}>
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--admin-text-heading)' }}>Receita — 7 dias</p>
          <p className="text-[11px] mb-3" style={{ color: 'var(--admin-text-muted)' }}>Média diária: R$ {mediaDiaria.toFixed(2).replace('.', ',')}</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e05c5c" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#e05c5c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--admin-chart-tick)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--admin-chart-tick)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 11, background: '#fff', padding: '8px 12px' }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Receita']}
                />
                <Area type="monotone" dataKey="receita" stroke="#e05c5c" strokeWidth={2} fill="url(#gradLine)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={payload.isToday ? 4 : 2.5} fill="#e05c5c" stroke="white" strokeWidth={1.5} />;
                  }}
                  activeDot={{ r: 5, fill: '#e05c5c', stroke: 'white', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Sem dados no período</p>
            </div>
          )}
        </div>

        {/* Pedidos recentes */}
        <div style={cardStyle}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: 'var(--admin-text-heading)' }}>Pedidos recentes</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(224,92,92,0.10)', color: '#e05c5c' }}>
              {orders?.length ?? 0} total
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
          ) : filteredOrders.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--admin-text-muted)' }}>Nenhum pedido encontrado</p>
          ) : (
            <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 260 }}>
              {filteredOrders.slice(0, 15).map((order) => {
                const s = STATUS_LABELS[order.status];
                const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                return (
                  <div key={order.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#f8f9fb' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: 'rgba(224,92,92,0.12)', color: '#e05c5c' }}>
                      {initials(order.customerName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--admin-text-heading)' }}>{order.customerName}</p>
                      <p className="text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>
                        {elapsed < 60 ? `${elapsed}min` : `${Math.floor(elapsed / 60)}h`} atrás
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold font-mono" style={{ color: '#e05c5c' }}>R${parseFloat(order.total).toFixed(2).replace('.', ',')}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${s?.color}`}>{s?.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Linha 3: Gráfico de barras (pedidos/dia) + Donut de categorias ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de barras — pedidos por dia */}
        <div style={cardStyle}>
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--admin-text-heading)' }}>Pedidos por dia — 7 dias</p>
          <p className="text-[11px] mb-3" style={{ color: 'var(--admin-text-muted)' }}>Volume de pedidos no período</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--admin-chart-tick)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--admin-chart-tick)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 11, background: '#fff', padding: '8px 12px' }}
                  formatter={(v: number) => [v, 'Pedidos']}
                />
                <Bar dataKey="pedidos" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isToday ? '#c0392b' : '#e05c5c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Sem dados no período</p>
            </div>
          )}
        </div>

        {/* Donut de categorias */}
        <div style={cardStyle}>
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--admin-text-heading)' }}>Vendas por categoria</p>
          <p className="text-[11px] mb-3" style={{ color: 'var(--admin-text-muted)' }}>Distribuição dos últimos 7 dias</p>
          {!topCategories || topCategories.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>Sem dados disponíveis</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={38} paddingAngle={2}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} unid.`, '']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 11, background: '#fff', padding: '6px 10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {topCategories.slice(0, 6).map((cat, i) => {
                  const pct = catTotal > 0 ? Math.round((cat.totalQuantity / catTotal) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--admin-text-heading)' }}>{cat.categoryName}</span>
                        <span className="text-[11px] shrink-0 ml-1" style={{ color: 'var(--admin-text-muted)' }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: '#f0f2f5' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[i % catColors.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryDashboardTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId } = useAdminStore();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [periodDays, setPeriodDays] = useState<7 | 14 | 30>(14);
  const [timezoneOffset] = useState(() => new Date().getTimezoneOffset());

  const endDate = useMemo(() => new Date(), [periodDays]);
  const startDate = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (periodDays - 1));
    return date;
  }, [periodDays]);

  const { data: liveOrders, isLoading: loadingLive } = trpc.orders.list.useQuery(
    { limit: 400, storeId: selectedStoreId },
    { refetchInterval: 30000 }
  );
  const { data: periodOrders, isLoading: loadingPeriod } = trpc.orders.list.useQuery(
    { limit: 5000, storeId: selectedStoreId, startDate, endDate },
    { refetchInterval: 60000 }
  );
  const { data: overview, isLoading: loadingOverview } = trpc.analytics.salesOverview.useQuery(
    { startDate, endDate, storeId: selectedStoreId },
    { refetchInterval: 60000 }
  );
  const { data: series, isLoading: loadingSeries } = trpc.analytics.salesTimeSeries.useQuery(
    { startDate, endDate, storeId: selectedStoreId, timezoneOffset },
    { refetchInterval: 60000 }
  );
  const { data: recentOrders, isLoading: loadingRecent } = trpc.analytics.recentOrders.useQuery(
    { limit: 14, storeId: selectedStoreId },
    { refetchInterval: 30000 }
  );
  const { data: topProducts, isLoading: loadingProducts } = trpc.reports.topProducts.useQuery(
    { limit: 6, storeId: selectedStoreId, startDate, endDate },
    { refetchInterval: 60000 }
  );
  const { data: drivers } = trpc.drivers.list.useQuery(
    { storeId: selectedStoreId },
    { refetchInterval: 30000 }
  );

  const userName = user?.name ?? (user?.role === "admin" ? "Administrador" : "Gerente");
  const firstNameOnly = userName.split(" ")[0];

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #eadfdf",
    boxShadow: "0 16px 40px rgba(81, 15, 20, 0.06)",
    padding: 20,
  };

  const activeStatuses = new Set(["pending", "confirmed", "preparing", "out_for_delivery"]);
  const statusTone: Record<string, string> = {
    pending: "bg-[#fff2df] text-[#8a4c00]",
    confirmed: "bg-[#fce8e8] text-[#7d0f14]",
    preparing: "bg-[#f8d9d9] text-[#661014]",
    out_for_delivery: "bg-[#7d0f14] text-white",
    delivered: "bg-[#edf9f0] text-[#166534]",
    cancelled: "bg-[#f2f4f7] text-[#667085]",
  };
  const sourceLabels: Record<string, string> = {
    app: "App",
    ifood: "iFood",
    whatsapp: "WhatsApp",
    phone: "Telefone",
  };
  const serviceLabels: Record<string, string> = {
    delivery: "Delivery",
    pickup: "Retirada",
    dine_in: "Salao",
    counter: "Balcao",
  };
  const paymentLabels: Record<string, string> = {
    credit_card: "Cartao credito",
    debit_card: "Cartao debito",
    pix: "PIX",
    cash: "Dinheiro",
  };
  const chartPalette = ["#7d0f14", "#b42318", "#d92d20", "#f97066", "#fda29b", "#fecdc9"];
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  const formatCompactCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value || 0);
  const percentChange = (current: number, previous: number) => (previous > 0 ? ((current - previous) / previous) * 100 : 0);
  const safeMinutesDiff = (start?: string | number | Date | null, end?: string | number | Date | null) => {
    if (!start || !end) return null;
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
    return Math.round((endMs - startMs) / 60000);
  };
  const average = (values: number[]) => {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const activeOrders = useMemo(
    () => (liveOrders ?? []).filter((order) => activeStatuses.has(order.status)),
    [liveOrders]
  );
  const periodOrdersAll = periodOrders ?? [];
  const completedPeriodOrders = periodOrdersAll.filter((order) => order.status !== "cancelled");
  const deliveryOrders = completedPeriodOrders.filter((order) => order.serviceType === "delivery");
  const deliveredDeliveryOrders = deliveryOrders.filter((order) => order.status === "delivered");
  const cancelledOrders = periodOrdersAll.filter((order) => order.status === "cancelled");

  const queueNow = {
    pending: activeOrders.filter((order) => order.status === "pending").length,
    confirmed: activeOrders.filter((order) => order.status === "confirmed").length,
    preparing: activeOrders.filter((order) => order.status === "preparing").length,
    outForDelivery: activeOrders.filter((order) => order.status === "out_for_delivery").length,
  };
  const activeDrivers = drivers?.filter((driver) => driver.active).length ?? 0;
  const assignedDrivers = new Set(activeOrders.map((order) => order.driverId).filter(Boolean)).size;
  const loadPerDriver = activeDrivers > 0 ? activeOrders.length / activeDrivers : activeOrders.length;
  const criticalOrders = activeOrders
    .map((order) => ({
      ...order,
      ageMinutes: safeMinutesDiff(order.createdAt, new Date()) ?? 0,
    }))
    .filter((order) => order.ageMinutes >= 35)
    .sort((a, b) => b.ageMinutes - a.ageMinutes);

  const kitchenLeadTimes = completedPeriodOrders
    .map((order) => safeMinutesDiff(order.confirmedAt ?? order.createdAt, order.readyAt ?? order.outForDeliveryAt ?? order.deliveredAt))
    .filter((value): value is number => value !== null);
  const dispatchLeadTimes = deliveryOrders
    .map((order) => safeMinutesDiff(order.readyAt ?? order.preparingAt ?? order.confirmedAt ?? order.createdAt, order.outForDeliveryAt))
    .filter((value): value is number => value !== null);
  const endToEndLeadTimes = deliveredDeliveryOrders
    .map((order) => safeMinutesDiff(order.createdAt, order.deliveredAt))
    .filter((value): value is number => value !== null);
  const onTimeOrders = deliveredDeliveryOrders.filter((order) => {
    if (!order.predictedDeliveredAt || !order.deliveredAt) return false;
    return new Date(order.deliveredAt).getTime() <= new Date(order.predictedDeliveredAt).getTime();
  }).length;
  const onTimeBase = deliveredDeliveryOrders.filter((order) => order.predictedDeliveredAt && order.deliveredAt).length;

  const totalRevenue = Number(overview?.totalRevenue ?? 0);
  const totalOrders = Number(overview?.totalOrders ?? 0);
  const avgTicket = Number(overview?.avgTicket ?? 0);
  const todayRevenue = Number(overview?.todayRevenue ?? 0);
  const todayOrders = Number(overview?.todayOrders ?? 0);
  const prevRevenue = Number(overview?.prevTotalRevenue ?? 0);
  const prevOrders = Number(overview?.prevTotalOrders ?? 0);
  const revenueDelta = percentChange(totalRevenue, prevRevenue);
  const cancelRate = periodOrdersAll.length > 0 ? (cancelledOrders.length / periodOrdersAll.length) * 100 : 0;
  const deliveryShare = completedPeriodOrders.length > 0 ? (deliveryOrders.length / completedPeriodOrders.length) * 100 : 0;
  const criticalRate = activeOrders.length > 0 ? (criticalOrders.length / activeOrders.length) * 100 : 0;

  const chartData = (series ?? []).map((point) => ({
    date: new Date(`${point.date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    pedidos: point.totalOrders,
    receita: Number(point.totalRevenue ?? 0),
  }));
  const dailyAverageRevenue = chartData.length > 0 ? chartData.reduce((sum, point) => sum + point.receita, 0) / chartData.length : 0;

  const hourlyVolume = Array.from({ length: 24 }, (_, hour) => {
    const bucketOrders = completedPeriodOrders.filter((order) => {
      const orderHour = new Date(order.createdAt).toLocaleString("en-US", {
        hour: "2-digit",
        hour12: false,
        timeZone: "America/Sao_Paulo",
      });
      return Number(orderHour) === hour;
    });
    return {
      label: `${String(hour).padStart(2, "0")}h`,
      pedidos: bucketOrders.length,
      receita: bucketOrders.reduce((sum, order) => sum + Number(order.total), 0),
    };
  });

  const sourceMix = Object.entries(
    completedPeriodOrders.reduce<Record<string, { orders: number; revenue: number }>>((acc, order) => {
      const key = order.source ?? "app";
      const current = acc[key] ?? { orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += Number(order.total);
      acc[key] = current;
      return acc;
    }, {})
  )
    .map(([key, value], index) => ({
      key,
      label: sourceLabels[key] ?? key,
      orders: value.orders,
      revenue: value.revenue,
      fill: chartPalette[index % chartPalette.length],
    }))
    .sort((a, b) => b.orders - a.orders);

  const paymentMix = Object.entries(
    completedPeriodOrders.reduce<Record<string, number>>((acc, order) => {
      const key = order.paymentMethod;
      acc[key] = (acc[key] ?? 0) + Number(order.total);
      return acc;
    }, {})
  )
    .map(([key, revenue]) => ({
      key,
      label: paymentLabels[key] ?? key,
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const serviceMix = Object.entries(
    completedPeriodOrders.reduce<Record<string, number>>((acc, order) => {
      const key = order.serviceType;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([key, count]) => ({
      key,
      label: serviceLabels[key] ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const neighborhoodRows = Object.values(
    deliveredDeliveryOrders.reduce<Record<string, { name: string; orders: number; revenue: number; minutes: number[] }>>((acc, order) => {
      const key = order.deliveryNeighborhood?.trim() || order.deliveryCity?.trim() || "Sem bairro";
      const current = acc[key] ?? { name: key, orders: 0, revenue: 0, minutes: [] };
      current.orders += 1;
      current.revenue += Number(order.total);
      const cycle = safeMinutesDiff(order.createdAt, order.deliveredAt);
      if (cycle !== null) current.minutes.push(cycle);
      acc[key] = current;
      return acc;
    }, {})
  )
    .map((row) => ({
      ...row,
      avgMinutes: average(row.minutes),
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6);

  const filteredRecentOrders = (recentOrders ?? []).filter((order) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return (
      order.customerName.toLowerCase().includes(normalizedQuery) ||
      String(order.id).includes(normalizedQuery)
    );
  });

  const opsStatus =
    criticalRate >= 35 || cancelRate >= 8
      ? { label: "Operacao critica", tone: "bg-[#fef3f2] text-[#b42318]" }
      : criticalRate >= 15 || cancelRate >= 4
        ? { label: "Operacao em atencao", tone: "bg-[#fff7ed] text-[#c2410c]" }
        : { label: "Operacao saudavel", tone: "bg-[#ecfdf3] text-[#027a48]" };

  const handleRefresh = () => {
    utils.orders.list.invalidate();
    utils.analytics.salesOverview.invalidate();
    utils.analytics.salesTimeSeries.invalidate();
    utils.analytics.recentOrders.invalidate();
    utils.reports.topProducts.invalidate();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--admin-font)", color: "var(--admin-text)" }}>
      <div
        style={{
          ...cardStyle,
          padding: "18px 20px",
          background: "linear-gradient(135deg, rgba(125,15,20,0.97) 0%, rgba(79,9,13,0.96) 100%)",
          color: "#fff8f6",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Cockpit do delivery</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${opsStatus.tone}`}>
                  {opsStatus.label}
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                Ola, {firstNameOnly}. Aqui estao os sinais que pedem decisao rapida.
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-white/72">
                Fila ativa, risco de SLA, carga de motoboys, horarios quentes e bairros que mais puxam a operacao.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {[7, 14, 30].map((days) => {
                const active = periodDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setPeriodDays(days as 7 | 14 | 30)}
                    className="rounded-full px-3 py-1.5 text-xs font-bold transition-all"
                    style={{
                      background: active ? "#fff5f3" : "rgba(255,255,255,0.10)",
                      color: active ? "#7d0f14" : "#fff8f6",
                      border: active ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.16)",
                    }}
                  >
                    {days} dias
                  </button>
                );
              })}
              <button
                onClick={handleRefresh}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)" }}
                title="Atualizar dashboard"
              >
                <RefreshCw className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="relative w-full lg:w-[280px]">
              <input
                type="text"
                placeholder="Buscar pedido ou cliente..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-full border-0 bg-white/10 pl-9 pr-4 py-2.5 text-sm text-white outline-none placeholder:text-white/45"
              />
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Fila ativa",
            value: activeOrders.length,
            helper: `${queueNow.pending} aguardando · ${queueNow.preparing} em preparo`,
            icon: <ShoppingBag className="w-4 h-4" />,
            tone: "#7d0f14",
          },
          {
            label: "Pedidos em risco",
            value: criticalOrders.length,
            helper: criticalOrders.length > 0 ? `${criticalRate.toFixed(0)}% da fila acima de 35 min` : "Nenhum pedido critico agora",
            icon: <Clock className="w-4 h-4" />,
            tone: criticalOrders.length > 0 ? "#b42318" : "#027a48",
          },
          {
            label: "Motoboys ativos",
            value: activeDrivers,
            helper: `${assignedDrivers} com pedidos em rota`,
            icon: <Bike className="w-4 h-4" />,
            tone: "#7d0f14",
          },
          {
            label: "Carga por motoboy",
            value: `${loadPerDriver.toFixed(1)}x`,
            helper: activeDrivers > 0 ? `${queueNow.outForDelivery} pedidos em entrega` : "Sem motoboys ativos no momento",
            icon: <Zap className="w-4 h-4" />,
            tone: "#7d0f14",
          },
        ].map((item) => (
          <div key={item.label} style={cardStyle}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">{item.label}</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-[#2f090d]">{item.value}</p>
                <p className="mt-2 text-sm text-[#7d6669]">{item.helper}</p>
              </div>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: `${item.tone}14`, color: item.tone }}
              >
                {item.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Receita hoje",
            value: formatCompactCurrency(todayRevenue),
            helper: `${todayOrders} pedidos hoje`,
            trend: revenueDelta,
          },
          {
            label: "Receita do periodo",
            value: formatCompactCurrency(totalRevenue),
            helper: revenueDelta === 0 ? "Mesmo ritmo do periodo anterior" : `${revenueDelta > 0 ? "+" : ""}${revenueDelta.toFixed(1)}% vs periodo anterior`,
            trend: revenueDelta,
          },
          {
            label: "Ticket medio",
            value: formatCompactCurrency(avgTicket),
            helper: `${deliveryShare.toFixed(0)}% do volume vem de delivery`,
            trend: 0,
          },
          {
            label: "Cancelamento",
            value: `${cancelRate.toFixed(1)}%`,
            helper: `${cancelledOrders.length} cancelados em ${periodOrdersAll.length} pedidos`,
            trend: -cancelRate,
          },
        ].map((item) => (
          <div key={item.label} style={cardStyle}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">{item.label}</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-[#2f090d]">{item.value}</p>
                <p className="mt-2 text-sm text-[#7d6669]">{item.helper}</p>
              </div>
              <div className="mt-1">
                {item.trend > 0 && <ArrowUp className="w-4 h-4 text-[#027a48]" />}
                {item.trend < 0 && <ArrowDown className="w-4 h-4 text-[#b42318]" />}
                {item.trend === 0 && <Minus className="w-4 h-4 text-[#98a2b3]" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <div style={cardStyle}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Volume e receita</p>
              <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Ritmo do delivery no periodo</h3>
              <p className="mt-1 text-sm text-[#7d6669]">Media diaria de {formatCompactCurrency(dailyAverageRevenue)} e visao conjunta de pedidos e faturamento.</p>
            </div>
            <Badge className="rounded-full bg-[#fff1ef] text-[#7d0f14] border-0">{periodDays} dias</Badge>
          </div>

          {loadingSeries ? (
            <div className="mt-6 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full rounded-xl" />)}
            </div>
          ) : chartData.length === 0 ? (
            <div className="mt-6">
              <AdminEmptyState title="Sem dados para o periodo" description="Assim que entrarem pedidos, a curva de faturamento e volume aparece aqui." />
            </div>
          ) : (
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardDeliveryRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b42318" stopOpacity={0.26} />
                      <stop offset="95%" stopColor="#b42318" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1e6e6" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8a6f73" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#8a6f73" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#8a6f73" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid #f1e6e6", boxShadow: "0 18px 40px rgba(81,15,20,0.10)" }}
                    formatter={(value: number, name: string) => [name === "receita" ? formatCurrency(value) : value, name === "receita" ? "Receita" : "Pedidos"]}
                  />
                  <Bar yAxisId="left" dataKey="pedidos" radius={[8, 8, 0, 0]} maxBarSize={34} fill="#f4b8b0" />
                  <Area yAxisId="right" type="monotone" dataKey="receita" stroke="#b42318" strokeWidth={2.5} fill="url(#dashboardDeliveryRevenue)" />
                  <ReferenceLine yAxisId="right" y={dailyAverageRevenue} stroke="#7d0f14" strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Saude operacional</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Sinais que afetam atraso, experiencia e margem</h3>

          <div className="mt-6 grid grid-cols-1 gap-3">
            {[
              {
                label: "Tempo medio de cozinha",
                value: `${average(kitchenLeadTimes).toFixed(0)} min`,
                helper: "Do aceite ate ficar pronto ou sair da cozinha.",
                icon: <ChefHat className="w-4 h-4" />,
              },
              {
                label: "Tempo medio de despacho",
                value: `${average(dispatchLeadTimes).toFixed(0)} min`,
                helper: "Janela entre pronto e saida para entrega.",
                icon: <Package className="w-4 h-4" />,
              },
              {
                label: "Ponta a ponta do delivery",
                value: `${average(endToEndLeadTimes).toFixed(0)} min`,
                helper: "Tempo total do cliente fazendo o pedido ate a entrega.",
                icon: <Bike className="w-4 h-4" />,
              },
              {
                label: "No prazo previsto",
                value: onTimeBase > 0 ? `${((onTimeOrders / onTimeBase) * 100).toFixed(0)}%` : "--",
                helper: onTimeBase > 0 ? `${onTimeOrders} de ${onTimeBase} entregas com previsao` : "Ative previsao de entrega para medir SLA real.",
                icon: <Clock className="w-4 h-4" />,
              },
            ].map((row) => (
              <div key={row.label} className="rounded-2xl border border-[#f1e6e6] bg-[#fffaf9] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#7d0f14]">
                    {row.icon}
                    <span className="text-sm font-semibold text-[#3f1a1f]">{row.label}</span>
                  </div>
                  <span className="text-lg font-black tracking-[-0.03em] text-[#2f090d]">{row.value}</span>
                </div>
                <p className="mt-2 text-sm text-[#7d6669]">{row.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div style={cardStyle}>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Fila por etapa</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Onde a operacao esta prendendo agora</h3>
          <div className="mt-5 space-y-3">
            {[
              { label: "Aguardando aceite", value: queueNow.pending, color: "#f79009" },
              { label: "Confirmados", value: queueNow.confirmed, color: "#d92d20" },
              { label: "Em preparo", value: queueNow.preparing, color: "#b42318" },
              { label: "Em entrega", value: queueNow.outForDelivery, color: "#7d0f14" },
            ].map((row) => {
              const max = Math.max(activeOrders.length, 1);
              const width = `${(row.value / max) * 100}%`;
              return (
                <div key={row.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[#3f1a1f]">{row.label}</span>
                    <span className="text-sm font-bold text-[#2f090d]">{row.value}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#f5e9e8]">
                    <div className="h-full rounded-full" style={{ width, background: row.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={cardStyle}>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Mix de origem</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Quais canais estao puxando o volume</h3>
          {sourceMix.length === 0 ? (
            <div className="mt-6">
              <AdminEmptyState title="Sem pedidos para classificar" description="Quando o periodo tiver volume, os canais de origem aparecem aqui." />
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="h-[200px] w-full max-w-[220px] self-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceMix} dataKey="orders" nameKey="label" innerRadius={52} outerRadius={82} paddingAngle={2}>
                      {sourceMix.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 14, border: "1px solid #f1e6e6", boxShadow: "0 18px 40px rgba(81,15,20,0.10)" }}
                      formatter={(value: number, _name: string, payload: { payload?: { revenue: number } }) => [`${value} pedidos`, payload.payload ? formatCurrency(payload.payload.revenue) : ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-3">
                {sourceMix.map((row) => (
                  <div key={row.key} className="rounded-2xl border border-[#f1e6e6] bg-[#fffaf9] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.fill }} />
                        <span className="text-sm font-semibold text-[#3f1a1f]">{row.label}</span>
                      </div>
                      <span className="text-sm font-bold text-[#2f090d]">{row.orders} pedidos</span>
                    </div>
                    <p className="mt-1 text-sm text-[#7d6669]">{formatCompactCurrency(row.revenue)} em receita no periodo</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Fila critica</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Pedidos que podem explodir SLA</h3>
          {loadingLive ? (
            <div className="mt-6 space-y-2">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : criticalOrders.length === 0 ? (
            <div className="mt-6">
              <AdminEmptyState title="Fila sob controle" description="Nenhum pedido ativo ultrapassou 35 minutos neste momento." />
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {criticalOrders.slice(0, 6).map((order) => (
                <div key={order.id} className="rounded-2xl border border-[#f5d0cb] bg-[#fff6f4] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#2f090d]">#{order.id} · {order.customerName}</p>
                      <p className="mt-1 text-xs text-[#8a6f73]">{serviceLabels[order.serviceType] ?? order.serviceType} · {formatCompactCurrency(Number(order.total))}</p>
                    </div>
                    <span className="rounded-full bg-[#b42318] px-2.5 py-1 text-[11px] font-bold text-white">{order.ageMinutes} min</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone[order.status] ?? "bg-[#f2f4f7] text-[#667085]"}`}>
                      {STATUS_LABELS[order.status]?.label ?? order.status}
                    </span>
                    {order.deliveryNeighborhood && <span className="text-[11px] text-[#8a6f73]">{order.deliveryNeighborhood}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr_1fr]">
        <div style={cardStyle}>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Horario quente</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Quando o volume concentra</h3>
          {loadingPeriod ? (
            <div className="mt-6 space-y-2">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="mt-4 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyVolume} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1e6e6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8a6f73" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "#8a6f73" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid #f1e6e6", boxShadow: "0 18px 40px rgba(81,15,20,0.10)" }}
                    formatter={(value: number, _name: string, payload: { payload?: { receita: number } }) => [value, payload.payload ? formatCompactCurrency(payload.payload.receita) : ""]}
                  />
                  <Bar dataKey="pedidos" radius={[8, 8, 0, 0]} maxBarSize={22} fill="#b42318" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Bairros mais demandados</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Onde vale reforcar entrega e cobertura</h3>
          {neighborhoodRows.length === 0 ? (
            <div className="mt-6">
              <AdminEmptyState title="Sem historico de entrega" description="Os bairros aparecem quando houver pedidos delivery entregues no periodo." />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {neighborhoodRows.map((row) => (
                <div key={row.name} className="rounded-2xl border border-[#f1e6e6] bg-[#fffaf9] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#3f1a1f]">{row.name}</p>
                    <span className="text-sm font-black text-[#2f090d]">{row.orders} pedidos</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm text-[#7d6669]">
                    <span>{formatCompactCurrency(row.revenue)}</span>
                    <span>{row.avgMinutes ? `${row.avgMinutes.toFixed(0)} min medio` : "Sem SLA ainda"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Mix de pagamento e PMIX</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Leitura rapida de conversao e preferencia</h3>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a6f73]">Pagamento</p>
              <div className="mt-3 space-y-2">
                {paymentMix.slice(0, 4).map((row) => {
                  const share = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                  return (
                    <div key={row.key}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-[#3f1a1f]">{row.label}</span>
                        <span className="font-bold text-[#2f090d]">{share.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f5e9e8]">
                        <div className="h-full rounded-full bg-[#7d0f14]" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a6f73]">Itens que puxam volume</p>
              {loadingProducts ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-8 w-full rounded-xl" />)}
                </div>
              ) : !topProducts || topProducts.length === 0 ? (
                <p className="mt-3 text-sm text-[#7d6669]">Sem dados de produto neste periodo.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {topProducts.map((product, index) => (
                    <div key={`${product.productName}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[#f1e6e6] bg-[#fffaf9] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#3f1a1f]">{product.productName}</p>
                      </div>
                      <span className="text-sm font-black text-[#7d0f14]">{product.totalQuantity}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div style={cardStyle}>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Mix do servico</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Delivery versus retirada, balcao e salao</h3>
          {serviceMix.length === 0 ? (
            <div className="mt-6">
              <AdminEmptyState title="Sem pedidos no periodo" description="Assim que houver movimentacao, o mix operacional aparece aqui." />
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {serviceMix.map((row) => {
                const share = completedPeriodOrders.length > 0 ? (row.count / completedPeriodOrders.length) * 100 : 0;
                return (
                  <div key={row.key} className="rounded-2xl border border-[#f1e6e6] bg-[#fffaf9] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#3f1a1f]">{row.label}</p>
                      <span className="text-lg font-black text-[#2f090d]">{row.count}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#7d6669]">{share.toFixed(0)}% do volume no periodo</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#8a6f73]">Pedidos recentes</p>
              <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#2f090d]">Radar de atendimento para equipe e gerente</h3>
            </div>
            <Badge className="rounded-full bg-[#fff1ef] text-[#7d0f14] border-0">{filteredRecentOrders.length} visiveis</Badge>
          </div>

          {loadingRecent || loadingOverview ? (
            <div className="mt-6 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : filteredRecentOrders.length === 0 ? (
            <div className="mt-6">
              <AdminEmptyState title="Nada encontrado" description="Tente outro nome de cliente ou numero de pedido." />
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {filteredRecentOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-[#f1e6e6] bg-[#fffaf9] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#2f090d]">#{order.id} · {order.customerName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone[order.status] ?? "bg-[#f2f4f7] text-[#667085]"}`}>
                          {STATUS_LABELS[order.status]?.label ?? order.status}
                        </span>
                        <span className="text-[11px] text-[#8a6f73]">{paymentLabels[order.paymentMethod] ?? order.paymentMethod}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#7d0f14]">{formatCompactCurrency(Number(order.total))}</p>
                      <p className="mt-1 text-[11px] text-[#8a6f73]">
                        {new Date(order.createdAt).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderItemsExpand({ orderId }: { orderId: number }) {
  const { data, isLoading } = trpc.orders.byId.useQuery({ id: orderId });
  if (isLoading) return <div className="mt-3 text-xs text-muted-foreground">Carregando itens...</div>;
  if (!data?.items?.length) return <div className="mt-3 text-xs text-muted-foreground">Nenhum item encontrado</div>;
  return (
    <div className="mt-3 pt-3 border-t">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Itens do Pedido</p>
      <div className="space-y-1">
        {data.items.map((item) => (
          <div key={item.id} className="flex justify-between items-start text-sm">
            <div>
              <span className="font-medium">{item.quantity}x {item.productName}</span>
              {item.notes && <p className="text-xs text-muted-foreground mt-0.5">Obs: {item.notes}</p>}
            </div>
            <span className="font-bold text-primary shrink-0 ml-3">
              R$ {parseFloat(item.subtotal).toFixed(2).replace(".", ",")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnreadChatBadge({ orderId }: { orderId: number }) {
  const { data } = trpc.chat.unreadCount.useQuery({ orderId }, { refetchInterval: 15000 });
  const count = data?.count ?? 0;
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 bg-[#6E0D12] btn-bonatto text-white text-xs rounded-full px-2 py-0.5 font-bold">
      <MessageCircle className="w-3 h-3" />
      {count > 9 ? "9+" : count} nova{count !== 1 ? "s" : ""}
    </span>
  );
}

const STATUS_CHIPS = [
  { value: "all", label: "Todos", color: "bg-muted text-muted-foreground hover:bg-muted/80" },
  { value: "pending", label: "Aguardando", color: "bg-[#fff8f0] text-[#7a3a00] hover:bg-[#ffeedd]" },
  { value: "confirmed", label: "Confirmado", color: "bg-[#fce8e8] text-[#6E0D12] hover:bg-[#f9d0d0]" },
  { value: "preparing", label: "Preparando", color: "bg-[#f9d0d0] text-[#5a0a0f] hover:bg-[#f5b8b8]" },
  { value: "out_for_delivery", label: "Na Entrega", color: "bg-[#6E0D12] text-white hover:bg-[#5a0a0f]" },
  { value: "delivered", label: "Entregue", color: "bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]" },
  { value: "cancelled", label: "Cancelado", color: "bg-[#f5f5f5] text-[#6b7280] hover:bg-[#e5e7eb]" },
];

function ElapsedTime({ createdAt }: { createdAt: string | number | Date }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)), 60000);
    return () => clearInterval(t);
  }, [createdAt]);
  const isUrgent = elapsed >= 30;
  if (elapsed < 60) return <span className={`text-xs font-semibold ${isUrgent ? "text-[#6E0D12]" : "text-muted-foreground"}`}>⏱ há {elapsed}min</span>;
  return <span className="text-xs font-semibold text-muted-foreground">⏱ há {Math.floor(elapsed/60)}h{elapsed%60 > 0 ? ` ${elapsed%60}min` : ""}</span>;
}

// ─── KANBAN COLUMNS ──────────────────────────────────────────────────────────
const KANBAN_COLS_LIGHT = [
  { status: "pending",          label: "Aguardando",   bg: "bg-[#fff8f0]",  border: "border-[#f5c89a]",  text: "text-[#7a3a00]",  dot: "bg-[#f5a623]",  hideable: false },
  { status: "confirmed",        label: "Confirmado",   bg: "bg-[#fce8e8]",  border: "border-[#e8b4b8]",  text: "text-[#6E0D12]",  dot: "bg-[#9b1520]",  hideable: false },
  { status: "preparing",        label: "Preparando",   bg: "bg-[#f9d0d0]",  border: "border-[#e09090]",  text: "text-[#5a0a0f]",  dot: "bg-[#6E0D12]",  hideable: false },
  { status: "out_for_delivery", label: "Na Entrega",   bg: "bg-[#fce8e8]",  border: "border-[#6E0D12]",  text: "text-[#450709]",  dot: "bg-[#450709]",  hideable: false },
  { status: "delivered",        label: "Entregue",     bg: "bg-[#f0fdf4]",  border: "border-[#86efac]",  text: "text-[#166534]",  dot: "bg-[#22c55e]",  hideable: false },
  { status: "cancelled",        label: "Cancelado",    bg: "bg-[#f9fafb]",  border: "border-[#d1d5db]",  text: "text-[#6b7280]",  dot: "bg-[#9ca3af]",  hideable: true  },
];
const KANBAN_COLS_DARK = [
  { status: "pending",          label: "Aguardando",   bg: "bg-[#2a1a08]",  border: "border-[#5a3a10]",  text: "text-[#f5c89a]",  dot: "bg-[#f5a623]",  hideable: false },
  { status: "confirmed",        label: "Confirmado",   bg: "bg-[#2a0808]",  border: "border-[#5a1a1e]",  text: "text-[#f9a8a8]",  dot: "bg-[#f87171]",  hideable: false },
  { status: "preparing",        label: "Preparando",   bg: "bg-[#3a0c0c]",  border: "border-[#6a2020]",  text: "text-[#fca5a5]",  dot: "bg-[#ef4444]",  hideable: false },
  { status: "out_for_delivery", label: "Na Entrega",   bg: "bg-[#2a0808]",  border: "border-[#920000]",  text: "text-[#fca5a5]",  dot: "bg-[#dc2626]",  hideable: false },
  { status: "delivered",        label: "Entregue",     bg: "bg-[#052e16]",  border: "border-[#166534]",  text: "text-[#86efac]",  dot: "bg-[#22c55e]",  hideable: false },
  { status: "cancelled",        label: "Cancelado",    bg: "bg-[#1a1a1a]",  border: "border-[#3a3a3a]",  text: "text-[#9ca3af]",  dot: "bg-[#6b7280]",  hideable: true  },
];

function KanbanCard({ order, onOpen }: { order: any; onOpen: (o: any) => void }) {
  const isActive = ["pending","confirmed","preparing","out_for_delivery"].includes(order.status);
  return (
    <button
      type="button"
      onClick={() => onOpen(order)}
      className="w-full text-left rounded-xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-3 space-y-2 bg-white border-border"
    >
      <div className="flex items-center justify-between">
        <span className="font-black text-sm text-foreground">#{order.id}</span>
        <div className="flex items-center gap-1">
          {isActive && <UnreadChatBadge orderId={order.id} />}
          <ElapsedTime createdAt={order.createdAt} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {order.source === 'ifood' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ea1d2c] text-white leading-none">iF</span>
        )}
        <p className="font-semibold text-sm truncate">{order.customerName}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
        <span className="font-black text-sm text-primary">R$ {parseFloat(order.total).toFixed(2).replace(".",",")}</span>
      </div>
      {order.notes && (
        <p className="text-xs text-[#5a0a0f] bg-[#fdf5f5] rounded px-2 py-1 truncate">⚠️ {order.notes}</p>
      )}
    </button>
  );
}

function OrderDetailModal({ order, onClose, drivers }: { order: any; onClose: () => void; drivers: any[] }) {
  const utils = trpc.useUtils();
  const [selectedDriver, setSelectedDriver] = useState("");
  const [pixConfirmedLocally, setPixConfirmedLocally] = useState(order.paymentStatus === "paid");
  const s = STATUS_LABELS[order.status];
  const isActive = ["pending","confirmed","preparing","out_for_delivery"].includes(order.status);
  const pixNeedsReceipt = order.paymentMethod === "pix" && !pixConfirmedLocally;
  const activeDrivers = drivers?.filter(d => d.active) ?? [];
  const emitirNfce = trpc.nfce.emitir.useMutation({
    onSuccess: (data) => {
      utils.orders.list.invalidate();
      toast.success("NFC-e emitida com sucesso!");
      if (data.urlDanfe) window.open(data.urlDanfe, "_blank");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => { utils.orders.list.invalidate(); onClose(); toast.success("Status atualizado!"); },
    onError: (err) => toast.error(err.message),
  });
  const confirmPixReceived = trpc.orders.confirmPixReceived.useMutation({
    onSuccess: () => {
      setPixConfirmedLocally(true);
      utils.orders.list.invalidate();
      toast.success("PIX marcado como recebido!");
    },
    onError: (err) => toast.error(err.message),
  });
  const assignDriver = trpc.drivers.assignToOrder.useMutation({
    onSuccess: () => utils.orders.list.invalidate(),
    onError: () => toast.error("Erro ao atribuir motoboy"),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <span className="font-black text-xl">#{order.id}</span>
            <Badge className={`${s?.color} border-0`}>{s?.label}</Badge>
            {pixConfirmedLocally && (
              <Badge className="bg-[#f0fdf4] text-[#166534] border-0 text-xs gap-1"><CheckCircle className="w-3 h-3" />Pago</Badge>
            )}
            {pixNeedsReceipt && (
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs">PIX pendente</Badge>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-semibold">{order.customerName}</span></div>
            <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" /><span>{order.customerPhone}</span></div>
            <div className="flex items-center gap-1.5 col-span-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate">{order.deliveryAddress}</span></div>
            <div className="flex items-center gap-1.5 col-span-2 text-xs text-muted-foreground"><Clock className="w-3 h-3" /><span>{new Date(order.createdAt).toLocaleString("pt-BR")}</span><ElapsedTime createdAt={order.createdAt} /></div>
          </div>

          {order.notes && (
            <div className="p-3 bg-[#fdf5f5] border border-[#fce8e8] rounded-lg text-sm text-[#5a0a0f]">
              <strong>Obs:</strong> {order.notes}
            </div>
          )}

          {/* Order items */}
          <OrderItemsExpand orderId={order.id} />

          {/* Payment */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
            <span className="font-black text-lg text-primary">R$ {parseFloat(order.total).toFixed(2).replace(".",",")}</span>
          </div>

          {pixNeedsReceipt && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-bold">PIX aguardando confirmaÃ§Ã£o</p>
              <p className="mt-1 text-xs text-amber-800">Marque como recebido antes de enviar o pedido para preparo.</p>
              <Button
                type="button"
                size="sm"
                className="mt-3 bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => confirmPixReceived.mutate({ id: order.id })}
                disabled={confirmPixReceived.isPending}
              >
                {confirmPixReceived.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
                Marcar PIX recebido
              </Button>
            </div>
          )}

          {/* NFC-e */}
          {(order.status === "delivered" || order.status === "cancelled") && (
            <div className="pt-2 border-t">
              {order.nfceKey ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">NFC-e emitida</span>
                  {order.nfceUrl && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => window.open(order.nfceUrl, "_blank")}>
                      <FileText className="w-3 h-3" />Ver DANFE
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => emitirNfce.mutate({ orderId: order.id })}
                  disabled={emitirNfce.isPending}
                >
                  {emitirNfce.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Emitir NFC-e
                </Button>
              )}
            </div>
          )}

          {/* Chat */}
          {isActive && (
            <div>
              <OrderChat orderId={order.id} currentUserRole="admin" currentUserName="Bonatto Pizza" inline />
            </div>
          )}

          {/* Status Actions */}
          {s?.next && (
            <div className="pt-3 border-t space-y-2">
              {s.next === "out_for_delivery" && activeDrivers.length > 0 && (
                <div className="flex items-center gap-2">
                  <Bike className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Selecionar motoboy (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDrivers.map(d => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => {
                    if (s.next === "preparing" && pixNeedsReceipt) {
                      toast.error("Marque o PIX como recebido antes de preparar o pedido.");
                      return;
                    }
                    updateStatus.mutate({ id: order.id, status: s.next as any });
                    if (s.next === "out_for_delivery" && selectedDriver) {
                      assignDriver.mutate({ orderId: order.id, driverId: parseInt(selectedDriver) });
                    }
                  }}
                  disabled={updateStatus.isPending || (s.next === "preparing" && pixNeedsReceipt)}
                  className="gap-1.5"
                >
                  {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Avançar para: {STATUS_LABELS[s.next]?.label}
                </Button>
                {order.status !== "cancelled" && (
                  <Button size="sm" variant="outline"
                    onClick={() => updateStatus.mutate({ id: order.id, status: "cancelled" })}
                    disabled={updateStatus.isPending}
                    className="text-destructive hover:text-destructive border-destructive/30"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrdersTab({ onOpenOrder }: { onOpenOrder?: () => void }) {
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const { selectedStoreId } = useAdminStore();
  const { data: allOrders, isLoading } = trpc.orders.list.useQuery(
    { limit: 100, storeId: selectedStoreId },
    { refetchInterval: 15000 }
  );
  const { data: drivers } = trpc.drivers.list.useQuery({ storeId: selectedStoreId });

  // Filter by search
  const filteredOrders = allOrders?.filter(o => {
    const q = searchQuery.toLowerCase().trim();
    return !q || o.customerName?.toLowerCase().includes(q) || String(o.id).includes(q) || o.customerPhone?.includes(q);
  }) ?? [];

  // Group by status
  const byStatus = (status: string) => filteredOrders.filter(o => o.status === status);

  return (
    <AdminPage>
      <AdminTopbar
        title="Pedidos"
        subtitle={`${filteredOrders.length} pedido${filteredOrders.length !== 1 ? "s" : ""} encontrado${filteredOrders.length !== 1 ? "s" : ""}`}
        onRefresh={() => utils.orders.list.invalidate()}
        actions={
          <button
            type="button"
            onClick={() => setShowCancelled(v => !v)}
            data-active={showCancelled}
            className="admin-chip"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            {showCancelled ? "Ocultar cancelados" : "Mostrar cancelados"}
            <span className="rounded-full px-1.5 font-bold bg-black/5 dark:bg-white/10">
              {(allOrders?.filter(o => o.status === "cancelled").length ?? 0)}
            </span>
          </button>
        }
      />

      <div className="admin-toolbar">
        <AdminSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nome, telefone ou número do pedido..."
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
          {KANBAN_COLS_LIGHT.filter(col => !col.hideable || showCancelled).map(col => {
            const colOrders = byStatus(col.status);
            return (
              <div key={col.status} className={`rounded-xl border ${col.border} ${col.bg} flex flex-col min-h-[200px]`}>
                <div className={`flex items-center justify-between px-3 py-2.5 border-b ${col.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${col.text}`}>{col.label}</span>
                  </div>
                  <span className={`text-[11px] font-bold ${col.text} bg-white/70 rounded-full px-2 py-0.5`}>{colOrders.length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {colOrders.length === 0 ? (
                    <p className={`text-xs text-center py-6 ${col.text} opacity-50`}>Nenhum pedido</p>
                  ) : (
                    colOrders.map(order => (
                      <KanbanCard key={order.id} order={order} onOpen={(o) => { setSelectedOrder(o); onOpenOrder?.(); }} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          drivers={drivers ?? []}
        />
      )}
    </AdminPage>
  );
}

// ─── MENU TAB ─────────────────────────────────────────────────────────────────
function MenuTab() {
  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.listAll.useQuery();
  const { data: products, isLoading } = trpc.products.listAll.useQuery();
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState<"products" | "categories" | "slides" | "carousel">("products");
  const [form, setForm] = useState({
    categoryId: "",
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    featured: false,
  });
  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [catForm, setCatForm] = useState({ name: "", slug: "", description: "", sortOrder: "", icon: "", imageUrl: "" });
  const [magnificCategoryImages, setMagnificCategoryImages] = useState<MagnificCategoryImageAsset[]>([]);
  const [magnificIcons, setMagnificIcons] = useState<MagnificIconAsset[]>([]);
  const { data: storeSettings } = trpc.storeSettings.get.useQuery();
  const [pizzaMultiFlavorEnabled, setPizzaMultiFlavorEnabled] = useState(false);
  const [pizzaFlavorLimits, setPizzaFlavorLimits] = useState({
    small: 1,
    medium: 2,
    large: 2,
    family: 3,
  });

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setShowForm(false);
      setForm({ categoryId: "", name: "", description: "", price: "", imageUrl: "", featured: false });
      toast.success("Produto criado!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setEditingProduct(null);
      setShowForm(false);
      toast.success("Produto atualizado!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      toast.success("Produto removido!");
    },
    onError: (err) => toast.error(err.message),
  });

  const createCategoryMut = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.listAll.invalidate();
      utils.categories.list.invalidate();
      setShowCatForm(false);
      setCatForm({ name: "", slug: "", description: "", sortOrder: "", icon: "", imageUrl: "" });
      toast.success("Categoria criada!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCategoryMut = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.listAll.invalidate();
      utils.categories.list.invalidate();
      setEditingCat(null);
      setShowCatForm(false);
      toast.success("Categoria atualizada!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCategoryMut = trpc.categories.delete.useMutation({
    onSuccess: () => {
      utils.categories.listAll.invalidate();
      utils.categories.list.invalidate();
      toast.success("Categoria removida!");
    },
    onError: (err) => toast.error(err.message),
  });

  const [categoryImageUploading, setCategoryImageUploading] = useState(false);
  const categoryImageInputRef = useRef<HTMLInputElement>(null);
  const uploadCategoryImage = trpc.categories.uploadImage.useMutation({
    onSuccess: (data) => {
      setCatForm((current) => ({ ...current, imageUrl: data.url }));
      toast.success("Imagem da categoria enviada!");
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setCategoryImageUploading(false),
  });
  const handleCategoryImageFile = (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Maximo de 5MB.");
      return;
    }
    setCategoryImageUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = typeof ev.target?.result === "string" ? ev.target.result : "";
      const base64 = result.split(",")[1];
      if (!base64) {
        setCategoryImageUploading(false);
        toast.error("Nao foi possivel ler a imagem.");
        return;
      }
      uploadCategoryImage.mutate({
        base64,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const filteredProducts = selectedCatId
    ? products?.filter((p) => p.categoryId === selectedCatId)
    : products;

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([loadMagnificCategoryImages(), loadMagnificIcons()]).then((results) => {
      if (cancelled) return;
      setMagnificCategoryImages(results[0].status === "fulfilled" ? results[0].value : []);
      setMagnificIcons(results[1].status === "fulfilled" ? results[1].value : []);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryImageSuggestions = useMemo(() => {
    const categoryKey = `${catForm.name} ${catForm.slug}`.trim().toLowerCase();
    if (!categoryKey) return magnificCategoryImages.slice(0, 6);

    const matches = magnificCategoryImages.filter((asset) =>
      asset.categoryKeys.some((key) => categoryKey.includes(key.toLowerCase())),
    );

    return (matches.length > 0 ? matches : magnificCategoryImages).slice(0, 6);
  }, [catForm.name, catForm.slug, magnificCategoryImages]);

  const categoryIconSuggestions = useMemo(() => {
    const categoryKey = `${catForm.name} ${catForm.slug}`.trim().toLowerCase();
    if (!categoryKey) return magnificIcons.slice(0, 5);

    const matches = magnificIcons.filter((asset) => {
      const haystack = `${asset.label} ${asset.term} ${asset.fallbackIconKey ?? ""}`.toLowerCase();
      return categoryKey.split(/\s+/).some((token) => token && haystack.includes(token));
    });

    return (matches.length > 0 ? matches : magnificIcons).slice(0, 5);
  }, [catForm.name, catForm.slug, magnificIcons]);

  // Paginação de produtos
  useEffect(() => {
    const config = getPizzaFlavorConfig(storeSettings?.pizzaFlavorConfig);
    setPizzaMultiFlavorEnabled(config.enabled);
    setPizzaFlavorLimits(config.maxFlavorsBySize);
  }, [storeSettings?.pizzaFlavorConfig]);

  const savePizzaFlavorConfig = trpc.storeSettings.savePizzaFlavorConfig.useMutation({
    onSuccess: () => {
      utils.storeSettings.get.invalidate();
      toast.success("Configuracao de pizza por sabores salva!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSavePizzaFlavorConfig = () => {
    savePizzaFlavorConfig.mutate({
      enabled: pizzaMultiFlavorEnabled,
      pricingMode: "highest",
      maxFlavorsBySize: {
        small: clampFlavorCount(pizzaFlavorLimits.small),
        medium: clampFlavorCount(pizzaFlavorLimits.medium),
        large: clampFlavorCount(pizzaFlavorLimits.large),
        family: clampFlavorCount(pizzaFlavorLimits.family),
      },
    });
  };

  const PRODUCTS_PER_PAGE = 10;
  const [productPage, setProductPage] = useState(1);
  const totalProductPages = Math.max(1, Math.ceil((filteredProducts?.length ?? 0) / PRODUCTS_PER_PAGE));
  const paginatedProducts = filteredProducts?.slice(
    (productPage - 1) * PRODUCTS_PER_PAGE,
    productPage * PRODUCTS_PER_PAGE,
  );

  // Slides
  const { data: slides } = trpc.menuSlides.listAll.useQuery();
  const [showSlideForm, setShowSlideForm] = useState(false);
  const [editingSlide, setEditingSlide] = useState<any | null>(null);
  const [slideForm, setSlideForm] = useState({ title: "", subtitle: "", imageUrl: "", videoUrl: "", badgeText: "", ctaText: "", ctaLink: "", sortOrder: "" });
  const [slideImageUploading, setSlideImageUploading] = useState(false);
  const slideImageInputRef = useRef<HTMLInputElement>(null);
  const uploadSlideImage = trpc.menuSlides.uploadImage.useMutation({
    onSuccess: (data) => { setSlideForm((f) => ({ ...f, imageUrl: data.url })); toast.success("Imagem enviada!"); },
    onError: (e) => toast.error(e.message),
    onSettled: () => setSlideImageUploading(false),
  });
  const handleSlideImageFile = (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 5MB."); return; }
    setSlideImageUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadSlideImage.mutate({ base64, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif", fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  // Product image upload
  const [productImageUploading, setProductImageUploading] = useState(false);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const uploadProductImage = trpc.products.uploadImage.useMutation({
    onSuccess: (data) => { setForm((f) => ({ ...f, imageUrl: data.url })); toast.success("Imagem enviada!"); },
    onError: (e) => toast.error(e.message),
    onSettled: () => setProductImageUploading(false),
  });
  const handleProductImageFile = (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 5MB."); return; }
    setProductImageUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadProductImage.mutate({ base64, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif", fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const seedSlides = trpc.menuSlides.seed.useMutation({
    onSuccess: (r) => { utils.menuSlides.listAll.invalidate(); utils.menuSlides.list.invalidate(); toast.success(r.seeded ? `${r.count} slides padrão carregados!` : "Slides já existem."); },
    onError: (e) => toast.error(e.message),
  });
  const createSlide = trpc.menuSlides.create.useMutation({
    onSuccess: () => { utils.menuSlides.listAll.invalidate(); utils.menuSlides.list.invalidate(); setShowSlideForm(false); setSlideForm({ title: "", subtitle: "", imageUrl: "", videoUrl: "", badgeText: "", ctaText: "", ctaLink: "", sortOrder: "" }); toast.success("Slide criado!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateSlide = trpc.menuSlides.update.useMutation({
    onSuccess: () => { utils.menuSlides.listAll.invalidate(); utils.menuSlides.list.invalidate(); setEditingSlide(null); setShowSlideForm(false); toast.success("Slide atualizado!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSlide = trpc.menuSlides.delete.useMutation({
    onSuccess: () => { utils.menuSlides.listAll.invalidate(); utils.menuSlides.list.invalidate(); toast.success("Slide removido!"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSlideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      title: slideForm.title,
      subtitle: slideForm.subtitle || null,
      imageUrl: slideForm.imageUrl || null,
      videoUrl: slideForm.videoUrl || null,
      badgeText: slideForm.badgeText || null,
      ctaText: slideForm.ctaText || null,
      ctaLink: slideForm.ctaLink || null,
      sortOrder: slideForm.sortOrder ? parseInt(slideForm.sortOrder) : undefined,
    };
    if (editingSlide) updateSlide.mutate({ id: editingSlide.id, ...data });
    else createSlide.mutate(data);
  };

  const startEditSlide = (slide: any) => {
    setEditingSlide(slide);
    setSlideForm({ title: slide.title, subtitle: slide.subtitle ?? "", imageUrl: slide.imageUrl ?? "", videoUrl: slide.videoUrl ?? "", badgeText: slide.badgeText ?? "", ctaText: slide.ctaText ?? "", ctaLink: slide.ctaLink ?? "", sortOrder: String(slide.sortOrder ?? "") });
    setShowSlideForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct.mutate({
        id: editingProduct.id,
        name: form.name,
        description: form.description,
        price: form.price,
        imageUrl: form.imageUrl || undefined,
        featured: form.featured,
        categoryId: parseInt(form.categoryId),
      });
    } else {
      createProduct.mutate({
        categoryId: parseInt(form.categoryId),
        name: form.name,
        description: form.description,
        price: form.price,
        imageUrl: form.imageUrl || undefined,
        featured: form.featured,
      });
    }
  };

  const handleCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slugVal = catForm.slug || catForm.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (editingCat) {
      updateCategoryMut.mutate({
        id: editingCat.id,
        name: catForm.name,
        icon: catForm.icon || undefined,
        imageUrl: catForm.imageUrl || undefined,
        description: catForm.description || undefined,
        sortOrder: catForm.sortOrder ? parseInt(catForm.sortOrder) : undefined,
      });
    } else {
      createCategoryMut.mutate({
        name: catForm.name,
        slug: slugVal,
        icon: catForm.icon || undefined,
        imageUrl: catForm.imageUrl || undefined,
        description: catForm.description || undefined,
        sortOrder: catForm.sortOrder ? parseInt(catForm.sortOrder) : undefined,
      });
    }
  };

  const startEdit = (product: any) => {
    setEditingProduct(product);
    setForm({
      categoryId: String(product.categoryId),
      name: product.name,
      description: product.description ?? "",
      price: product.price,
      imageUrl: product.imageUrl ?? "",
      featured: product.featured,
    });
    setShowForm(true);
  };

  const startEditCat = (cat: any) => {
    setEditingCat(cat);
    setCatForm({
      name: cat.name,
      slug: cat.slug ?? "",
      description: cat.description ?? "",
      sortOrder: String(cat.sortOrder ?? ""),
      icon: cat.icon ?? "",
      imageUrl: cat.imageUrl ?? "",
    });
    setShowCatForm(true);
  };

  const menuSubTabs = [
    { id: "products" as const, label: "Produtos", count: products?.length ?? 0 },
    { id: "categories" as const, label: "Categorias", count: categories?.length ?? 0 },
    { id: "slides" as const, label: "Banners", count: slides?.length ?? 0 },
    { id: "carousel" as const, label: "Carrossel Hero", count: null as number | null },
  ];

  return (
    <AdminPage>
      <AdminTopbar
        title="Cardápio"
        subtitle="Produtos, categorias, banners e carrossel da página inicial"
        actions={
          <>
            {activeMenuTab === "products" && (
              <Button onClick={() => { setEditingProduct(null); setForm({ categoryId: "", name: "", description: "", price: "", imageUrl: "", featured: false }); setShowForm(true); setShowCatForm(false); }} className="gap-1.5 h-9 text-xs">
                <PlusCircle className="w-4 h-4" />
                Novo produto
              </Button>
            )}
            {activeMenuTab === "categories" && (
              <Button onClick={() => { setEditingCat(null); setCatForm({ name: "", slug: "", description: "", sortOrder: "", icon: "", imageUrl: "" }); setShowCatForm(true); setShowForm(false); }} className="gap-1.5 h-9 text-xs">
                <PlusCircle className="w-4 h-4" />
                Nova categoria
              </Button>
            )}
          </>
        }
      />

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--admin-divider)' }}>
        {menuSubTabs.map((t) => {
          const active = activeMenuTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveMenuTab(t.id)}
              className="relative px-4 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                color: active ? 'var(--admin-active-text)' : 'var(--admin-text-muted)',
              }}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span className="ml-1.5 text-[11px] opacity-70">({t.count})</span>
              )}
              {active && (
                <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full" style={{ background: 'var(--admin-active-text)' }} />
              )}
            </button>
          );
        })}
      </div>

      {activeMenuTab === "products" && (
        <>
          <Card className="border-primary/20 bg-gradient-to-br from-white to-[#fff7f7]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pizza com mais de um sabor</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ative o modo multi-sabor no cardapio e defina quantos sabores cada tamanho pode aceitar.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Liberar montagem por sabores</p>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, a pizza passa a abrir no modal com selecao configuravel de sabores.
                  </p>
                </div>
                <Switch
                  checked={pizzaMultiFlavorEnabled}
                  onCheckedChange={setPizzaMultiFlavorEnabled}
                  aria-label="Ativar pizza com mais de um sabor"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { key: "small", label: "Pequena" },
                  { key: "medium", label: "Media" },
                  { key: "large", label: "Grande" },
                  { key: "family", label: "Familia" },
                ].map((size) => (
                  <div key={size.key} className="space-y-1.5 rounded-2xl border border-border/70 bg-background/80 p-4">
                    <Label htmlFor={`pizza-flavors-${size.key}`}>{size.label}</Label>
                    <Input
                      id={`pizza-flavors-${size.key}`}
                      type="number"
                      min={1}
                      max={4}
                      value={pizzaFlavorLimits[size.key as keyof typeof pizzaFlavorLimits]}
                      onChange={(event) =>
                        setPizzaFlavorLimits((current) => ({
                          ...current,
                          [size.key]: clampFlavorCount(event.target.value),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">Quantidade maxima de sabores para este tamanho.</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Regra de preco</p>
                  <p className="text-xs text-muted-foreground">
                    O sistema usa automaticamente o sabor mais caro entre os escolhidos.
                  </p>
                </div>
                <Button
                  onClick={handleSavePizzaFlavorConfig}
                  disabled={savePizzaFlavorConfig.isPending}
                  className="gap-2"
                >
                  {savePizzaFlavorConfig.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar configuracao
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Product Form */}
          {showForm && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">{editingProduct ? "Editar Produto" : "Novo Produto"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Categoria *</label>
                    <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nome *</label>
                    <input
                      className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="Nome do produto"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">Descrição</label>
                    <textarea
                      className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={2}
                      placeholder="Descrição do produto"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Preço (R$) *</label>
                    <input
                      className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      required
                      placeholder="Ex: 59.90"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Imagem do Produto <span className="text-xs text-muted-foreground font-normal">(JPG, PNG, WebP — máx. 5MB)</span></label>
                    <div
                      className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                        productImageUploading ? "border-primary/50 bg-primary/5" : "border-input hover:border-primary/50 hover:bg-muted/30"
                      }`}
                      onClick={() => !productImageUploading && productImageInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleProductImageFile(f); }}
                    >
                      {form.imageUrl ? (
                        <div className="relative">
                          <img src={form.imageUrl} alt="Preview" className="w-full h-36 object-cover rounded-xl" />
                          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-white text-sm font-medium flex items-center gap-2"><Upload className="w-4 h-4" /> Trocar imagem</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                          {productImageUploading ? (
                            <><Loader2 className="w-7 h-7 animate-spin text-primary" /><span className="text-sm">Enviando imagem...</span></>
                          ) : (
                            <><ImageIcon className="w-7 h-7" /><span className="text-sm font-medium">Clique ou arraste uma imagem aqui</span><span className="text-xs">JPG, PNG ou WebP</span></>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      ref={productImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProductImageFile(f); e.target.value = ""; }}
                    />
                    <details className="mt-1">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ou cole uma URL de imagem</summary>
                      <input className="mt-1.5 w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
                    </details>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      id="featured"
                      checked={form.featured}
                      onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="featured" className="text-sm font-medium">Produto em destaque</label>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                      {(createProduct.isPending || updateProduct.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {editingProduct ? "Salvar Alterações" : "Criar Produto"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingProduct(null); }}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCatId(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedCatId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Todos
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCatId === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Products Table */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                  <tr className="admin-table-head">
                    <th className="text-left p-3">Produto</th>
                    <th className="text-left p-3 hidden md:table-cell">Categoria</th>
                    <th className="text-right p-3">Preço</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts?.map((product) => {
                        const cat = categories?.find((c) => c.id === product.categoryId);
                        return (
                          <tr key={product.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                    <ChefHat className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{product.name}</p>
                                  {product.featured && (
                                    <Badge className="bg-primary/10 text-primary border-0 text-xs mt-0.5">Destaque</Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 hidden md:table-cell text-muted-foreground">{cat?.name}</td>
                            <td className="p-3 text-right font-bold text-primary">
                              R$ {parseFloat(product.price).toFixed(2).replace(".", ",")}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => updateProduct.mutate({ id: product.id, active: !product.active })}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                                  product.active ? "bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]" : "bg-[#fce8e8] text-[#450709] hover:bg-[#f9d0d0]"
                                }`}
                                title={product.active ? "Clique para desativar" : "Clique para ativar"}
                              >
                                {product.active ? "✓ Ativo" : "✕ Inativo"}
                              </button>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => startEdit(product)}>
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm("Remover este produto?")) {
                                      deleteProduct.mutate({ id: product.id });
                                    }
                                  }}
                                >
                                  Remover
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              {totalProductPages > 1 && (
                <div className="flex justify-center py-4 border-t">
                  <JoinedPagination
                    currentPage={productPage}
                    totalPages={totalProductPages}
                    paginationItemsToDisplay={5}
                    onPageChange={setProductPage}
                  />
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {activeMenuTab === "categories" && (
        <>
          {/* Category Form */}
          {showCatForm && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">{editingCat ? "Editar Categoria" : "Nova Categoria"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCatSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-border bg-white">
                        <img
                          src={getCategoryImage({ ...(editingCat ?? {}), ...catForm })}
                          alt={catForm.name || "Preview da categoria"}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                        <div className="absolute bottom-2 left-2 rounded-full bg-white/90 p-1.5 shadow-sm">
                          {(() => {
                            const Icon = getCategoryIcon({ ...(editingCat ?? {}), ...catForm });
                            return <Icon className="h-4 w-4 text-primary" />;
                          })()}
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Preview da categoria</p>
                          <p className="text-xs text-muted-foreground">A mesma capa e o mesmo icone vao aparecer no cardapio e nas vitrines da loja.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" className="gap-2" onClick={() => categoryImageInputRef.current?.click()} disabled={categoryImageUploading}>
                            {categoryImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Enviar imagem
                          </Button>
                          {catForm.imageUrl && (
                            <Button type="button" variant="ghost" className="gap-2 text-muted-foreground" onClick={() => setCatForm((current) => ({ ...current, imageUrl: "" }))}>
                              <Trash2 className="h-4 w-4" />
                              Remover capa
                            </Button>
                          )}
                        </div>
                        <input
                          ref={categoryImageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) handleCategoryImageFile(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nome *</label>
                    <input
                      className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                      value={catForm.name}
                      onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                      required
                      placeholder="Ex: Pizzas Especiais"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Icone</label>
                    <Select value={catForm.icon || "__default__"} onValueChange={(value) => setCatForm({ ...catForm, icon: value === "__default__" ? "" : value })}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Escolha um icone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Automatico</SelectItem>
                        {CATEGORY_ICON_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="flex items-center gap-2">
                              <option.Icon className="h-4 w-4 text-primary" />
                              <span>{option.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categoryIconSuggestions.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                        {categoryIconSuggestions.map((asset) => {
                          const option = CATEGORY_ICON_OPTIONS.find((entry) => entry.value === asset.fallbackIconKey);
                          const IconComponent = option?.Icon;
                          const isSelected = catForm.icon === asset.fallbackIconKey;

                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => {
                                if (!asset.fallbackIconKey) return;
                                setCatForm((current) => ({ ...current, icon: asset.fallbackIconKey ?? current.icon }));
                              }}
                              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                                isSelected ? "border-primary bg-primary/5" : "border-border/70 bg-white"
                              }`}
                            >
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/20">
                                {asset.src ? (
                                  <img src={asset.src} alt={asset.label} className="h-5 w-5 object-contain" />
                                ) : IconComponent ? (
                                  <IconComponent className="h-4 w-4 text-primary" />
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{asset.label}</p>
                                <p className="truncate text-[11px] text-muted-foreground">Sugestao premium do pack Magnific</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ordem de exibicao</label>
                    <input
                      className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                      value={catForm.sortOrder}
                      onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value })}
                      type="number"
                      placeholder="Ex: 1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">URL da imagem</label>
                    <div className="flex gap-2">
                      <input
                        className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                        value={catForm.imageUrl}
                        onChange={(e) => setCatForm({ ...catForm, imageUrl: e.target.value })}
                        placeholder="https://..."
                      />
                      <Button type="button" variant="outline" className="shrink-0 gap-2" onClick={() => categoryImageInputRef.current?.click()} disabled={categoryImageUploading}>
                        <ImageIcon className="h-4 w-4" />
                        Buscar
                      </Button>
                    </div>
                    {categoryImageSuggestions.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 pt-2 lg:grid-cols-3">
                        {categoryImageSuggestions.map((asset) => {
                          const isSelected = catForm.imageUrl === asset.src;

                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => setCatForm((current) => ({ ...current, imageUrl: asset.src }))}
                              className={`overflow-hidden rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                                isSelected ? "border-primary shadow-sm ring-2 ring-primary/10" : "border-border/70 bg-white"
                              }`}
                            >
                              <img src={asset.src} alt={asset.label} className="h-24 w-full object-cover" />
                              <div className="space-y-1 p-2.5">
                                <p className="truncate text-sm font-medium text-foreground">{asset.label}</p>
                                <p className="truncate text-[11px] text-muted-foreground">Aplicar capa sugerida</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">Descricao</label>
                    <input
                      className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                      value={catForm.description}
                      onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                      placeholder="Descricao opcional"
                    />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" disabled={createCategoryMut.isPending || updateCategoryMut.isPending}>
                      {(createCategoryMut.isPending || updateCategoryMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {editingCat ? "Salvar alteracoes" : "Criar categoria"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowCatForm(false); setEditingCat(null); }}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Categories List */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-semibold">Categoria</th>
                      <th className="text-left p-3 font-semibold hidden sm:table-cell">Slug</th>
                      <th className="text-center p-3 font-semibold">Ordem</th>
                      <th className="text-center p-3 font-semibold">Status</th>
                      <th className="text-right p-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories?.map((cat) => {
                      const Icon = getCategoryIcon(cat);
                      return (
                        <tr key={cat.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-border bg-white">
                                <img src={getCategoryImage(cat)} alt={cat.name} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                                <div className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 p-1 shadow-sm">
                                  <Icon className="h-3.5 w-3.5 text-primary" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium">{cat.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{cat.description || "Sem descricao personalizada"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 hidden sm:table-cell text-muted-foreground text-xs font-mono">{cat.slug}</td>
                          <td className="p-3 text-center text-muted-foreground">{cat.sortOrder ?? "-"}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => updateCategoryMut.mutate({ id: cat.id, active: !cat.active })}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                                cat.active ? "bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]" : "bg-[#fce8e8] text-[#450709] hover:bg-[#f9d0d0]"
                              }`}
                            >
                              {cat.active ? "Ativa" : "Inativa"}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => startEditCat(cat)}>Editar</Button>
                              <Button
                                size="sm" variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => { if (confirm("Remover esta categoria? Os produtos nao serao excluidos.")) deleteCategoryMut.mutate({ id: cat.id }); }}
                              >
                                Remover
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
         </>
      )}

      {/* ── Slides Tab ── */}
      {activeMenuTab === "carousel" && (
        <CarouselAdminSection />
      )}

      {activeMenuTab === "slides" && (
        <div className="space-y-4">
          {/* Slide Form */}
          {showSlideForm && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">{editingSlide ? "Editar Slide" : "Novo Slide"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSlideSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">Título *</label>
                    <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={slideForm.title} onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })} required placeholder="Ex: 2 Pizzas por R$ 89,90!" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">Subtexto</label>
                    <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={slideForm.subtitle} onChange={(e) => setSlideForm({ ...slideForm, subtitle: e.target.value })} placeholder="Descrição curta do slide" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Badge (ex: 🔥 Promoção)</label>
                    <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={slideForm.badgeText} onChange={(e) => setSlideForm({ ...slideForm, badgeText: e.target.value })} placeholder="Texto do badge" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ordem</label>
                    <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" type="number" value={slideForm.sortOrder} onChange={(e) => setSlideForm({ ...slideForm, sortOrder: e.target.value })} placeholder="1, 2, 3..." />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">Imagem de Fundo <span className="text-xs text-muted-foreground font-normal">(JPG, PNG, WebP — proporção 16:9, máx. 5MB)</span></label>
                    {/* Upload area */}
                    <div
                      className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                        slideImageUploading ? "border-primary/50 bg-primary/5" : "border-input hover:border-primary/50 hover:bg-muted/30"
                      }`}
                      onClick={() => !slideImageUploading && slideImageInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleSlideImageFile(f); }}
                    >
                      {slideForm.imageUrl ? (
                        <div className="relative">
                          <img src={slideForm.imageUrl} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-white text-sm font-medium flex items-center gap-2"><Upload className="w-4 h-4" /> Trocar imagem</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                          {slideImageUploading ? (
                            <><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-sm">Enviando imagem...</span></>
                          ) : (
                            <><ImageIcon className="w-8 h-8" /><span className="text-sm font-medium">Clique ou arraste uma imagem aqui</span><span className="text-xs">JPG, PNG ou WebP — proporção 16:9 recomendada</span></>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      ref={slideImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSlideImageFile(f); e.target.value = ""; }}
                    />
                    {/* Fallback: URL manual */}
                    <details className="mt-1">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ou cole uma URL de imagem</summary>
                      <input className="mt-1.5 w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={slideForm.imageUrl} onChange={(e) => setSlideForm({ ...slideForm, imageUrl: e.target.value })} placeholder="https://..." />
                    </details>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">URL do Vídeo <span className="text-xs text-muted-foreground font-normal">(MP4, WebM ou YouTube — substitui a imagem)</span></label>
                    <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={slideForm.videoUrl} onChange={(e) => setSlideForm({ ...slideForm, videoUrl: e.target.value })} placeholder="https://... ou https://youtube.com/watch?v=..." />
                    {slideForm.videoUrl && slideForm.imageUrl && (
                      <p className="text-xs text-[#6E0D12]">⚠ O vídeo tem prioridade sobre a imagem quando ambos estão preenchidos.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Texto do Botão</label>
                    <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={slideForm.ctaText} onChange={(e) => setSlideForm({ ...slideForm, ctaText: e.target.value })} placeholder="Ex: Ver promoções" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Link do Botão</label>
                    <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={slideForm.ctaLink} onChange={(e) => setSlideForm({ ...slideForm, ctaLink: e.target.value })} placeholder="Ex: /cardapio" />
                  </div>
                  <div className="flex gap-2 sm:col-span-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => { setShowSlideForm(false); setEditingSlide(null); }}>Cancelar</Button>
                    <Button type="submit" disabled={createSlide.isPending || updateSlide.isPending}>{editingSlide ? "Salvar" : "Criar Slide"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Slides List */}
          <Card>
            <CardContent className="p-0">
              {!slides || slides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <span className="text-4xl">🎉</span>
                  <p className="text-sm">Nenhum slide cadastrado. Clique em "Carregar Padrões" ou crie um novo.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {slides.map((slide) => (
                    <div key={slide.id} className="flex items-center gap-3 p-4">
                      {/* Preview */}
                      <div
                        className="w-16 h-10 rounded-md flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                        style={{ background: slide.imageUrl ? `url(${slide.imageUrl}) center/cover` : "linear-gradient(135deg, #8b0000, #c0392b)" }}
                      >
                        {!slide.imageUrl && "🍕"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{slide.title}</p>
                        {slide.subtitle && <p className="text-xs text-muted-foreground truncate">{slide.subtitle}</p>}
                        <div className="flex items-center gap-2 mt-0.5">
                          {slide.badgeText && <span className="text-xs bg-[#fce8e8] text-[#5a0a0f] px-1.5 py-0.5 rounded">{slide.badgeText}</span>}
                          <span className="text-xs text-muted-foreground">Ordem: {slide.sortOrder}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => updateSlide.mutate({ id: slide.id, isActive: !slide.isActive })}
                          className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                            slide.isActive ? "bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]" : "bg-[#fce8e8] text-[#450709] hover:bg-[#f9d0d0]"
                          }`}
                        >
                          {slide.isActive ? "✓ Ativo" : "✕ Inativo"}
                        </button>
                        <Button size="sm" variant="ghost" onClick={() => startEditSlide(slide)}>Editar</Button>
                        <Button
                          size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Remover este slide?")) deleteSlide.mutate({ id: slide.id }); }}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminPage>
  );
}

// ─── CAROUSEL ADMIN SECTION ──────────────────────────────────────────────────
function CarouselAdminSection() {
  const utils = trpc.useUtils();
  const { data: images, isLoading } = trpc.carousel.listAll.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingImage, setEditingImage] = useState<any | null>(null);
  const [form, setForm] = useState({ imageUrl: "", title: "", sortOrder: "0" });
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadImage = trpc.carousel.uploadImage.useMutation();
  const createImage = trpc.carousel.create.useMutation({
    onSuccess: () => { utils.carousel.listAll.invalidate(); utils.carousel.list.invalidate(); setShowForm(false); setForm({ imageUrl: "", title: "", sortOrder: "0" }); toast.success("Imagem adicionada!"); },
    onError: (err) => toast.error(err.message),
  });
  const updateImage = trpc.carousel.update.useMutation({
    onSuccess: () => { utils.carousel.listAll.invalidate(); utils.carousel.list.invalidate(); setEditingImage(null); setShowForm(false); toast.success("Atualizado!"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteImage = trpc.carousel.delete.useMutation({
    onSuccess: () => { utils.carousel.listAll.invalidate(); utils.carousel.list.invalidate(); toast.success("Removido!"); },
    onError: (err) => toast.error(err.message),
  });

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 5MB."); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        const { url } = await uploadImage.mutateAsync({ base64, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif", fileName: file.name });
        setForm(f => ({ ...f, imageUrl: url }));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setUploading(false); toast.error("Erro no upload"); }
  };

  const startEdit = (img: any) => {
    setEditingImage(img);
    setForm({ imageUrl: img.imageUrl, title: img.title ?? "", sortOrder: String(img.sortOrder) });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { imageUrl: form.imageUrl, title: form.title || null, sortOrder: parseInt(form.sortOrder) || 0 };
    if (editingImage) {
      updateImage.mutate({ id: editingImage.id, ...data });
    } else {
      createImage.mutate(data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Imagens do Carrossel Hero</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie as imagens exibidas no carrossel da página inicial</p>
        </div>
        <Button size="sm" onClick={() => { setEditingImage(null); setForm({ imageUrl: "", title: "", sortOrder: String((images?.length ?? 0) + 1) }); setShowForm(true); }}>
          + Adicionar Imagem
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">{editingImage ? "Editar Imagem" : "Nova Imagem"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Imagem <span className="text-xs text-muted-foreground">(JPG, PNG, WebP — proporção 16:9, máx. 5MB)</span></label>
                <div
                  className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                    uploading ? "border-primary/50 bg-primary/5" : "border-input hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onClick={() => !uploading && inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                >
                  {form.imageUrl ? (
                    <div className="relative">
                      <img src={form.imageUrl} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-medium flex items-center gap-2"><Upload className="w-4 h-4" /> Trocar imagem</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                      {uploading ? (
                        <><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-sm">Enviando imagem...</span></>
                      ) : (
                        <><ImageIcon className="w-8 h-8" /><span className="text-sm font-medium">Clique ou arraste uma imagem aqui</span><span className="text-xs">JPG, PNG ou WebP — proporção 16:9 recomendada</span></>
                      )}
                    </div>
                  )}
                </div>
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                <details className="mt-1">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ou cole uma URL de imagem</summary>
                  <input className="mt-1.5 w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
                </details>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Legenda (opcional)</label>
                  <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Pizza Margherita" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ordem</label>
                  <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder="1, 2, 3..." />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingImage(null); }}>Cancelar</Button>
                <Button type="submit" disabled={!form.imageUrl || createImage.isPending || updateImage.isPending || uploading}>
                  {editingImage ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !images || images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <ImageIcon className="w-10 h-10 opacity-30" />
              <p className="text-sm">Nenhuma imagem no carrossel. Clique em "+ Adicionar Imagem" para começar.</p>
            </div>
          ) : (
            <div className="divide-y">
              {images.map((img) => (
                <div key={img.id} className="flex items-center gap-3 p-4">
                  <div className="w-20 h-12 rounded-md flex-shrink-0 overflow-hidden bg-muted">
                    <img src={img.imageUrl} alt={img.title ?? ""} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{img.title || <span className="text-muted-foreground italic">Sem legenda</span>}</p>
                    <p className="text-xs text-muted-foreground">Ordem: {img.sortOrder} · {img.active ? "✓ Ativo" : "✕ Inativo"}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => updateImage.mutate({ id: img.id, active: !img.active })}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                        img.active ? "bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]" : "bg-[#fce8e8] text-[#450709] hover:bg-[#f9d0d0]"
                      }`}
                    >
                      {img.active ? "✓ Ativo" : "✕ Inativo"}
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(img)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Remover esta imagem do carrossel?")) deleteImage.mutate({ id: img.id }); }}
                    >Remover</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── COUPONS TAB ──────────────────────────────────────────────────────────────
function CouponsTab() {
  const utils = trpc.useUtils();
  const { data: coupons, isLoading } = trpc.coupons.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    minOrderValue: "",
    maxUses: "",
  });

  const createCoupon = trpc.coupons.create.useMutation({
    onSuccess: () => {
      utils.coupons.list.invalidate();
      setShowForm(false);
      setForm({ code: "", discountType: "percentage", discountValue: "", minOrderValue: "", maxUses: "" });
      toast.success("Cupom criado!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCoupon = trpc.coupons.update.useMutation({
    onSuccess: () => {
      utils.coupons.list.invalidate();
      toast.success("Cupom atualizado!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCoupon.mutate({
      code: form.code.toUpperCase(),
      discountType: form.discountType,
      discountValue: form.discountValue,
      minOrderValue: form.minOrderValue || undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
    });
  };

  return (
    <AdminPage>
      <AdminTopbar
        title="Cupons"
        subtitle="Gerencie os códigos de desconto da loja"
        actions={
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5 h-9 text-xs">
            <PlusCircle className="w-4 h-4" />
            {showForm ? "Cancelar" : "Novo cupom"}
          </Button>
        }
      />

      {showForm && (
        <AdminSurface title="Criar cupom">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Código *</label>
                <input
                  className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background uppercase"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                  placeholder="DESCONTO10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo *</label>
                <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Valor do desconto *</label>
                <input
                  className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  required
                  placeholder={form.discountType === "percentage" ? "Ex: 10" : "Ex: 15.00"}
                  type="number"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pedido mínimo (R$)</label>
                <input
                  className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                  value={form.minOrderValue}
                  onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                  placeholder="Ex: 50.00"
                  type="number"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Limite de usos</label>
                <input
                  className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  placeholder="Sem limite"
                  type="number"
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={createCoupon.isPending} className="h-9">
                  {createCoupon.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Criar cupom
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="h-9">Cancelar</Button>
              </div>
            </form>
        </AdminSurface>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !coupons || coupons.length === 0 ? (
        <AdminSurface>
          <AdminEmptyState
            icon={<Tag className="w-8 h-8" />}
            title="Nenhum cupom cadastrado"
            description="Crie o primeiro código de desconto para oferecer aos clientes."
          />
        </AdminSurface>
      ) : (
        <AdminSurface flush>
          <div className="overflow-x-auto">
            <table className="admin-table w-full text-sm">
              <thead>
                <tr className="admin-table-head">
                  <th className="text-left">Código</th>
                  <th className="text-left">Desconto</th>
                  <th className="text-left hidden sm:table-cell">Usos</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="font-semibold font-mono" style={{ color: 'var(--admin-badge-text)' }}>{coupon.code}</td>
                    <td>
                      {coupon.discountType === "percentage"
                        ? `${parseFloat(coupon.discountValue)}%`
                        : `R$ ${parseFloat(coupon.discountValue).toFixed(2).replace(".", ",")}`}
                    </td>
                    <td className="hidden sm:table-cell" style={{ color: 'var(--admin-text-muted)' }}>
                      {coupon.usedCount}/{coupon.maxUses ?? "∞"}
                    </td>
                    <td className="text-center">
                      <AdminPill tone={coupon.active ? "success" : "danger"}>
                        {coupon.active ? "Ativo" : "Inativo"}
                      </AdminPill>
                    </td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => updateCoupon.mutate({ id: coupon.id, active: !coupon.active })}
                      >
                        {coupon.active ? "Desativar" : "Ativar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSurface>
      )}
    </AdminPage>
  );
}

// ─── REPORTS TAB ──────────────────────────────────────────────────────────────
function ReportsTab() {
  const [period, setPeriod] = useState<"7" | "14" | "30" | "90" | "custom">("30");
  const [customStartStr, setCustomStartStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customEndStr, setCustomEndStr] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, isManager, stores } = useAdminStore();
  const [timezoneOffset] = useState(() => new Date().getTimezoneOffset());

  const periodNum = period === "custom" ? 30 : Number(period);
  const { startDate, endDate } = useMemo(() => {
    if (period === "custom") {
      return {
        startDate: new Date(`${customStartStr}T00:00:00-03:00`),
        endDate: new Date(`${customEndStr}T23:59:59-03:00`),
      };
    }

    const end = new Date();
    const todayBrt = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const start = new Date(`${todayBrt}T00:00:00-03:00`);
    start.setDate(start.getDate() - periodNum);
    return { startDate: start, endDate: end };
  }, [customEndStr, customStartStr, period, periodNum]);

  const sendReport = trpc.system.sendDailyReport.useMutation({
    onSuccess: () => toast.success("Relatório enviado via WhatsApp!"),
    onError: (error) => toast.error(error.message),
  });

  const { data: overview, isLoading: loadingOverview } = trpc.analytics.salesOverview.useQuery({
    startDate,
    endDate,
    storeId: selectedStoreId,
  });
  const { data: series, isLoading: loadingSeries } = trpc.analytics.salesTimeSeries.useQuery({
    startDate,
    endDate,
    storeId: selectedStoreId,
    timezoneOffset,
  });
  const { data: recentOrders, isLoading: loadingRecent } = trpc.analytics.recentOrders.useQuery({
    limit: 8,
    storeId: selectedStoreId,
  });
  const { data: ordersInPeriod, isLoading: loadingOrders } = trpc.reports.ordersByPeriod.useQuery({
    startDate,
    endDate,
    storeId: selectedStoreId,
  });
  const { data: topProducts, isLoading: loadingProducts } = trpc.reports.topProducts.useQuery({
    limit: 8,
    startDate,
    endDate,
    storeId: selectedStoreId,
  });
  const { data: topCategories, isLoading: loadingCategories } = trpc.reports.topCategories.useQuery({
    startDate,
    endDate,
    storeId: selectedStoreId,
  });

  const isLoading =
    loadingOverview || loadingSeries || loadingRecent || loadingOrders || loadingProducts || loadingCategories;

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
  const formatPct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;
  const totalRevenue = Number(overview?.totalRevenue ?? 0);
  const totalOrders = Number(overview?.totalOrders ?? 0);
  const avgTicket = Number(overview?.avgTicket ?? 0);
  const previousRevenue = Number(overview?.prevTotalRevenue ?? 0);
  const previousOrders = Number(overview?.prevTotalOrders ?? 0);
  const revenueDelta = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  const ordersDelta = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0;
  const chartData =
    series?.map((day) => ({
      date: new Date(`${day.date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      receita: Number(day.totalRevenue ?? 0),
      pedidos: Number(day.totalOrders ?? 0),
    })) ?? [];
  const daysCount = Math.max(chartData.length, 1);
  const avgDailyRevenue = totalRevenue / daysCount;
  const avgDailyOrders = totalOrders / daysCount;
  const periodOrders = ordersInPeriod ?? [];

  const paymentLabels: Record<string, string> = {
    credit_card: "Crédito",
    debit_card: "Débito",
    pix: "PIX",
    cash: "Dinheiro",
  };
  const serviceLabels: Record<string, string> = {
    delivery: "Delivery",
    pickup: "Retirada",
    dine_in: "Salão",
    counter: "Balcão",
  };
  const statusLabels: Record<string, string> = {
    pending: "Aguardando",
    confirmed: "Confirmado",
    preparing: "Preparando",
    out_for_delivery: "Entrega",
    delivered: "Entregue",
    cancelled: "Cancelado",
  };

  const paymentMix = useMemo(() => {
    const map = new Map<string, { key: string; label: string; orders: number; revenue: number }>();
    for (const order of periodOrders) {
      const key = order.paymentMethod;
      const current = map.get(key) ?? {
        key,
        label: paymentLabels[key] ?? key,
        orders: 0,
        revenue: 0,
      };
      current.orders += 1;
      current.revenue += Number(order.total);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [periodOrders]);

  const serviceMix = useMemo(() => {
    const map = new Map<string, { key: string; label: string; orders: number; revenue: number }>();
    for (const order of periodOrders) {
      const key = order.serviceType;
      const current = map.get(key) ?? {
        key,
        label: serviceLabels[key] ?? key,
        orders: 0,
        revenue: 0,
      };
      current.orders += 1;
      current.revenue += Number(order.total);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [periodOrders]);

  const statusMix = useMemo(() => {
    const map = new Map<string, { key: string; label: string; orders: number }>();
    for (const order of periodOrders) {
      const key = order.status;
      const current = map.get(key) ?? {
        key,
        label: statusLabels[key] ?? key,
        orders: 0,
      };
      current.orders += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [periodOrders]);

  const hourMix = useMemo(() => {
    const map = new Map<number, { hour: number; orders: number; revenue: number }>();
    for (const order of periodOrders) {
      const hour = new Date(order.createdAt).toLocaleString("en-US", {
        hour: "2-digit",
        hour12: false,
        timeZone: "America/Sao_Paulo",
      });
      const key = Number(hour);
      const current = map.get(key) ?? { hour: key, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += Number(order.total);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [periodOrders]);

  const peakHour = hourMix[0];
  const bestDay = chartData.reduce<{ date: string; receita: number; pedidos: number } | null>(
    (best, current) => (best === null || current.receita > best.receita ? current : best),
    null,
  );
  const cancelledOrders = statusMix.find((entry) => entry.key === "cancelled")?.orders ?? 0;
  const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
  const deliveryRevenue = serviceMix.find((entry) => entry.key === "delivery")?.revenue ?? 0;
  const deliveryShare = totalRevenue > 0 ? (deliveryRevenue / totalRevenue) * 100 : 0;
  const pixRevenue = paymentMix.find((entry) => entry.key === "pix")?.revenue ?? 0;
  const pixShare = totalRevenue > 0 ? (pixRevenue / totalRevenue) * 100 : 0;
  const topCategoriesTotal = topCategories?.reduce((sum, item) => sum + item.totalQuantity, 0) ?? 0;
  const categoryColors = ["#6E0D12", "#a01218", "#d54b51", "#f28b82", "#9a3412", "#dc2626"];

  return (
    <AdminPage>
      <AdminTopbar
        title="Relatórios e inteligência"
        subtitle="Visão executiva para venda, operação e mix da loja por período."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9"
              disabled={sendReport.isPending}
              onClick={() => sendReport.mutate()}
            >
              {sendReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
              Enviar por WhatsApp
            </Button>
            <AdminChipGroup
              size="sm"
              value={period}
              onChange={(value) => setPeriod(value)}
              items={[
                { value: "7", label: "7d" },
                { value: "14", label: "14d" },
                { value: "30", label: "30d" },
                { value: "90", label: "90d" },
                { value: "custom", label: "Personalizado" },
              ]}
            />
          </>
        }
      />

      <AdminSurface>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <AdminSectionLabel>Filtro do relatório</AdminSectionLabel>
            {period === "custom" && (
              <>
                <input
                  type="date"
                  value={customStartStr}
                  onChange={(event) => setCustomStartStr(event.target.value)}
                  className="text-xs border rounded-lg px-2 py-1.5 outline-none h-9"
                  style={{
                    borderColor: "var(--admin-input-border)",
                    color: "var(--admin-text)",
                    background: "var(--admin-input-bg)",
                  }}
                />
                <span className="text-xs" style={{ color: "var(--admin-text-muted)" }}>até</span>
                <input
                  type="date"
                  value={customEndStr}
                  onChange={(event) => setCustomEndStr(event.target.value)}
                  className="text-xs border rounded-lg px-2 py-1.5 outline-none h-9"
                  style={{
                    borderColor: "var(--admin-input-border)",
                    color: "var(--admin-text)",
                    background: "var(--admin-input-bg)",
                  }}
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isManager ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fce8e8] border border-[#6E0D12]/20">
                <Store className="w-3.5 h-3.5 text-[#6E0D12]" />
                <span className="text-xs font-semibold text-[#6E0D12]">{selectedStoreName}</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-[#6E0D12]/30 text-[#6E0D12]/70 ml-1">
                  Sua unidade
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Unidade:</span>
                <Select
                  value={selectedStoreId ? String(selectedStoreId) : "all"}
                  onValueChange={(value) => setSelectedStoreId(value === "all" ? undefined : Number(value))}
                >
                  <SelectTrigger className="h-8 text-xs w-44 border-[#6E0D12]/30 focus:ring-[#6E0D12]/20">
                    <Store className="w-3.5 h-3.5 text-[#6E0D12] mr-1 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={String(store.id)}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Carregando
              </div>
            )}
          </div>
        </div>
      </AdminSurface>

      <AdminStatGrid className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat
          label="Receita do período"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="w-4 h-4" />}
          trend={revenueDelta > 0 ? "up" : revenueDelta < 0 ? "down" : "neutral"}
          trendLabel={previousRevenue > 0 ? formatPct(revenueDelta) : "Sem base"}
          sub={`Média diária ${formatCurrency(avgDailyRevenue)}`}
        />
        <AdminStat
          label="Pedidos no período"
          value={String(totalOrders)}
          icon={<ShoppingBag className="w-4 h-4" />}
          trend={ordersDelta > 0 ? "up" : ordersDelta < 0 ? "down" : "neutral"}
          trendLabel={previousOrders > 0 ? formatPct(ordersDelta) : "Sem base"}
          sub={`${avgDailyOrders.toFixed(1).replace(".", ",")} pedidos/dia`}
        />
        <AdminStat
          label="Ticket médio"
          value={formatCurrency(avgTicket)}
          icon={<TrendingUp className="w-4 h-4" />}
          sub={`${chartData.length || 0} dias analisados`}
        />
        <AdminStat
          label="Taxa de cancelamento"
          value={`${cancellationRate.toFixed(1).replace(".", ",")}%`}
          icon={<XCircle className="w-4 h-4" />}
          trend={cancellationRate > 8 ? "down" : cancellationRate > 0 ? "neutral" : "up"}
          sub={`${cancelledOrders} cancelado${cancelledOrders === 1 ? "" : "s"}`}
        />
      </AdminStatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.9fr] gap-4">
        <AdminSurface title="Evolução do período" subtitle="Receita e volume diário para leitura executiva rápida">
          {chartData.length === 0 ? (
            <AdminEmptyState
              icon={<BarChart3 className="w-8 h-8" />}
              title="Sem dados no período"
              description="Assim que houver vendas nessa janela, a evolução aparecerá aqui."
            />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6E0D12" stopOpacity={0.26} />
                    <stop offset="95%" stopColor="#6E0D12" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--admin-chart-tick)" }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "var(--admin-chart-tick)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `R$${value}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "var(--admin-chart-tick)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--admin-card-border)",
                    boxShadow: "var(--admin-tooltip-shadow)",
                    fontSize: 12,
                    background: "var(--admin-tooltip-bg)",
                    color: "var(--admin-text)",
                  }}
                  formatter={(value: number, key: string) =>
                    key === "receita"
                      ? [formatCurrency(value), "Receita"]
                      : [`${value} pedido${value === 1 ? "" : "s"}`, "Pedidos"]
                  }
                />
                <ReferenceLine yAxisId="left" y={avgDailyRevenue} stroke="#d7a5a8" strokeDasharray="4 4" />
                <Bar yAxisId="right" dataKey="pedidos" fill="#f5d6d8" radius={[6, 6, 0, 0]} maxBarSize={30} />
                <Area yAxisId="left" type="monotone" dataKey="receita" stroke="#6E0D12" strokeWidth={2.5} fill="url(#reportsRevenueFill)" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </AdminSurface>

        <AdminSurface title="Resumo executivo" subtitle="Atalhos que dono e gerente mais consultam">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#f0dfdb] bg-[#fff8f6] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7d0f14]">Melhor dia</p>
              <p className="mt-2 text-lg font-bold text-[#2f090d]">{bestDay?.date ?? "--"}</p>
              <p className="text-xs text-[#8d5c60]">{bestDay ? formatCurrency(bestDay.receita) : "Sem base"}</p>
            </div>
            <div className="rounded-2xl border border-[#f0dfdb] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7d0f14]">Pico de demanda</p>
              <p className="mt-2 text-lg font-bold text-[#2f090d]">
                {peakHour ? `${String(peakHour.hour).padStart(2, "0")}:00` : "--"}
              </p>
              <p className="text-xs text-[#8d5c60]">
                {peakHour ? `${peakHour.orders} pedidos na hora líder` : "Sem base"}
              </p>
            </div>
            <div className="rounded-2xl border border-[#f0dfdb] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7d0f14]">Peso do delivery</p>
              <p className="mt-2 text-lg font-bold text-[#2f090d]">{deliveryShare.toFixed(1).replace(".", ",")}%</p>
              <p className="text-xs text-[#8d5c60]">Participação na receita</p>
            </div>
            <div className="rounded-2xl border border-[#f0dfdb] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7d0f14]">Força do PIX</p>
              <p className="mt-2 text-lg font-bold text-[#2f090d]">{pixShare.toFixed(1).replace(".", ",")}%</p>
              <p className="text-xs text-[#8d5c60]">Participação na receita</p>
            </div>
          </div>
        </AdminSurface>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <AdminSurface title="Canais de venda" subtitle="Receita e volume por tipo de serviço">
          <div className="space-y-3">
            {serviceMix.length === 0 ? (
              <AdminEmptyState
                icon={<Truck className="w-8 h-8" />}
                title="Sem canais no período"
                description="Os canais aparecem quando houver pedidos."
              />
            ) : (
              serviceMix.map((entry) => {
                const share = totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={entry.key} className="rounded-2xl border border-[#f0dfdb] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#2f090d]">{entry.label}</p>
                        <p className="text-xs text-[#8d5c60]">{entry.orders} pedidos</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#7d0f14]">{formatCurrency(entry.revenue)}</p>
                        <p className="text-xs text-[#8d5c60]">{share.toFixed(1).replace(".", ",")}% da receita</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[#f4e7e8]">
                      <div className="h-full rounded-full bg-[#6E0D12]" style={{ width: `${Math.min(share, 100)}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </AdminSurface>

        <AdminSurface title="Pagamentos" subtitle="Como a receita está entrando">
          <div className="space-y-3">
            {paymentMix.length === 0 ? (
              <AdminEmptyState
                icon={<DollarSign className="w-8 h-8" />}
                title="Sem pagamentos no período"
                description="Os meios de pagamento serão exibidos conforme os pedidos entrarem."
              />
            ) : (
              paymentMix.map((entry) => {
                const share = totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={entry.key} className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0dfdb] bg-white p-3">
                    <div>
                      <p className="text-sm font-semibold text-[#2f090d]">{entry.label}</p>
                      <p className="text-xs text-[#8d5c60]">{entry.orders} pedidos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#7d0f14]">{formatCurrency(entry.revenue)}</p>
                      <AdminPill tone={entry.key === "pix" ? "brand" : "neutral"}>{share.toFixed(1).replace(".", ",")}%</AdminPill>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </AdminSurface>

        <AdminSurface title="Status do período" subtitle="Saúde operacional dos pedidos">
          <div className="space-y-3">
            {statusMix.length === 0 ? (
              <AdminEmptyState
                icon={<Clock className="w-8 h-8" />}
                title="Sem status para exibir"
                description="Os status aparecem conforme o fluxo de pedidos roda."
              />
            ) : (
              statusMix.map((entry) => {
                const share = totalOrders > 0 ? (entry.orders / totalOrders) * 100 : 0;
                const tone: "success" | "warning" | "danger" | "brand" | "neutral" =
                  entry.key === "delivered"
                    ? "success"
                    : entry.key === "cancelled"
                      ? "danger"
                      : entry.key === "pending" || entry.key === "preparing"
                        ? "warning"
                        : "brand";
                return (
                  <div key={entry.key} className="rounded-2xl border border-[#f0dfdb] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#2f090d]">{entry.label}</span>
                        <AdminPill tone={tone}>{entry.orders}</AdminPill>
                      </div>
                      <span className="text-xs text-[#8d5c60]">{share.toFixed(1).replace(".", ",")}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#f4e7e8]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(share, 100)}%`,
                          background:
                            entry.key === "delivered"
                              ? "#16a34a"
                              : entry.key === "cancelled"
                                ? "#dc2626"
                                : "#6E0D12",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </AdminSurface>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AdminSurface title="Produtos líderes" subtitle="Itens com maior tração no período selecionado">
          {topProducts && topProducts.length > 0 ? (
            <div className="space-y-2">
              {topProducts.map((product, index) => (
                <div key={`${product.productName}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0dfdb] px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fdf2f2] text-xs font-bold text-[#7d0f14]">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#2f090d]">{product.productName}</p>
                      <p className="text-xs text-[#8d5c60]">{product.totalQuantity} unidades</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-[#7d0f14]">{formatCurrency(Number(product.totalRevenue ?? 0))}</p>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState
              icon={<Package className="w-8 h-8" />}
              title="Sem produtos ranqueados"
              description="Assim que houver vendas no período, o ranking aparece aqui."
            />
          )}
        </AdminSurface>

        <AdminSurface title="Mix de categorias" subtitle="Participação das categorias no volume vendido">
          {topCategories && topCategories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-center">
              <div className="mx-auto">
                <PieChart width={220} height={220}>
                  <Pie
                    data={topCategories}
                    dataKey="totalQuantity"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={82}
                    innerRadius={48}
                    paddingAngle={3}
                  >
                    {topCategories.map((_, index) => (
                      <Cell key={`cat-${index}`} fill={categoryColors[index % categoryColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} itens`, name]}
                    contentStyle={{
                      background: "var(--admin-tooltip-bg)",
                      border: "1px solid var(--admin-card-border)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "var(--admin-text)",
                    }}
                  />
                </PieChart>
              </div>
              <div className="space-y-3">
                {topCategories.map((category, index) => {
                  const share = topCategoriesTotal > 0 ? (category.totalQuantity / topCategoriesTotal) * 100 : 0;
                  return (
                    <div key={`${category.categoryName}-${index}`} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: categoryColors[index % categoryColors.length] }}
                          />
                          <span className="truncate text-sm font-medium text-[#2f090d]">{category.categoryName}</span>
                        </div>
                        <span className="text-xs text-[#8d5c60]">
                          {category.totalQuantity} itens • {share.toFixed(1).replace(".", ",")}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f4e7e8]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(share, 100)}%`,
                            background: categoryColors[index % categoryColors.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <AdminEmptyState
              icon={<Tag className="w-8 h-8" />}
              title="Sem categorias no período"
              description="O mix aparece quando houver itens vendidos no período."
            />
          )}
        </AdminSurface>
      </div>

      <AdminSurface title="Últimos pedidos" subtitle="Feed rápido para cruzar números com operação real">
        {recentOrders && recentOrders.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {recentOrders.map((order) => {
              const statusMeta = STATUS_LABELS[order.status];
              return (
                <div key={order.id} className="rounded-2xl border border-[#f0dfdb] bg-white px-4 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#2f090d]">#{order.id} • {order.customerName}</p>
                      <p className="text-xs text-[#8d5c60]">
                        {new Date(order.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#7d0f14]">{formatCurrency(Number(order.total))}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta?.color ?? ""}`}>
                        {statusMeta?.label ?? order.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#8d5c60]">
                    <AdminPill tone="neutral">{paymentLabels[order.paymentMethod] ?? order.paymentMethod}</AdminPill>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <AdminEmptyState
            icon={<ShoppingBag className="w-8 h-8" />}
            title="Sem pedidos recentes"
            description="Quando os pedidos começarem a entrar, este feed vai acompanhar."
          />
        )}
      </AdminSurface>
    </AdminPage>
  );
}

// ─── PROMOTIONS TAB ───────────────────────────────────────────────────────────
function PromotionsTab() {
  const utils = trpc.useUtils();
  const { data: promotions, isLoading } = trpc.promotions.all.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", imageUrl: "", couponCode: "", endsAt: "" });

  const createPromotion = trpc.promotions.create.useMutation({
    onSuccess: () => { utils.promotions.all.invalidate(); setShowForm(false); setForm({ title: "", description: "", imageUrl: "", couponCode: "", endsAt: "" }); toast.success("Promoção criada!"); },
    onError: (e) => toast.error(e.message),
  });
  const updatePromotion = trpc.promotions.update.useMutation({
    onSuccess: () => { utils.promotions.all.invalidate(); toast.success("Promoção atualizada!"); },
    onError: (e) => toast.error(e.message),
  });
  const deletePromotion = trpc.promotions.delete.useMutation({
    onSuccess: () => { utils.promotions.all.invalidate(); toast.success("Promoção removida!"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminPage>
      <AdminTopbar
        title="Promoções"
        subtitle="Banners e ofertas especiais exibidos no site"
        actions={
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5 h-9 text-xs">
            <PlusCircle className="w-4 h-4" />
            {showForm ? "Cancelar" : "Nova promoção"}
          </Button>
        }
      />
      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nova Promoção</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createPromotion.mutate({ title: form.title, description: form.description || undefined, imageUrl: form.imageUrl || undefined, couponCode: form.couponCode || undefined, active: true, endsAt: form.endsAt ? new Date(form.endsAt) : undefined }); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></div>
                <div className="space-y-1.5"><Label>Cupom (opcional)</Label><Input value={form.couponCode} onChange={(e) => setForm((f) => ({ ...f, couponCode: e.target.value }))} placeholder="PROMO10" /></div>
                <div className="space-y-1.5"><Label>Imagem (URL)</Label><Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." /></div>
                <div className="space-y-1.5"><Label>Válido até</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <Button type="submit" disabled={createPromotion.isPending}>{createPromotion.isPending ? "Salvando..." : "Criar Promoção"}</Button>
            </form>
          </CardContent>
        </Card>
      )}
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid gap-4">
          {promotions?.map((promo) => (
            <Card key={promo.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  {promo.imageUrl && <img src={promo.imageUrl} alt={promo.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />}
                  <div>
                    <p className="font-bold">{promo.title}</p>
                    {promo.description && <p className="text-sm text-muted-foreground">{promo.description}</p>}
                    {promo.couponCode && <p className="text-xs font-mono text-primary mt-1">Cupom: {promo.couponCode}</p>}
                    {promo.endsAt && <p className="text-xs text-muted-foreground mt-0.5">Até {new Date(promo.endsAt).toLocaleDateString("pt-BR")}</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => updatePromotion.mutate({ id: promo.id, data: { active: !promo.active } })}>
                    {promo.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover promoção?")) deletePromotion.mutate({ id: promo.id }); }}>
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!promotions?.length && (
            <AdminSurface>
              <AdminEmptyState icon={<Gift className="w-8 h-8" />} title="Nenhuma promoção cadastrada" description="Crie banners e ofertas especiais para destacar no site." />
            </AdminSurface>
          )}
        </div>
      )}
    </AdminPage>
  );
}

// ─── RAFFLES TAB ──────────────────────────────────────────────────────────────
function RafflesTab() {
  const utils = trpc.useUtils();
  const { data: raffles, isLoading } = trpc.raffles.all.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", prize: "", imageUrl: "", endsAt: "" });
  const [viewEntries, setViewEntries] = useState<number | null>(null);
  const { data: entries } = trpc.raffles.entries.useQuery({ raffleId: viewEntries! }, { enabled: !!viewEntries });

  const createRaffle = trpc.raffles.create.useMutation({
    onSuccess: () => { utils.raffles.all.invalidate(); setShowForm(false); setForm({ title: "", description: "", prize: "", imageUrl: "", endsAt: "" }); toast.success("Sorteio criado!"); },
    onError: (e) => toast.error(e.message),
  });
  const drawWinner = trpc.raffles.draw.useMutation({
    onSuccess: (winner) => { utils.raffles.all.invalidate(); toast.success(winner ? `Vencedor: ${winner.userName}!` : "Nenhum participante."); },
    onError: (e) => toast.error(e.message),
  });
  const updateRaffle = trpc.raffles.update.useMutation({
    onSuccess: () => { utils.raffles.all.invalidate(); toast.success("Sorteio atualizado!"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminPage>
      <AdminTopbar
        title="Sorteios"
        subtitle="Crie e gerencie sorteios para os clientes"
        actions={
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5 h-9 text-xs">
            <PlusCircle className="w-4 h-4" />
            {showForm ? "Cancelar" : "Novo sorteio"}
          </Button>
        }
      />
      {showForm && (
        <Card>
          <CardHeader><CardTitle>Novo Sorteio</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createRaffle.mutate({ title: form.title, description: form.description || undefined, prize: form.prize, imageUrl: form.imageUrl || undefined, endsAt: form.endsAt ? new Date(form.endsAt) : undefined }); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></div>
                <div className="space-y-1.5"><Label>Prêmio *</Label><Input value={form.prize} onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))} required placeholder="Ex: Pizza Família Grátis" /></div>
                <div className="space-y-1.5"><Label>Imagem (URL)</Label><Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." /></div>
                <div className="space-y-1.5"><Label>Encerra em</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <Button type="submit" disabled={createRaffle.isPending}>{createRaffle.isPending ? "Salvando..." : "Criar Sorteio"}</Button>
            </form>
          </CardContent>
        </Card>
      )}
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid gap-4">
          {raffles?.map((raffle) => (
            <Card key={raffle.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-bold">{raffle.title}</p>
                    <p className="text-sm text-muted-foreground">Prêmio: <strong className="text-primary">{raffle.prize}</strong></p>
                    {raffle.endsAt && <p className="text-xs text-muted-foreground mt-0.5">Encerra: {new Date(raffle.endsAt).toLocaleDateString("pt-BR")}</p>}
                    {raffle.winnerName && <p className="text-sm font-bold text-[#166534] mt-1">🏆 Vencedor: {raffle.winnerName}</p>}
                  </div>
                  <Badge className={raffle.status === "active" ? "bg-[#fce8e8] text-[#6E0D12] border-0 font-semibold text-xs" : raffle.status === "drawn" ? "bg-[#f0fdf4] text-[#166534] border-0 font-semibold text-xs" : "bg-muted text-muted-foreground border-0 font-semibold text-xs"}>
                    {raffle.status === "active" ? "Ativo" : raffle.status === "drawn" ? "Sorteado" : "Fechado"}
                  </Badge>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setViewEntries(viewEntries === raffle.id ? null : raffle.id)}>
                    {viewEntries === raffle.id ? "Ocultar" : "Ver Participantes"}
                  </Button>
                  {raffle.status === "active" && (
                    <>
                      <Button size="sm" onClick={() => { if (confirm("Sortear vencedor agora?")) drawWinner.mutate({ raffleId: raffle.id }); }} disabled={drawWinner.isPending}>
                        🎲 Sortear Vencedor
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateRaffle.mutate({ id: raffle.id, data: { status: "closed" } })}>
                        Encerrar
                      </Button>
                    </>
                  )}
                </div>
                {viewEntries === raffle.id && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{entries?.length ?? 0} participante(s)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {entries?.map((e) => (
                        <span key={e.id} className="text-xs bg-muted rounded px-2 py-1">{e.userName}</span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!raffles?.length && (
            <AdminSurface>
              <AdminEmptyState icon={<Ticket className="w-8 h-8" />} title="Nenhum sorteio cadastrado" description="Crie sorteios para engajar e recompensar clientes fiéis." />
            </AdminSurface>
          )}
        </div>
      )}
    </AdminPage>
  );
}

// ─── UPSELLS TAB ──────────────────────────────────────────────────────────────
function UpsellsTab() {
  const utils = trpc.useUtils();
  const { data: upsells, isLoading } = trpc.upsells.all.useQuery();
  const { data: products } = trpc.products.list.useQuery({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ suggestedProductId: "", triggerProductId: "", type: "upsell" as "upsell" | "downsell", title: "", description: "", discountPercent: "0", triggerMinTotal: "" });

  const createUpsell = trpc.upsells.create.useMutation({
    onSuccess: () => { utils.upsells.all.invalidate(); setShowForm(false); setForm({ suggestedProductId: "", triggerProductId: "", type: "upsell", title: "", description: "", discountPercent: "0", triggerMinTotal: "" }); toast.success("Up-sell criado!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateUpsell = trpc.upsells.update.useMutation({
    onSuccess: () => { utils.upsells.all.invalidate(); toast.success("Up-sell atualizado!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteUpsell = trpc.upsells.delete.useMutation({
    onSuccess: () => { utils.upsells.all.invalidate(); toast.success("Up-sell removido!"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminPage>
      <AdminTopbar
        title="Up-sells & Down-sells"
        subtitle="Ofertas exibidas antes de finalizar o pedido no checkout"
        actions={
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5 h-9 text-xs">
            <PlusCircle className="w-4 h-4" />
            {showForm ? "Cancelar" : "Novo up-sell"}
          </Button>
        }
      />
      {showForm && (
        <Card>
          <CardHeader><CardTitle>Novo Up-sell / Down-sell</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!form.suggestedProductId) { toast.error("Selecione um produto"); return; }
              createUpsell.mutate({
                suggestedProductId: parseInt(form.suggestedProductId),
                triggerProductId: form.triggerProductId ? parseInt(form.triggerProductId) : undefined,
                type: form.type,
                title: form.title,
                description: form.description || undefined,
                discountPercent: parseFloat(form.discountPercent) || 0,
                triggerMinTotal: form.triggerMinTotal || undefined,
                active: true,
                sortOrder: 0,
              });
            }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Produto Sugerido *</Label>
                  <Select value={form.suggestedProductId} onValueChange={(v) => setForm((f) => ({ ...f, suggestedProductId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} — R$ {parseFloat(p.price).toFixed(2)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "upsell" | "downsell" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="upsell">Up-sell (produto complementar)</SelectItem><SelectItem value="downsell">Down-sell (alternativa mais barata)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Título da Oferta *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Ex: Adicione uma bebida!" /></div>
                <div className="space-y-1.5"><Label>Desconto (%)</Label><Input type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} /></div>
                <div className="space-y-1.5">
                  <Label>Produto Gatilho <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Select value={form.triggerProductId} onValueChange={(v) => setForm((f) => ({ ...f, triggerProductId: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Qualquer produto no carrinho" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Qualquer produto no carrinho</SelectItem>
                      {products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Só aparece quando este produto específico está no carrinho</p>
                </div>
                <div className="space-y-1.5"><Label>Pedido mínimo (R$)</Label><Input type="number" min="0" value={form.triggerMinTotal} onChange={(e) => setForm((f) => ({ ...f, triggerMinTotal: e.target.value }))} placeholder="0 = sempre mostrar" /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: Aproveite e adicione uma bebida gelada!" /></div>
              </div>
              <Button type="submit" disabled={createUpsell.isPending}>{createUpsell.isPending ? "Salvando..." : "Criar Up-sell"}</Button>
            </form>
          </CardContent>
        </Card>
      )}
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-3">
          {upsells?.map((u) => {
            const product = products?.find((p) => p.id === u.suggestedProductId);
            return (
              <Card key={u.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={u.type === "upsell" ? "bg-[#fce8e8] text-[#6E0D12] border-0 font-semibold text-xs" : "bg-[#fff8f0] text-[#7a3a00] border-0 font-semibold text-xs"}>
                        {u.type === "upsell" ? "Up-sell" : "Down-sell"}
                      </Badge>
                      <Badge className={u.active ? "bg-[#f0fdf4] text-[#166534] border-0 font-semibold text-xs" : "bg-muted text-muted-foreground border-0 font-semibold text-xs"}>
                        {u.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="font-bold">{u.title}</p>
                    <p className="text-sm text-muted-foreground">Sugerir: <strong>{product?.name ?? `ID ${u.suggestedProductId}`}</strong>{(u.discountPercent ?? 0) > 0 && ` · ${u.discountPercent}% off`}</p>
                    {u.triggerProductId && <p className="text-xs text-muted-foreground">Gatilho: {products?.find(p => p.id === u.triggerProductId)?.name ?? `Produto ID ${u.triggerProductId}`}</p>}
                    {u.triggerMinTotal && <p className="text-xs text-muted-foreground">Pedido mínimo: R$ {parseFloat(u.triggerMinTotal).toFixed(2)}</p>}
                    {u.description && <p className="text-xs text-muted-foreground italic">{u.description}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => updateUpsell.mutate({ id: u.id, data: { active: !u.active } })}>
                      {u.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover up-sell?")) deleteUpsell.mutate({ id: u.id }); }}>
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!upsells?.length && (
            <AdminSurface>
              <AdminEmptyState icon={<Zap className="w-8 h-8" />} title="Nenhum up-sell cadastrado" description="Crie ofertas para aumentar o ticket médio no checkout." />
            </AdminSurface>
          )}
        </div>
      )}
    </AdminPage>
  );
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────
function CustomerJourneyHistoryModal({ userId, userName, onClose }: { userId: number; userName: string; onClose: () => void }) {
  const { data: history, isLoading } = trpc.automations.getCustomerJourneyHistory.useQuery({ userId });
  const statusColors: Record<string, string> = {
    completed: "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]",
    running:   "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
    failed:    "bg-[#fce8e8] text-[#6E0D12] border-[#fca5a5]",
    cancelled: "bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]",
  };
  const statusLabels: Record<string, string> = { completed: "Concluída", running: "Em andamento", failed: "Falhou", cancelled: "Cancelada" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8ebf0]">
          <div>
            <h2 className="font-black text-[#1a1d23] text-base" style={{ fontFamily: "Poppins, sans-serif" }}>Jornadas de {userName}</h2>
            <p className="text-xs text-[#8a92a0] mt-0.5">Histórico de automações executadas para este cliente</p>
          </div>
          <button onClick={onClose} className="text-[#8a92a0] hover:text-[#1a1d23] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-[#f0f2f5]">
          {isLoading ? (
            <div className="py-10 text-center text-[#8a92a0] text-sm">Carregando...</div>
          ) : !history?.length ? (
            <div className="py-10 text-center text-[#8a92a0] text-sm">Nenhuma jornada executada para este cliente.</div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#1a1d23] text-sm truncate">{item.journeyName}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#8a92a0] mt-0.5 flex items-center gap-2">
                    <span>Passo {item.currentStep}</span>
                    <span className="text-[#e8ebf0]">·</span>
                    <span>{new Date(item.startedAt).toLocaleString("pt-BR")}</span>
                    {item.abGroup && <span className="bg-[#fdf2f2] text-[#6E0D12] text-[9px] font-bold px-1.5 py-0.5 rounded">Grupo {item.abGroup.toUpperCase()}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#e8ebf0] bg-[#f8fafc]">
          <button onClick={onClose} className="text-sm text-[#6E0D12] font-semibold hover:underline">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const utils = trpc.useUtils();
  const { data: userPage, isLoading } = trpc.adminUsers.list.useQuery();
  const [sendCouponForm, setSendCouponForm] = useState<{ userId: number; userName: string } | null>(null);
  const [couponForm, setCouponForm] = useState({ code: "", discountType: "percentage" as "percentage" | "fixed", discountValue: "", minOrderValue: "" });
  const [journeyHistoryUser, setJourneyHistoryUser] = useState<{ userId: number; userName: string } | null>(null);
  const users = userPage?.items ?? [];

  const sendCoupon = trpc.adminUsers.sendCoupon.useMutation({
    onSuccess: () => { utils.adminUsers.list.invalidate(); setSendCouponForm(null); setCouponForm({ code: "", discountType: "percentage", discountValue: "", minOrderValue: "" }); toast.success("Cupom enviado para o cliente!"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminPage>
      <AdminTopbar
        title="Usuários"
        subtitle="Clientes e administradores cadastrados"
      />

      {sendCouponForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle className="text-base">Enviar Cupom para {sendCouponForm.userName}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              sendCoupon.mutate({ userId: sendCouponForm.userId, code: couponForm.code.toUpperCase(), discountType: couponForm.discountType, discountValue: couponForm.discountValue, minOrderValue: couponForm.minOrderValue || undefined });
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Código *</Label><Input value={couponForm.code} onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value }))} required placeholder="PROMO10" /></div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={couponForm.discountType} onValueChange={(v) => setCouponForm((f) => ({ ...f, discountType: v as "percentage" | "fixed" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percentage">Percentual (%)</SelectItem><SelectItem value="fixed">Valor fixo (R$)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Valor *</Label><Input type="number" min="0" value={couponForm.discountValue} onChange={(e) => setCouponForm((f) => ({ ...f, discountValue: e.target.value }))} required /></div>
                <div className="space-y-1.5"><Label>Pedido mínimo (R$)</Label><Input type="number" min="0" value={couponForm.minOrderValue} onChange={(e) => setCouponForm((f) => ({ ...f, minOrderValue: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={sendCoupon.isPending}>{sendCoupon.isPending ? "Enviando..." : "Enviar Cupom"}</Button>
                <Button type="button" variant="ghost" onClick={() => setSendCouponForm(null)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <span>{userPage?.total ?? users.length} usuários encontrados</span>
                <span>Página {userPage?.page ?? 1} de {userPage?.totalPages ?? 1}</span>
              </div>
              <table className="w-full">
                <thead><tr className="admin-table-head"><th className="text-left p-3">Nome</th><th className="text-left p-3 hidden sm:table-cell">Email</th><th className="text-left p-3 hidden md:table-cell">Função</th><th className="text-left p-3 hidden md:table-cell">Cadastro</th><th className="text-right p-3">Ações</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{u.name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground hidden sm:table-cell">{u.email ?? "—"}</td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge className={u.role === "admin" ? "bg-[#fce8e8] text-[#6E0D12] border-0 font-semibold text-xs" : "bg-muted text-muted-foreground border-0 font-semibold text-xs"}>{u.role === "admin" ? "Admin" : "Cliente"}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-sm hidden md:table-cell">{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setSendCouponForm({ userId: u.id, userName: u.name ?? "Cliente" })}>
                            <Tag className="w-3.5 h-3.5 mr-1" />Cupom
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setJourneyHistoryUser({ userId: u.id, userName: u.name ?? "Cliente" })} className="border-[#e8ebf0] text-[#8a92a0] hover:text-[#1a1d23]">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1"><path d="M12 2v10l4 2"/><circle cx="12" cy="12" r="10"/></svg>
                            Jornadas
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && (
                <AdminEmptyState icon={<Users className="w-8 h-8" />} title="Nenhum usuário cadastrado" description="Assim que clientes se cadastrarem, eles aparecerão aqui." />
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {journeyHistoryUser && (
        <CustomerJourneyHistoryModal
          userId={journeyHistoryUser.userId}
          userName={journeyHistoryUser.userName}
          onClose={() => setJourneyHistoryUser(null)}
        />
      )}
    </AdminPage>
  );
}

function ClubTab() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.club.getAdminConfig.useQuery();
  const [form, setForm] = useState<ClubAdminConfig | null>(null);

  useEffect(() => {
    if (!config) return;
    setForm({
      ...config,
      highlightItems: [...config.highlightItems],
      plans: config.plans.map((plan) => ({ ...plan, benefits: [...plan.benefits] })),
    });
  }, [config]);

  const saveConfig = trpc.club.saveAdminConfig.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.club.getAdminConfig.invalidate(),
        utils.club.getPublicConfig.invalidate(),
        utils.club.getPlans.invalidate(),
        utils.club.getMyPlan.invalidate(),
      ]);
      toast.success("Configurações do clube salvas com sucesso.");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateField = <K extends keyof ClubAdminConfig,>(key: K, value: ClubAdminConfig[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const updatePlan = <K extends keyof ClubAdminPlan,>(planId: ClubAdminPlanId, key: K, value: ClubAdminPlan[K]) => {
    setForm((current) =>
      current
        ? {
            ...current,
            plans: current.plans.map((plan) => (plan.id === planId ? { ...plan, [key]: value } : plan)),
          }
        : current,
    );
  };

  const serializeLines = (items: string[]) => items.join("\n");
  const parseLines = (value: string) =>
    value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSave = () => {
    if (!form) return;
    saveConfig.mutate({
      ...form,
      highlightItems: form.highlightItems.length ? form.highlightItems : ["Benefício exclusivo"],
      plans: form.plans.map((plan) => ({
        ...plan,
        benefits: plan.benefits.length ? plan.benefits : ["Benefício do plano"],
      })),
    });
  };

  if (isLoading || !form) {
    return (
      <AdminPage>
        <AdminTopbar
          title="Clube"
          subtitle="Centralize textos, planos e benefícios do clube."
          actions={<Skeleton className="h-10 w-32 rounded-full" />}
        />
        <AdminSurface className="space-y-4">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </AdminSurface>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminTopbar
        title="Clube"
        subtitle="Tudo do clube agora sai desta configuração: home, checkout, página do clube e meu perfil."
        actions={
          <Button onClick={handleSave} disabled={saveConfig.isPending} className="gap-2">
            {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            Salvar clube
          </Button>
        }
      />

      <AdminStatGrid>
        <AdminStat label="Planos ativos" value={`${form.plans.length}`} />
        <AdminStat label="Benefícios de destaque" value={`${form.highlightItems.length}`} />
        <AdminStat
          label="Plano em destaque"
          value={form.plans.find((plan) => plan.id === form.popularPlanId)?.name ?? "Premium"}
        />
      </AdminStatGrid>

      <AdminSurface className="space-y-6">
        <Card className="rounded-3xl border-[#f0dfdb]">
          <CardHeader>
            <CardTitle className="text-lg">Conteúdo principal do clube</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="club-badge-label">Badge</Label>
              <Input id="club-badge-label" value={form.badgeLabel} onChange={(event) => updateField("badgeLabel", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="club-cta-label">CTA principal</Label>
              <Input id="club-cta-label" value={form.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="club-section-title">Título da vitrine</Label>
              <Input id="club-section-title" value={form.sectionTitle} onChange={(event) => updateField("sectionTitle", event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="club-section-subtitle">Subtítulo da vitrine</Label>
              <Textarea
                id="club-section-subtitle"
                rows={3}
                value={form.sectionSubtitle}
                onChange={(event) => updateField("sectionSubtitle", event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="club-disclaimer">Rodapé / disclaimer</Label>
              <Input id="club-disclaimer" value={form.disclaimer} onChange={(event) => updateField("disclaimer", event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="club-highlight-items">Benefícios em destaque</Label>
              <Textarea
                id="club-highlight-items"
                rows={4}
                value={serializeLines(form.highlightItems)}
                onChange={(event) => updateField("highlightItems", parseLines(event.target.value))}
              />
              <p className="text-xs text-muted-foreground">Um benefício por linha.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-[#f0dfdb]">
          <CardHeader>
            <CardTitle className="text-lg">Checkout e perfil</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="club-checkout-title">Título no checkout</Label>
              <Input id="club-checkout-title" value={form.checkoutTitle} onChange={(event) => updateField("checkoutTitle", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="club-profile-benefits-title">Título dos benefícios no perfil</Label>
              <Input
                id="club-profile-benefits-title"
                value={form.profileBenefitsTitle}
                onChange={(event) => updateField("profileBenefitsTitle", event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="club-checkout-subtitle">Subtítulo no checkout</Label>
              <Textarea
                id="club-checkout-subtitle"
                rows={2}
                value={form.checkoutSubtitle}
                onChange={(event) => updateField("checkoutSubtitle", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="club-checkout-discount-label">Label de desconto</Label>
              <Input
                id="club-checkout-discount-label"
                value={form.checkoutDiscountLabel}
                onChange={(event) => updateField("checkoutDiscountLabel", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="club-checkout-delivery-label">Label de frete grátis</Label>
              <Input
                id="club-checkout-delivery-label"
                value={form.checkoutDeliveryLabel}
                onChange={(event) => updateField("checkoutDeliveryLabel", event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="club-checkout-free-pizza-label">Mensagem da pizza grátis</Label>
              <Input
                id="club-checkout-free-pizza-label"
                value={form.checkoutFreePizzaLabel}
                onChange={(event) => updateField("checkoutFreePizzaLabel", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="club-profile-guest-title">Título para não assinante</Label>
              <Input
                id="club-profile-guest-title"
                value={form.profileGuestTitle}
                onChange={(event) => updateField("profileGuestTitle", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="club-profile-primary-action">CTA do perfil</Label>
              <Input
                id="club-profile-primary-action"
                value={form.profilePrimaryActionLabel}
                onChange={(event) => updateField("profilePrimaryActionLabel", event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="club-profile-guest-subtitle">Texto para convidar no perfil</Label>
              <Textarea
                id="club-profile-guest-subtitle"
                rows={3}
                value={form.profileGuestSubtitle}
                onChange={(event) => updateField("profileGuestSubtitle", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-[#f0dfdb]">
          <CardHeader>
            <CardTitle className="text-lg">Confirmação e planos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="club-success-title">Título de sucesso</Label>
                <Input id="club-success-title" value={form.successTitle} onChange={(event) => updateField("successTitle", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-popular-plan">Plano em destaque</Label>
                <Select value={form.popularPlanId} onValueChange={(value) => updateField("popularPlanId", value as ClubAdminPlanId)}>
                  <SelectTrigger id="club-popular-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {form.plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="club-success-subtitle">Texto de sucesso</Label>
                <Textarea
                  id="club-success-subtitle"
                  rows={3}
                  value={form.successSubtitle}
                  onChange={(event) => updateField("successSubtitle", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {form.plans.map((plan) => (
                <Card key={plan.id} className="rounded-3xl border-[#f0dfdb]">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3 text-base">
                      <span>{plan.name}</span>
                      {form.popularPlanId === plan.id && <Badge className="bg-[#7d0f14] text-white">Destaque</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`plan-name-${plan.id}`}>Nome</Label>
                      <Input id={`plan-name-${plan.id}`} value={plan.name} onChange={(event) => updatePlan(plan.id, "name", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`plan-badge-${plan.id}`}>Badge</Label>
                      <Input id={`plan-badge-${plan.id}`} value={plan.badge} onChange={(event) => updatePlan(plan.id, "badge", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`plan-price-${plan.id}`}>Preço mensal</Label>
                      <Input
                        id={`plan-price-${plan.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={plan.price}
                        onChange={(event) => updatePlan(plan.id, "price", Number(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`plan-discount-${plan.id}`}>Desconto (%)</Label>
                      <Input
                        id={`plan-discount-${plan.id}`}
                        type="number"
                        min="0"
                        max="100"
                        value={plan.discountPercent}
                        onChange={(event) => updatePlan(plan.id, "discountPercent", Number(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`plan-description-${plan.id}`}>Descrição</Label>
                      <Textarea
                        id={`plan-description-${plan.id}`}
                        rows={2}
                        value={plan.description}
                        onChange={(event) => updatePlan(plan.id, "description", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`plan-benefits-${plan.id}`}>Benefícios do plano</Label>
                      <Textarea
                        id={`plan-benefits-${plan.id}`}
                        rows={5}
                        value={serializeLines(plan.benefits)}
                        onChange={(event) => updatePlan(plan.id, "benefits", parseLines(event.target.value))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[#f0dfdb] px-4 py-3">
                      <div>
                        <p className="font-medium">Entrega grátis</p>
                        <p className="text-xs text-muted-foreground">Aplica frete zero quando o plano estiver ativo.</p>
                      </div>
                      <Switch checked={plan.freeDelivery} onCheckedChange={(checked) => updatePlan(plan.id, "freeDelivery", checked)} />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[#f0dfdb] px-4 py-3">
                      <div>
                        <p className="font-medium">Pizza grátis mensal</p>
                        <p className="text-xs text-muted-foreground">Libera o benefício mensal para o assinante.</p>
                      </div>
                      <Switch
                        checked={plan.freePizzaPerMonth}
                        onCheckedChange={(checked) => updatePlan(plan.id, "freePizzaPerMonth", checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </AdminSurface>
    </AdminPage>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
const DAY_NAMES_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type DaySchedule = { open: string; close: string } | null;

const DEFAULT_HOURS: Record<string, DaySchedule> = {
  "0": null,
  "1": { open: "18:00", close: "23:00" },
  "2": { open: "18:00", close: "23:00" },
  "3": { open: "18:00", close: "23:00" },
  "4": { open: "18:00", close: "23:00" },
  "5": { open: "18:00", close: "23:30" },
  "6": { open: "18:00", close: "23:30" },
};

function SettingsTab() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.storeSettings.getAdmin.useQuery();

  const [hours, setHours] = useState<Record<string, DaySchedule>>(DEFAULT_HOURS);
  const [cepInput, setCepInput] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [minOrder, setMinOrder] = useState("");

  // Initialize form from DB when data arrives (useEffect to avoid setState during render)
  useEffect(() => {
    if (!settings) return;
    const h = settings.storeHours ? JSON.parse(settings.storeHours) as Record<string, DaySchedule> : DEFAULT_HOURS;
    setHours(h);
    setCepInput(settings.deliveryCepPrefixes ? (JSON.parse(settings.deliveryCepPrefixes) as string[]).join("\n") : "");
    setWhatsapp(settings.whatsappNumber ?? "");
    setDeliveryFee(settings.deliveryFee ?? "");
    setMinOrder(settings.minOrderValue ?? "");
  }, [settings]);

  const save = trpc.storeSettings.save.useMutation({
    onSuccess: () => {
      utils.storeSettings.get.invalidate();
      utils.storeSettings.getAdmin.invalidate();
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleDay(dayKey: string) {
    setHours((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey] ? null : { open: "18:00", close: "23:00" },
    }));
  }

  function updateTime(dayKey: string, field: "open" | "close", value: string) {
    setHours((prev) => {
      const existing = prev[dayKey];
      if (!existing) return prev;
      return { ...prev, [dayKey]: { ...existing, [field]: value } };
    });
  }

  function handleSave() {
    const prefixes = cepInput
      .split(/[\n,;]+/)
      .map((s) => s.trim().replace(/\D/g, "").substring(0, 5))
      .filter((s) => s.length === 5);

    save.mutate({
      storeHours: hours,
      deliveryCepPrefixes: prefixes,
      whatsappNumber: whatsapp || undefined,
      deliveryFee: deliveryFee || undefined,
      minOrderValue: minOrder || undefined,
    });
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <AdminPage className="max-w-2xl">
      <AdminTopbar
        title="Configurações da loja"
        subtitle="Horários, entrega, contato e operação da loja"
      />

      {/* Horários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Horários de Funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const key = String(day);
            const schedule = hours[key];
            const isOpen = schedule !== null && schedule !== undefined;
            return (
              <div key={day} className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={`w-28 text-sm font-medium px-3 py-1.5 rounded-md border transition-colors ${
                    isOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-input"
                  }`}
                >
                  {DAY_NAMES_PT[day]}
                </button>
                {isOpen ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Abre</Label>
                      <Input
                        type="time"
                        value={schedule.open}
                        onChange={(e) => updateTime(key, "open", e.target.value)}
                        className="w-28 h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Fecha</Label>
                      <Input
                        type="time"
                        value={schedule.close}
                        onChange={(e) => updateTime(key, "close", e.target.value)}
                        className="w-28 h-8 text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Fechado</span>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-1">Clique no nome do dia para abrir/fechar.</p>
        </CardContent>
      </Card>

      {/* Área de Entrega */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Área de Entrega (CEPs)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Insira os <strong>prefixos de 5 dígitos</strong> dos CEPs atendidos, um por linha (ex: <code>37500</code>).
            O sistema aceita qualquer CEP que comece com esses prefixos.
          </p>
          <textarea
            value={cepInput}
            onChange={(e) => setCepInput(e.target.value)}
            rows={8}
            placeholder={"37500\n37501\n37502\n37503"}
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background font-mono resize-y"
          />
          <p className="text-xs text-muted-foreground">
            {cepInput.split(/[\n,;]+/).filter((s) => s.trim().replace(/\D/g, "").length === 5).length} prefixos configurados
          </p>
        </CardContent>
      </Card>

      {/* Contato e operação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Contato e Operação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>WhatsApp (com DDI)</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="5537999999999"
              />
              <p className="text-xs text-muted-foreground">Formato: 55 + DDD + número (sem espaços)</p>
            </div>
            <div className="space-y-1.5">
              <Label>Taxa de entrega (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="5.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pedido mínimo (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="30.00"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Métodos de pagamento, chave PIX, webhooks e disponibilidade online ficam na aba <strong>Pagamentos</strong>.
          </p>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={save.isPending}
        className="w-full sm:w-auto"
        size="lg"
      >
        {save.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
        ) : (
          <><Settings className="w-4 h-4 mr-2" />Salvar Configurações</>
        )}
      </Button>
    </AdminPage>
  );
}

function PaymentsTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.paymentSettings.getAdmin.useQuery();
  const [pixKey, setPixKey] = useState("");
  const [config, setConfig] = useState<{
    orders: {
      onlineEnabled: boolean;
      cardEnabled: boolean;
      pixEnabled: boolean;
      cashEnabled: boolean;
      pixMode: "dynamic_asaas" | "manual_key";
      savedCardsEnabled: boolean;
    };
    club: {
      enabled: boolean;
      checkoutMode: "manual_pix";
    };
    pix: {
      merchantName: string;
      merchantCity: string;
      instructions: string;
    };
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setPixKey(data.pixKey ?? "");
    setConfig(data.config);
  }, [data]);

  const save = trpc.paymentSettings.save.useMutation({
    onSuccess: () => {
      utils.paymentSettings.getAdmin.invalidate();
      utils.paymentSettings.getPublic.invalidate();
      utils.storeSettings.get.invalidate();
      toast.success("Pagamentos atualizados com sucesso!");
    },
    onError: (error) => toast.error(error.message),
  });

  function copyValue(value: string, label: string) {
    navigator.clipboard.writeText(value).then(() => {
      toast.success(`${label} copiado.`);
    }).catch(() => {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}.`);
    });
  }

  if (isLoading || !config || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <AdminPage className="max-w-5xl">
      <AdminTopbar
        title="Pagamentos"
        subtitle="Controle com segurança o checkout, o PIX e o clube sem expor credenciais do gateway no navegador."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Status das integrações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: "Stripe Checkout",
                ready: data.runtime.stripeReady,
                help: data.runtime.stripeReady ? "Chave secreta encontrada no servidor." : "Falta STRIPE_SECRET_KEY no ambiente.",
              },
              {
                label: "Webhook Stripe",
                ready: data.runtime.stripeWebhookReady,
                help: data.runtime.stripeWebhookReady ? "Assinatura do webhook configurada." : "Falta STRIPE_WEBHOOK_SECRET no ambiente.",
              },
              {
                label: "Asaas PIX automático",
                ready: data.runtime.asaasReady,
                help: data.runtime.asaasReady ? "Cobrança dinâmica pronta para pedidos." : "Falta ASAAS_API_KEY no ambiente.",
              },
              {
                label: "PIX manual da loja",
                ready: data.runtime.manualPixReady,
                help: data.runtime.manualPixReady ? "Chave PIX cadastrada para uso manual." : "Cadastre uma chave PIX abaixo para liberar o modo manual.",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-background px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.help}</p>
                  </div>
                  <Badge variant={item.ready ? "default" : "secondary"}>
                    {item.ready ? "Pronto" : "Pendente"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Webhooks e operação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook Stripe</Label>
              <div className="flex gap-2">
                <Input value={data.runtime.stripeWebhookUrl || "Configure PUBLIC_APP_URL para gerar a URL"} readOnly />
                <Button type="button" variant="outline" size="icon" onClick={() => copyValue(data.runtime.stripeWebhookUrl, "Webhook Stripe")} disabled={!data.runtime.stripeWebhookUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Webhook Asaas</Label>
              <div className="flex gap-2">
                <Input value={data.runtime.asaasWebhookUrl || "Configure PUBLIC_APP_URL para gerar a URL"} readOnly />
                <Button type="button" variant="outline" size="icon" onClick={() => copyValue(data.runtime.asaasWebhookUrl, "Webhook Asaas")} disabled={!data.runtime.asaasWebhookUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              As chaves de Stripe e Asaas ficam apenas nas variáveis do servidor. Esta tela controla disponibilidade, modo de PIX e instruções operacionais.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Checkout de pedidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
              <div>
                <p className="font-semibold">Receber pagamentos online</p>
                <p className="text-sm text-muted-foreground">Liga ou desliga cartão e PIX online no checkout.</p>
              </div>
              <Switch
                checked={config.orders.onlineEnabled}
                onCheckedChange={(checked) => setConfig((prev) => prev ? { ...prev, orders: { ...prev.orders, onlineEnabled: checked } } : prev)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Cartão</p>
                    <p className="text-sm text-muted-foreground">Checkout Stripe para crédito e débito.</p>
                  </div>
                  <Switch
                    checked={config.orders.cardEnabled}
                    onCheckedChange={(checked) => setConfig((prev) => prev ? { ...prev, orders: { ...prev.orders, cardEnabled: checked } } : prev)}
                    disabled={!config.orders.onlineEnabled}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Cartões salvos</p>
                    <p className="text-sm text-muted-foreground">Permite reuso seguro de métodos já tokenizados.</p>
                  </div>
                  <Switch
                    checked={config.orders.savedCardsEnabled}
                    onCheckedChange={(checked) => setConfig((prev) => prev ? { ...prev, orders: { ...prev.orders, savedCardsEnabled: checked } } : prev)}
                    disabled={!config.orders.onlineEnabled || !config.orders.cardEnabled}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">PIX</p>
                    <p className="text-sm text-muted-foreground">PIX automático por gateway ou manual da loja.</p>
                  </div>
                  <Switch
                    checked={config.orders.pixEnabled}
                    onCheckedChange={(checked) => setConfig((prev) => prev ? { ...prev, orders: { ...prev.orders, pixEnabled: checked } } : prev)}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Dinheiro</p>
                    <p className="text-sm text-muted-foreground">Mostra opção de pagamento na entrega.</p>
                  </div>
                  <Switch
                    checked={config.orders.cashEnabled}
                    onCheckedChange={(checked) => setConfig((prev) => prev ? { ...prev, orders: { ...prev.orders, cashEnabled: checked } } : prev)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Modo do PIX no checkout</Label>
              <Select
                value={config.orders.pixMode}
                onValueChange={(value: "dynamic_asaas" | "manual_key") =>
                  setConfig((prev) => prev ? { ...prev, orders: { ...prev.orders, pixMode: value } } : prev)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha como o PIX deve funcionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic_asaas">PIX automático via Asaas</SelectItem>
                  <SelectItem value="manual_key">PIX manual com chave da loja</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                No modo automático o sistema cria cobrança dinâmica. No manual ele gera QR/copia e cola usando a chave cadastrada abaixo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PIX e clube</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome do recebedor no PIX</Label>
                <Input
                  value={config.pix.merchantName}
                  onChange={(e) => setConfig((prev) => prev ? { ...prev, pix: { ...prev.pix, merchantName: e.target.value } } : prev)}
                  maxLength={25}
                  placeholder="Bonatto Pizza"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade do PIX</Label>
                <Input
                  value={config.pix.merchantCity}
                  onChange={(e) => setConfig((prev) => prev ? { ...prev, pix: { ...prev.pix, merchantCity: e.target.value.toUpperCase() } } : prev)}
                  maxLength={15}
                  placeholder="MATEUS LEME"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Chave PIX da loja</Label>
              <Input
                type="password"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="email, CPF, CNPJ, telefone ou chave aleatória"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Essa chave é tratada como dado sensível e não aparece no endpoint público do site.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Instruções exibidas no checkout</Label>
              <Textarea
                value={config.pix.instructions}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, pix: { ...prev.pix, instructions: e.target.value } } : prev)}
                rows={4}
                placeholder="Ex: após pagar, envie o comprovante no WhatsApp para agilizar a conferência."
              />
            </div>

            <div className="rounded-2xl border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Assinaturas do clube</p>
                  <p className="text-sm text-muted-foreground">Mantém o fluxo de assinatura disponível para os planos ativos.</p>
                </div>
                <Switch
                  checked={config.club.enabled}
                  onCheckedChange={(checked) => setConfig((prev) => prev ? { ...prev, club: { ...prev.club, enabled: checked } } : prev)}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Modo atual: PIX manual. Mais gateways podem ser adicionados depois sem reabrir a estrutura do admin.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate({ config, pixKey })}
          disabled={save.isPending}
          size="lg"
          className="min-w-52"
        >
          {save.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
          ) : (
            <><DollarSign className="w-4 h-4 mr-2" />Salvar pagamentos</>
          )}
        </Button>
      </div>
    </AdminPage>
  );
}

// ─── DRIVERS TAB ─────────────────────────────────────────────────────────────
function DriversTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId } = useAdminStore();
  const { data: drivers, isLoading } = trpc.drivers.list.useQuery({ storeId: selectedStoreId });
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<number | null>(null);
  const [newTokens, setNewTokens] = useState<Record<number, string>>({});

  const createMutation = trpc.drivers.create.useMutation({
    onSuccess: (data) => {
      // Store the token temporarily so admin can copy it
      setNewTokens((prev) => ({ ...prev, [data.id]: data.accessToken }));
      setNewName("");
      setNewPhone("");
      setShowForm(false);
      utils.drivers.list.invalidate();
      toast.success("Motoboy cadastrado!", { description: "Copie o token e envie para o motoboy." });
    },
    onError: () => toast.error("Erro ao cadastrar motoboy"),
  });

  const updateMutation = trpc.drivers.update.useMutation({
    onSuccess: () => {
      utils.drivers.list.invalidate();
      toast.success("Motoboy atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar motoboy"),
  });

  const deleteMutation = trpc.drivers.delete.useMutation({
    onSuccess: () => {
      utils.drivers.list.invalidate();
      toast.success("Motoboy removido!");
    },
    onError: () => toast.error("Erro ao remover motoboy"),
  });

  const handleCopyToken = (token: string, id: number) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
    toast.success("Token copiado!");
  };

  const appUrl = `${window.location.origin}/motoboy`;

  return (
    <AdminPage>
      <AdminTopbar
        title="Motoboys"
        subtitle="Gerencie os entregadores e seus tokens de acesso"
        actions={
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5 h-9 text-xs">
            <PlusCircle className="w-4 h-4" />
            {showForm ? "Cancelar" : "Novo motoboy"}
          </Button>
        }
      />

      {/* App Link */}
      <Card className="border border-[#ead7d1] bg-[#fdf5f5] shadow-[0_8px_24px_rgba(110,13,18,0.06)]">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-semibold text-sm">Link do App do Motoboy</p>
              <p className="text-muted-foreground text-xs mt-0.5 break-all">{appUrl}</p>
              <p className="text-muted-foreground text-xs mt-1">Envie este link para o motoboy abrir no celular.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-primary/30 text-primary hover:bg-primary/5"
              onClick={() => { navigator.clipboard.writeText(appUrl); toast.success("Link copiado!"); }}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New Driver Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastrar Novo Motoboy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do motoboy"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(35) 99999-9999"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate({ name: newName, phone: newPhone || undefined })}
                disabled={!newName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cadastrar"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drivers List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !drivers || drivers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bike className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum motoboy cadastrado.</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>Cadastrar primeiro motoboy</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {drivers.map((driver) => (
            <Card key={driver.id} className={driver.active ? "" : "opacity-60"}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${driver.active ? "bg-[#fce8e8]" : "bg-zinc-100"}`}>
                    <Bike className={`w-5 h-5 ${driver.active ? "text-[#6E0D12]" : "text-zinc-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{driver.name}</p>
                      <Badge variant={driver.active ? "default" : "secondary"} className="text-xs">
                        {driver.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {driver.phone && (
                      <div className="flex items-center gap-1 text-muted-foreground text-sm mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{driver.phone}</span>
                      </div>
                    )}

                    {/* Show new token if just created */}
                    {newTokens[driver.id] && (
                      <div className="mt-2 p-2 bg-[#fce8e8] border border-[#e8b4b8] rounded-lg">
                        <p className="text-[#5a0a0f] text-xs font-medium mb-1">Token de acesso (copie agora!):</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-[#450709] bg-[#f9d0d0] px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                            {newTokens[driver.id]}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 h-7 text-xs border-[#e8b4b8]"
                            onClick={() => handleCopyToken(newTokens[driver.id], driver.id)}
                          >
                            {copiedToken === driver.id ? <CheckCircle className="w-3 h-3 text-[#166534]" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => updateMutation.mutate({ id: driver.id, active: !driver.active })}
                    >
                      {driver.active ? <XCircle className="w-3 h-3 mr-1 text-[#7d0f14]" /> : <CheckCircle className="w-3 h-3 mr-1 text-[#166534]" />}
                      {driver.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-[#7d0f14] hover:text-[#5a0a0f] hover:bg-[#fdf2f2]"
                      onClick={() => {
                        if (confirm(`Remover ${driver.name}?`)) deleteMutation.mutate({ id: driver.id });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Live map showing all active drivers */}
      <ActiveDriversMap />
    </AdminPage>
  );
}

// ─── ACTIVE DRIVERS MAP ───────────────────────────────────────────────────────

function ActiveDriversMap() {
  const markersRef = useRef<Record<number, google.maps.Marker>>({});
  const mapRef = useRef<google.maps.Map | null>(null);
  const { data: locations } = trpc.drivers.allLocations.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !locations) return;
    const activeIds = new Set(locations.map((l) => l.driverId));

    // Remove stale markers
    (Object.keys(markersRef.current) as unknown as number[]).forEach((id) => {
      if (!activeIds.has(Number(id))) {
        markersRef.current[Number(id)].setMap(null);
        delete markersRef.current[Number(id)];
      }
    });

    // Add or update markers
    locations.forEach((loc) => {
      const pos = new google.maps.LatLng(parseFloat(loc.lat), parseFloat(loc.lng));
      if (markersRef.current[loc.driverId]) {
        markersRef.current[loc.driverId].setPosition(pos);
      } else {
        markersRef.current[loc.driverId] = new google.maps.Marker({
          position: pos,
          map: mapRef.current!,
          title: loc.driverName,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#ef4444" stroke="white" stroke-width="2"/><text x="18" y="24" text-anchor="middle" font-size="16" fill="white">🏍️</text></svg>`
            ),
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18),
          },
          label: { text: loc.driverName, color: "#1e293b", fontSize: "11px", fontWeight: "bold" },
        });
      }
    });

    if (locations.length > 0 && mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach((loc) => bounds.extend(new google.maps.LatLng(parseFloat(loc.lat), parseFloat(loc.lng))));
      mapRef.current.fitBounds(bounds);
    }
  }, [locations]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#7d0f14]" />
            Motoboys em Rota (Tempo Real)
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Atualiza a cada 5s</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-xl relative">
        <MapView
          onMapReady={handleMapReady}
          className="w-full h-[350px]"
          initialCenter={{ lat: -19.9833, lng: -44.0667 }}
          initialZoom={13}
        />
        {(!locations || locations.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
            <p className="text-muted-foreground text-sm">Nenhum motoboy com localização ativa no momento.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── MESSAGES TAB ─────────────────────────────────────────────────────────────
function MessagesTab() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: conversations, isLoading, refetch } = trpc.chat.ordersWithMessages.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  function handleSelectOrder(orderId: number) {
    setSelectedOrderId(orderId);
    // Invalida o totalUnread para atualizar o badge da sidebar
    utils.chat.totalUnread.invalidate();
    utils.chat.ordersWithMessages.invalidate();
  }

  const selected = conversations?.find(c => c.orderId === selectedOrderId);

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Lista de conversas */}
      <div className="w-80 shrink-0 flex flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--admin-text-heading)' }}>Mensagens</h2>
          <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {isLoading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        )}
        {!isLoading && (!conversations || conversations.length === 0) && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <MessageCircle className="w-10 h-10 opacity-30" />
            <p className="text-sm">Nenhuma conversa ainda</p>
          </div>
        )}
        {conversations?.map(conv => (
          <button
            key={conv.orderId}
            onClick={() => handleSelectOrder(conv.orderId)}
            className={`w-full text-left p-3 rounded-xl border transition-all ${
              selectedOrderId === conv.orderId
                ? "border-primary bg-primary/5"
                : conv.unreadCount > 0
                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate">{conv.customerName}</span>
                  {conv.aiPaused && (
                    <span className="text-[10px] bg-[#fce8e8] text-[#6E0D12] px-1.5 py-0.5 rounded-full font-medium shrink-0">Humano</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  Pedido #{conv.orderId} · {STATUS_LABELS[conv.status]?.label ?? conv.status}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-1 italic">
                  {conv.lastMessage.length > 60 ? conv.lastMessage.slice(0, 60) + "…" : conv.lastMessage}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(conv.lastMessageAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Chat inline */}
      <div className="flex-1 min-w-0 border rounded-2xl overflow-hidden bg-card">
        {selectedOrderId ? (
          <OrderChat
            orderId={selectedOrderId}
            currentUserRole="admin"
            currentUserName={user?.name ?? "Admin"}
            currentUserAvatarUrl={user?.avatarUrl ?? undefined}
            inline
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <MessageCircle className="w-16 h-16 opacity-20" />
            <p className="text-base font-medium">Selecione uma conversa</p>
            <p className="text-sm opacity-70">Escolha um pedido na lista ao lado para abrir o chat</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Recovery Tab ─────────────────────────────────────────────────────────────
function RecoveryTab() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const { data: stats, isLoading, refetch } = trpc.recovery.stats.useQuery({ period });
  const triggerReactivation = trpc.recovery.triggerReactivation.useMutation({
    onSuccess: () => { refetch(); },
  });
  const { data: carts, isLoading: cartsLoading } = trpc.recovery.abandonedCarts.useQuery({ limit: 20 });

  const periodLabels = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias" };

  return (
    <AdminPage>
      <AdminTopbar
        title="Recuperação de receita"
        subtitle="Carrinhos abandonados, reativação de clientes e conversões automáticas"
        actions={
          <>
            <AdminChipGroup
              size="sm"
              value={period}
              onChange={setPeriod}
              items={[
                { value: '7d', label: periodLabels['7d'] },
                { value: '30d', label: periodLabels['30d'] },
                { value: '90d', label: periodLabels['90d'] },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerReactivation.mutate()}
              disabled={triggerReactivation.isPending}
              className="gap-2 h-9"
            >
              <RefreshCcw className={`w-4 h-4 ${triggerReactivation.isPending ? "animate-spin" : ""}`} />
              Disparar reativação
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6 h-24 bg-muted/30 rounded-lg" /></Card>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* KPI Cards — Carrinho */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">🛒 Carrinho Abandonado</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Total Abandonados</p>
                  <p className="text-3xl font-bold mt-1">{stats.carts.total}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Recuperados</p>
                  <p className="text-3xl font-bold mt-1 text-primary">{stats.carts.recovered}</p>
                  <p className="text-xs text-primary mt-1">R$ {stats.carts.recoveredRevenue.toFixed(2).replace(".", ",")}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Taxa de Recuperação</p>
                  <p className="text-3xl font-bold mt-1 text-primary">{stats.carts.recoveryRate}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="text-3xl font-bold mt-1 text-muted-foreground">{stats.carts.pending}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Taxa por etapa */}
          {stats.steps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">⚡ Performance por Etapa</h3>
              <div className="grid grid-cols-3 gap-4">
                {stats.steps.map(step => (
                  <Card key={step.step}>
                    <CardContent className="p-5">
                      <p className="text-xs text-muted-foreground">Etapa {step.step} ({step.step === 1 ? "10min" : step.step === 2 ? "20min" : "30min"})</p>
                      <p className="text-2xl font-bold mt-1">{step.sent} enviados</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full" style={{ width: `${step.conversionRate}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-primary">{step.conversionRate}%</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stats.steps.length === 0 && (
                  <div className="col-span-3 text-center text-muted-foreground py-8 text-sm">Nenhum dado de etapa no período selecionado</div>
                )}
              </div>
            </div>
          )}

          {/* KPI Cards — Reativação */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">🔁 Reativação de Clientes Inativos</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Inativos 15 dias</p>
                  <p className="text-3xl font-bold mt-1">{stats.reactivation.sent15d}</p>
                  <p className="text-xs text-muted-foreground mt-1">mensagens enviadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Inativos 30 dias</p>
                  <p className="text-3xl font-bold mt-1">{stats.reactivation.sent30d}</p>
                  <p className="text-xs text-muted-foreground mt-1">mensagens enviadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Inativos 60 dias</p>
                  <p className="text-3xl font-bold mt-1">{stats.reactivation.sent60d}</p>
                  <p className="text-xs text-muted-foreground mt-1">mensagens enviadas</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Conversões por Automação</p>
                  <p className="text-3xl font-bold mt-1 text-primary">{stats.conversions.total}</p>
                  <p className="text-xs text-primary mt-1">R$ {stats.conversions.revenue.toFixed(2).replace(".", ",")} recuperados</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tabela de carrinhos abandonados recentes */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">📋 Carrinhos Recentes</h3>
            <Card>
              <CardContent className="p-0">
                {cartsLoading ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Carregando...</div>
                ) : !carts || carts.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Nenhum carrinho abandonado registrado ainda</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Etapa</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cupom</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {carts.map(cart => (
                          <tr key={cart.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{cart.customerName}</div>
                              <div className="text-xs text-muted-foreground">{cart.customerPhone ?? "—"}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold">R$ {Number(cart.total).toFixed(2).replace(".", ",")}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                cart.status === "recovered" ? "bg-[#f0fdf4] text-[#166534]" :
                                cart.status === "expired" ? "bg-muted text-muted-foreground" :
                                "bg-[#fce8e8] text-[#6E0D12]"
                              }`}>
                                {cart.status === "recovered" ? "✅ Recuperado" : cart.status === "expired" ? "⏱ Expirado" : "⏳ Pendente"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {(cart as { currentStep?: number }).currentStep ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                  {(cart as { currentStep?: number }).currentStep}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {(cart as { couponCode?: string }).couponCode ? (
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{(cart as { couponCode?: string }).couponCode}</code>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {new Date(cart.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <AdminSurface>
          <AdminEmptyState
            icon={<RefreshCcw className="w-8 h-8" />}
            title="Sem dados no período"
            description="Nenhum dado de recuperação disponível para o período selecionado."
          />
        </AdminSurface>
      )}
    </AdminPage>
  );
}


