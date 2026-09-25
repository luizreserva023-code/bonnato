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
import { trpc } from "@/lib/trpc";
import { uploadImageFile } from "@/lib/imageUpload";
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
  PlugZap,
  Truck,
  GripVertical,
  MessageCircle,
  Star,
} from "lucide-react";
import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { MapView } from "@/components/Map";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area, ComposedChart, ReferenceLine } from "recharts";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, BellOff } from "lucide-react";
import { JoinedPagination } from "@/components/ui/joined-pagination";
import { Building2, Store, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminStoreProvider, useAdminStore } from "@/contexts/AdminStoreContext";
import { useTheme } from "@/contexts/ThemeContext";
import { UiPreferencesMenu } from "@/components/UiPreferencesMenu";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/GlobalCommandPalette";
import { AdminOnboarding } from "@/components/AdminOnboarding";
import { AdminHelpButton, AdminHelpProvider } from "@/components/admin/AdminHelpCenter";
import { AppStatusPage } from "@/components/AppStatusPage";
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
  AdminInsightCard,
  AdminDataTableShell,
  AdminCardSkeleton,
  AdminChartSkeleton,
  AdminSkeleton,
} from "@/components/admin/ui";
import type { BonattoAdminTab } from "@shared/bonattoConfig";
import type { BonattoRuntimeConfig } from "@/config/bonatto";
import type { StoreAccessRole, StorePermission } from "@shared/permissions";
import { DEFAULT_HOME_APP_CONFIG, type HomeAppConfig } from "@/components/home/HomeAppHub";
import "@/styles/admin-system.css";

const RewardsAdminTab = lazy(() => import("@/features/admin/rewards/RewardsAdminTab"));
const ReviewsAdminTab = lazy(() => import("@/features/admin/marketing/ReviewsAdminTab"));
const WhatsAppAdminTab = lazy(() => import("@/features/admin/whatsapp/WhatsAppAdminTab"));
const MarketplacesTab = lazy(() => import("./admin/MarketplacesTab").then((m) => ({ default: m.MarketplacesTab })));
const NetworkFinanceTab = lazy(() => import("./admin/NetworkFinanceTab").then((m) => ({ default: m.NetworkFinanceTab })));
const GrowthCenter = lazy(() => import("./GrowthCenter"));
const StoresTab = lazy(() => import("./admin/StoresTab").then((m) => ({ default: m.StoresTab })));
const ProductCatalogEditor = lazy(() => import("@/features/admin/catalog/ProductCatalogEditor").then((m) => ({ default: m.ProductCatalogEditor })));
const CatalogReplicationDialog = lazy(() => import("@/features/admin/catalog/CatalogReplicationDialog").then((m) => ({ default: m.CatalogReplicationDialog })));
const MenuStructurePanel = lazy(() => import("@/features/admin/catalog/MenuStructurePanel").then((m) => ({ default: m.MenuStructurePanel })));
const ProductsManagementPanel = lazy(() => import("@/features/admin/catalog/ProductsManagementPanel").then((m) => ({ default: m.ProductsManagementPanel })));
const ModifierGroupsPanel = lazy(() => import("@/features/admin/catalog/ModifierGroupsPanel").then((m) => ({ default: m.ModifierGroupsPanel })));
const MenuPerformancePanel = lazy(() => import("@/features/admin/catalog/MenuPerformancePanel").then((m) => ({ default: m.MenuPerformancePanel })));
const PerformanceTab = lazy(() => import("@/features/admin/reports/PerformanceTab").then((m) => ({ default: m.PerformanceTab })));

const STATUS_LABELS: Record<string, { label: string; color: string; next?: string }> = {
  pending: { label: "Aguardando", color: "bg-[#EFF6FF] text-[#3578E5]", next: "confirmed" },
  confirmed: { label: "Confirmado", color: "bg-[#FCF5F5] text-[#631014]", next: "preparing" },
  preparing: { label: "Preparando", color: "bg-[#FFFAEB] text-[#D97706]", next: "out_for_delivery" },
  out_for_delivery: { label: "Saiu p/ Entrega", color: "bg-[#F6E9E9] text-[#73151B]", next: "delivered" },
  delivered: { label: "Entregue", color: "bg-[#ECFDF5] text-[#16A36A]" },
  cancelled: { label: "Cancelado", color: "bg-[#FEF3F2] text-[#D92D20]" },
};

const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "Cartão Crédito",
  debit_card: "Cartão Débito",
  pix: "PIX",
  cash: "Dinheiro",
};

type AdminTab = "dashboard" | "orders" | "menu" | "inventory" | "staff" | "dining" | "club" | "rewards" | "coupons" | "reviews" | "reports" | "network" | "distribution" | "promotions" | "raffles" | "upsells" | "users" | "drivers" | "settings" | "payments" | "whatsapp" | "marketplaces" | "stores" | "recovery" | "growth";

const ADMIN_TAB_FEATURE: Partial<Record<AdminTab, BonattoAdminTab>> = {
  dashboard: "dashboard",
  orders: "orders",
  menu: "menu",
  inventory: "inventory",
  staff: "staff",
  dining: "dining",
  club: "club",
  coupons: "coupons",
  reviews: "reviews",
  reports: "reports",
  network: "network",
  distribution: "distribution",
  promotions: "promotions",
  raffles: "raffles",
  upsells: "upsells",
  users: "users",
  drivers: "drivers",
  settings: "settings",
  payments: "payments",
  whatsapp: "whatsapp",
  marketplaces: "marketplaces",
  stores: "stores",
  recovery: "recovery",
  growth: "growth",
};

const ADMIN_TAB_PERMISSION: Partial<Record<AdminTab, StorePermission>> = {
  dashboard: "dashboard:view",
  orders: "orders:view",
  menu: "catalog:view",
  inventory: "inventory:view",
  staff: "staff:view",
  dining: "dining:view",
  club: "marketing:view",
  rewards: "marketing:view",
  coupons: "marketing:view",
  reviews: "marketing:view",
  promotions: "marketing:view",
  raffles: "marketing:view",
  upsells: "marketing:view",
  recovery: "marketing:view",
  growth: "marketing:view",
  users: "customers:view",
  reports: "reports:view",
  network: "network:view",
  distribution: "network:view",
  drivers: "delivery:view",
  payments: "payments:view",
  whatsapp: "marketing:view",
  marketplaces: "integrations:view",
  settings: "settings:view",
  stores: "stores:manage",
};

function isAdminTabAvailable(
  tab: AdminTab,
  tenant: BonattoRuntimeConfig,
  isPlatformAdmin: boolean,
  can?: (permission: StorePermission) => boolean,
) {
  if (tab === "stores" && !isPlatformAdmin) return false;
  const permission = ADMIN_TAB_PERMISSION[tab];
  if (permission && can && !can(permission)) return false;
  if (tab === "rewards") return tenant.features.loyalty && tenant.features.adminTabs.club;
  const feature = ADMIN_TAB_FEATURE[tab];
  if (!feature || tenant.features.adminTabs[feature] === false) return false;
  if (tab === "club") return tenant.features.club;
  if (tab === "drivers") return tenant.features.driverApp;
  if (tab === "marketplaces") return tenant.features.marketplaces;
  return tenant.features.adminTabs[feature] ?? false;
}
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
  { id: "rewards" as AdminTab, label: "Clube de Recompensas", icon: <Gift className="w-[18px] h-[18px]" /> },
  {
    id: "coupons" as AdminTab, label: "Marketing", icon: <Megaphone className="w-[18px] h-[18px]" />,
    children: [
      { id: "coupons" as AdminTab, label: "Cupons", icon: <Tag className="w-4 h-4" /> },
      { id: "reviews" as AdminTab, label: "Avaliações", icon: <Star className="w-4 h-4" /> },
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
    ],
  },
  { id: "reports" as AdminTab, label: "Desempenho", icon: <TrendingUp className="w-[18px] h-[18px]" /> },
  { id: "growth" as AdminTab, label: "Central de Crescimento", icon: <Zap className="w-[18px] h-[18px]" /> },
  { id: "network" as AdminTab, label: "Rede & Financeiro", icon: <Building2 className="w-[18px] h-[18px]" /> },
  { id: "distribution" as AdminTab, label: "Centro de Distribuição", icon: <Package className="w-[18px] h-[18px]" /> },
  {
    id: "drivers" as AdminTab, label: "Entregas", icon: <Bike className="w-[18px] h-[18px]" />,
    children: [
      { id: "drivers" as AdminTab, label: "Motoboys", icon: <Bike className="w-4 h-4" /> },
      { id: "stores" as AdminTab, label: "Lojas", icon: <Building2 className="w-4 h-4" />, adminOnly: true },
    ],
  },
  { id: "payments" as AdminTab, label: "Pagamentos", icon: <DollarSign className="w-[18px] h-[18px]" /> },
  { id: "whatsapp" as AdminTab, label: "WhatsApp", icon: <MessageCircle className="w-[18px] h-[18px]" /> },
  { id: "marketplaces" as AdminTab, label: "Integrações", icon: <PlugZap className="w-[18px] h-[18px]" /> },
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
  stopAlert,
  onClose,
  isSubscribed,
  pushLoading,
  pushSupported,
  subscribePush,
  unsubscribePush,
  isAdmin,
  accessRole,
  can,
  collapsed,
  onToggleCollapse,
}: {
  activeTab: AdminTab;
  setActiveTab: (t: AdminTab) => void;
  pendingCount: number;
  stopAlert: () => void;
  onClose?: () => void;
  isSubscribed: boolean;
  pushLoading: boolean;
  pushSupported: boolean;
  subscribePush: () => void;
  unsubscribePush: () => void;
  isAdmin: boolean;
  accessRole?: StoreAccessRole;
  can: (permission: StorePermission) => boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { bonattoConfig } = useAdminStore();
  const isCollapsed = Boolean(collapsed);

  function handleNav(id: AdminTab) {
    setActiveTab(id);
    if (id === "orders") stopAlert();
    onClose?.();
  }

  const TOOLS = [
    { href: '/vendas', label: 'Painel de Vendas', icon: <BarChart3 className="w-4 h-4" /> },
    { href: '/crm', label: 'CRM', icon: <Users className="w-4 h-4" /> },
    { href: '/notificacoes', label: 'Notificações', icon: <Megaphone className="w-4 h-4" /> },
    { href: '/admin/configuracoes/entrega', label: 'Configurações de entrega', icon: <MapPin className="w-4 h-4" /> },
    { href: '/automacoes', label: 'Automações', icon: <Bot className="w-4 h-4" /> },
  ];
  const visibleTools = TOOLS.filter((tool) => {
    if (tool.href === "/vendas") return bonattoConfig.features.salesDashboard;
    if (tool.href === "/crm") return bonattoConfig.features.crm;
    if (tool.href === "/notificacoes") return bonattoConfig.features.notifications;
    if (tool.href === "/admin/configuracoes/entrega") return bonattoConfig.features.deliveryZones;
    if (tool.href === "/automacoes") return bonattoConfig.features.automations;
    return false;
  });

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
      style={{
        background: sidebarBg,
        color: textMuted,
        borderRight: `1px solid var(--admin-sidebar-border)`,
        width: isCollapsed ? "72px" : "248px",
        boxShadow: "6px 0 24px rgba(32, 7, 10, 0.08)",
        transition: "width 160ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      {/* ── Header: logo ── */}
      <div className="relative flex items-center justify-between gap-2 px-3 py-3 overflow-visible" style={{ borderBottom: `1px solid ${dividerColor}`, minHeight: 64 }}>
        <div className={`flex items-center min-w-0 ${isCollapsed ? "justify-center w-full" : "gap-2"}`}>
          {bonattoConfig.brand.logos.icon ? <img src={bonattoConfig.brand.logos.icon} alt={bonattoConfig.brand.name} className="w-9 h-9 object-contain shrink-0 rounded-full bg-white/10" /> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xs font-black text-white">{bonattoConfig.brand.shortName.slice(0, 2).toUpperCase()}</div>}
          {!isCollapsed && (
            <div className="min-w-0 overflow-hidden flex items-center">
              {bonattoConfig.brand.logos.wordmark ? <img src={bonattoConfig.brand.logos.wordmark} alt={bonattoConfig.brand.name} className="h-7 w-auto object-contain" /> : <span className="truncate text-sm font-black text-white">{bonattoConfig.brand.shortName}</span>}
            </div>
          )}
        </div>
        {!isCollapsed && onToggleCollapse && (
          <button
            data-help-id="navigation.collapse"
            type="button"
            onClick={onToggleCollapse}
            aria-label="Recolher menu"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {isCollapsed && onToggleCollapse && (
          <button
            data-help-id="navigation.expand"
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expandir menu"
            className="absolute left-[52px] top-5 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-[#631014] text-white shadow-md"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
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
            const visibleChildren = item.children?.filter((child) => (!child.adminOnly || isAdmin) && isAdminTabAvailable(child.id, bonattoConfig, isAdmin, can));
            if (!isAdminTabAvailable(item.id, bonattoConfig, isAdmin, can) && (!visibleChildren || visibleChildren.length === 0)) return null;
            const hasChildren = visibleChildren && visibleChildren.length > 0;
            const childIds = visibleChildren?.map(c => c.id) ?? [];
            const isParentActive = hasChildren && childIds.includes(activeTab);
            const isDirectActive = !hasChildren && activeTab === item.id;
            const isActive = isDirectActive || isParentActive;
            const isOpen = openSubmenu === item.label;
            const badge = item.id === 'orders' && pendingCount > 0 ? pendingCount : null;

            return (
              <div key={item.label}>
                <button
                  onClick={() => {
                    if (hasChildren) {
                      setOpenSubmenu(isOpen ? null : item.label);
                      if (!isParentActive && visibleChildren) handleNav(visibleChildren[0].id);
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
                    {visibleChildren!.map((child) => {
                      const isChildActive = activeTab === child.id;
                      const childBadge = child.id === 'orders' && pendingCount > 0 ? pendingCount : null;
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
              {visibleTools.map((link) => (
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
            data-help-id="settings.push"
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
          data-help-id="navigation.site"
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
              <p className="text-[12px] font-medium truncate" style={{ color: '#ffffff' }}>{isAdmin ? "Administrador" : accessRole === "cashier" ? "Caixa" : accessRole === "kitchen" ? "Cozinha" : accessRole === "marketing" ? "Marketing" : accessRole === "finance" ? "Financeiro" : accessRole === "viewer" ? "Visualizador" : "Gerente"}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{isAdmin ? 'Acesso total' : 'Acesso da loja'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function AdminContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const { bonattoConfig, selectedStoreId, isLoading: storeContextLoading, isStaff, accessRole, can } = useAdminStore();
  const { resolvedTheme } = useTheme();
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab") as AdminTab | null;
      return tab && NAV_ITEMS.flatMap((item) => item.children ? [item, ...item.children] : [item]).some((item) => item.id === tab) ? tab : "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const setActiveTab = useCallback((tab: AdminTab) => {
    setActiveTabState(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const realtimeUtils = trpc.useUtils();
  const realtimeEnabled = !loading && isAuthenticated && Boolean(selectedStoreId) && can("orders:view");
  const { connected: orderRealtimeConnected } = useOrderRealtime({
    enabled: realtimeEnabled,
    storeId: selectedStoreId,
    onEvent: () => {
      void realtimeUtils.orders.list.invalidate();
      void realtimeUtils.operations.operations.board.invalidate();
      void realtimeUtils.reports.todaySummary.invalidate();
    },
    onFallback: () => {
      void realtimeUtils.orders.list.invalidate();
      void realtimeUtils.operations.operations.board.invalidate();
    },
    fallbackIntervalMs: 5_000,
  });

  const { data: allOrdersForAlert } = trpc.orders.list.useQuery(
    { limit: 100, storeId: selectedStoreId },
    { refetchInterval: orderRealtimeConnected ? false : 30_000, enabled: realtimeEnabled }
  );
  const alertOrderIds = allOrdersForAlert?.map(o => o.id);
  const { stopAlert } = useNewOrderAlert(alertOrderIds, !loading && isAuthenticated && can("orders:view"));
  const { isSubscribed, isLoading: pushLoading, isSupported: pushSupported, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications();
  const pendingCount = allOrdersForAlert?.filter(o => o.status === "pending").length ?? 0;

  const isAdmin = user?.role === "admin";
  const fallbackTab = (["dashboard", "orders", "menu", "settings"] as AdminTab[])
    .find((tab) => isAdminTabAvailable(tab, bonattoConfig, Boolean(isAdmin), can)) ?? "dashboard";
  const accessContextLoading = loading || storeContextLoading;
  const resolvedActiveTab = accessContextLoading || isAdminTabAvailable(activeTab, bonattoConfig, Boolean(isAdmin), can) ? activeTab : fallbackTab;

  useEffect(() => {
    if (!accessContextLoading && activeTab !== resolvedActiveTab) setActiveTab(resolvedActiveTab);
  }, [accessContextLoading, activeTab, resolvedActiveTab, setActiveTab]);

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

  const sidebarProps = {
    activeTab: resolvedActiveTab,
    setActiveTab,
    pendingCount,
    stopAlert,
    isSubscribed,
    pushLoading,
    pushSupported: pushSupported ?? false,
    subscribePush,
    unsubscribePush,
    isAdmin,
    accessRole,
    can,
    collapsed: sidebarCollapsed,
    onToggleCollapse: toggleSidebar,
  };

  // Label da aba ativa para o header mobile
  const activeLabel = NAV_ITEMS.flatMap(item => item.children ? [item, ...item.children] : [item]).find(i => i.id === resolvedActiveTab)?.label ?? bonattoConfig.brand.adminTitle;
  const bonattoAdminStyle = {
    background: "var(--admin-bg)",
    color: "var(--admin-text-primary)",
    ...(resolvedTheme === "dark" ? {
      "--admin-bg": "#111315",
      "--admin-surface": "#191c20",
      "--admin-surface-alt": "#20242a",
      "--admin-card-bg": "#191c20",
      "--admin-card-border": "#2a2f35",
      "--admin-border": "#2a2f35",
      "--admin-border-strong": "#3b424b",
      "--admin-divider": "#2a2f35",
      "--admin-hover-bg": "#20242a",
      "--admin-text-primary": "#f7f8fa",
      "--admin-text-heading": "#f7f8fa",
      "--admin-text": "#d6d9de",
      "--admin-text-secondary": "#b8bec8",
      "--admin-text-muted": "#8f98a6",
      "--admin-input-bg": "#15181c",
      "--admin-input-border": "#343941",
      "--admin-mobile-header-bg": "rgba(25,28,32,0.97)",
      "--admin-mobile-header-border": "#2a2f35",
      "--admin-mobile-header-text": "#f7f8fa",
      "--admin-tooltip-bg": "#20242a",
      "--admin-chart-grid": "rgba(255,255,255,0.08)",
      "--admin-chart-tick": "#929aa6",
      "--admin-filter-inactive-bg": "#252a30",
      "--admin-filter-inactive-text": "#b6bdc7",
      "--admin-header-bg": "rgba(17,19,21,0.94)",
    } : {}),
  } as CSSProperties;

  if (accessContextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return <AppStatusPage kind="forbidden" />;
  }

  return (
    <AdminHelpProvider activeTab={resolvedActiveTab} activeLabel={activeLabel}>
    {/* Grid background wrapper */}
    <AdminOnboarding />
    <div
      data-admin-theme={resolvedTheme}
      className={`bonatto-admin min-h-screen flex ${resolvedTheme === "dark" ? "admin-dark" : "admin-light"}`}
      style={bonattoAdminStyle}
    >
      {/* ── Desktop Sidebar fixa expandida (lg+) ── */}
      <aside
        className="hidden lg:flex shrink-0 sticky top-0 h-screen flex-col"
        style={{ width: sidebarCollapsed ? 72 : 248, zIndex: 50, transition: "width 160ms cubic-bezier(.2,.8,.2,1)" }}
      >
        <AdminSidebar {...sidebarProps} />
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64" style={{ background: 'var(--admin-sidebar-bg)' }}>
          <SheetTitle className="sr-only">Menu de navegação do painel admin</SheetTitle>
          <AdminSidebar {...sidebarProps} collapsed={false} onToggleCollapse={undefined} onClose={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop utility bar */}
        <header
          className="sticky top-0 z-30 hidden min-h-14 items-center gap-3 border-b px-6 lg:flex"
          style={{ background: "var(--admin-mobile-header-bg)", borderColor: "var(--admin-mobile-header-border)", backdropFilter: "blur(14px)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--admin-text-muted)" }}>Painel administrativo</p>
            <p className="truncate text-sm font-semibold" style={{ color: "var(--admin-text-heading)" }}>{activeLabel}</p>
          </div>
          <Button
            data-help-id="common.commandPalette"
            type="button"
            variant="outline"
            size="sm"
            className="h-9 min-w-[210px] justify-between gap-3 border-[var(--admin-input-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text-secondary)]"
            onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
            aria-label="Abrir busca global e paleta de comandos"
          >
            <span className="truncate">Buscar ou executar comando</span>
            <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-semibold opacity-70">Ctrl K</kbd>
          </Button>
          <AdminStoreSelectorMobile />
          <AdminHelpButton />
          <UiPreferencesMenu compact />
        </header>

        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3" style={{ background: 'var(--admin-mobile-header-bg)', borderBottom: `1px solid var(--admin-mobile-header-border)`, boxShadow: '0 1px 8px rgba(16,24,40,0.04)', backdropFilter: 'blur(12px)' }}>
          <button data-help-id="navigation.mobileMenu" aria-label="Abrir menu administrativo" onClick={() => setMobileSidebarOpen(true)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--admin-mobile-header-text)' }}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            {bonattoConfig.brand.logos.icon ? <img src={bonattoConfig.brand.logos.icon} alt={bonattoConfig.brand.name} className="w-7 h-7 object-contain rounded-full" /> : <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#6E0D12] text-[9px] font-black text-white">{bonattoConfig.brand.shortName.slice(0, 2).toUpperCase()}</div>}
            <span className="font-semibold text-sm" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--admin-mobile-header-text)' }}>{activeLabel}</span>
          </div>
          <AdminStoreSelectorMobile />
          <AdminHelpButton compact />
          <UiPreferencesMenu compact />
          {pendingCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-[#a01218] opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-[#7d0f14] text-white text-[9px] font-black items-center justify-center">{pendingCount}</span>
            </span>
          )}
        </header>

        {/* Page content */}
        <main className="admin-main min-w-0 max-w-full flex-1 overflow-x-hidden">
          <div className="admin-content-frame" key={resolvedActiveTab} style={{ animation: 'adminFadeIn 0.18s ease-out' }}>
            <Suspense fallback={<div className="grid min-h-64 place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div>}>
            {resolvedActiveTab === "dashboard" && <DeliveryDashboardTab />}
            {resolvedActiveTab === "orders" && <OrdersTab onOpenOrder={stopAlert} />}
            {resolvedActiveTab === "menu" && <MenuTab />}
            {resolvedActiveTab === "club" && <ClubTab />}
            {resolvedActiveTab === "rewards" && (
              <Suspense fallback={<div className="grid min-h-64 place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div>}>
                <RewardsAdminTab />
              </Suspense>
            )}
            {resolvedActiveTab === "coupons" && <CouponsTab />}
            {resolvedActiveTab === "reviews" && <ReviewsAdminTab />}
            {resolvedActiveTab === "promotions" && <PromotionsTab />}
            {resolvedActiveTab === "raffles" && <RafflesTab />}
            {resolvedActiveTab === "upsells" && <UpsellsTab />}
            {resolvedActiveTab === "users" && <UsersTab />}
            {resolvedActiveTab === "reports" && <PerformanceTab />}
            {resolvedActiveTab === "network" && <NetworkFinanceTab />}
            {resolvedActiveTab === "distribution" && <NetworkFinanceTab mode="distribution" />}
            {resolvedActiveTab === "drivers" && <DriversTab />}
            {resolvedActiveTab === "payments" && <PaymentsTab />}
            {resolvedActiveTab === "whatsapp" && (
              <Suspense fallback={<div className="grid min-h-64 place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div>}>
                <WhatsAppAdminTab />
              </Suspense>
            )}
            {resolvedActiveTab === "marketplaces" && <MarketplacesTab />}
            {resolvedActiveTab === "settings" && <SettingsTab />}
            {resolvedActiveTab === "stores" && isAdmin && <StoresTab />}
            {resolvedActiveTab === "recovery" && <RecoveryTab />}
            {resolvedActiveTab === "growth" && <GrowthCenter />}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
    </AdminHelpProvider>
  );
}

export default function Admin() {
  return <AdminStoreProvider><AdminContent /></AdminStoreProvider>;
}

// ─── Store Selector (Admin only) ─────────────────────────────────────────────
function AdminStoreSelectorSidebar() {
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, stores } = useAdminStore();
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
  if (isManager && stores.length <= 1) {
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
        <button data-help-id="navigation.store" aria-label="Selecionar loja" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.20)'; (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)'; }}
        >
          <Store className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.70)' }} />
          <span className="flex-1 text-left truncate">{selectedStoreName}</span>
          <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.50)' }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
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
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, stores } = useAdminStore();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-help-id="navigation.store" aria-label="Selecionar loja" variant="outline" size="sm" className="h-7 text-xs gap-1" style={{ background: 'rgba(0,0,0,0.06)', borderColor: 'rgba(0,0,0,0.12)', color: '#3a3a3a' }}>
          <Store className="w-3 h-3" />
          <span className="max-w-[100px] truncate">{selectedStoreName}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
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
  const { selectedStoreId, selectedStoreName } = useAdminStore();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [periodPreset, setPeriodPreset] = useState<"today" | "yesterday" | "7d" | "30d" | "custom">("7d");
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [timezoneOffset] = useState(() => new Date().getTimezoneOffset());

  const endDate = useMemo(() => {
    const date = periodPreset === "custom" ? new Date(`${customEnd}T23:59:59`) : new Date();
    if (periodPreset === "yesterday") {
      date.setDate(date.getDate() - 1);
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(23, 59, 59, 999);
    }
    return date;
  }, [periodPreset, customEnd]);
  const startDate = useMemo(() => {
    const date = periodPreset === "custom" ? new Date(`${customStart}T00:00:00`) : new Date();
    date.setHours(0, 0, 0, 0);
    if (periodPreset === "yesterday") date.setDate(date.getDate() - 1);
    if (periodPreset === "7d") date.setDate(date.getDate() - 6);
    if (periodPreset === "30d") date.setDate(date.getDate() - 29);
    return date;
  }, [periodPreset, customStart]);

  const periodLabel =
    periodPreset === "today" ? "Hoje" :
    periodPreset === "yesterday" ? "Ontem" :
    periodPreset === "7d" ? "Últimos 7 dias" :
    periodPreset === "30d" ? "Últimos 30 dias" :
    "Personalizado";

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
  const { data: kitchenBoard, isLoading: loadingKitchenBoard } = trpc.operations.operations.board.useQuery(
    { storeId: selectedStoreId ?? 0 },
    {
      enabled: Boolean(selectedStoreId),
      refetchInterval: 5000,
      refetchIntervalInBackground: false,
      staleTime: 2500,
    },
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
    pending: "bg-[#EFF6FF] text-[#3578E5]",
    confirmed: "bg-[#FCF5F5] text-[#631014]",
    preparing: "bg-[#FFFAEB] text-[#D97706]",
    out_for_delivery: "bg-[#F6E9E9] text-[#73151B]",
    delivered: "bg-[#ECFDF5] text-[#16A36A]",
    cancelled: "bg-[#FEF3F2] text-[#D92D20]",
  };
  const sourceLabels: Record<string, string> = {
    app: "App",
    ifood: "iFood",
    whatsapp: "WhatsApp",
    phone: "Balcão",
    site: "Site",
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
  const chartPalette = ["#631014", "#B25E62", "#D7A7A9", "#D7D9DF", "#979AA3", "#676A73"];
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
  const statusRows = [
    { key: "pending", label: "Novos", value: periodOrdersAll.filter((order) => order.status === "pending").length, color: "#3578E5" },
    { key: "confirmed", label: "Confirmados", value: periodOrdersAll.filter((order) => order.status === "confirmed").length, color: "#631014" },
    { key: "preparing", label: "Em preparo", value: periodOrdersAll.filter((order) => order.status === "preparing").length, color: "#D97706" },
    { key: "out_for_delivery", label: "Em entrega", value: periodOrdersAll.filter((order) => order.status === "out_for_delivery").length, color: "#8A3439" },
    { key: "delivered", label: "Concluídos", value: periodOrdersAll.filter((order) => order.status === "delivered").length, color: "#16A36A" },
    { key: "cancelled", label: "Cancelados", value: cancelledOrders.length, color: "#D92D20" },
  ];
  const activeDrivers = drivers?.filter((driver) => driver.active).length ?? 0;
  const assignedDrivers = new Set(activeOrders.map((order) => order.driverId).filter(Boolean)).size;
  const loadPerDriver = activeDrivers > 0 ? activeOrders.length / activeDrivers : activeOrders.length;
  const kitchenTickets = kitchenBoard ?? [];
  const kitchenNow = {
    queued: kitchenTickets.filter((ticket) => ticket.status === "queued").length,
    preparing: kitchenTickets.filter((ticket) => ticket.status === "preparing").length,
    ready: kitchenTickets.filter((ticket) => ticket.status === "ready").length,
    delayed: kitchenTickets.filter((ticket) => ticket.delayed).length,
    waitingDriver: kitchenTickets.filter((ticket) =>
      ticket.status === "ready" &&
      ticket.order?.serviceType === "delivery" &&
      !ticket.order?.driverId
    ).length,
  };
  const mostUrgentTicket = [...kitchenTickets]
    .sort((a, b) => a.slaRemainingMinutes - b.slaRemainingMinutes)[0] ?? null;
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
  const ordersDelta = percentChange(totalOrders, prevOrders);
  const cancelRate = periodOrdersAll.length > 0 ? (cancelledOrders.length / periodOrdersAll.length) * 100 : 0;
  const deliveryShare = completedPeriodOrders.length > 0 ? (deliveryOrders.length / completedPeriodOrders.length) * 100 : 0;
  const criticalRate = activeOrders.length > 0 ? (criticalOrders.length / activeOrders.length) * 100 : 0;

  const chartData = (series ?? []).map((point) => ({
    date: new Date(`${point.date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    pedidos: point.totalOrders,
    receita: Number(point.totalRevenue ?? 0),
  }));
  const dailyAverageRevenue = chartData.length > 0 ? chartData.reduce((sum, point) => sum + point.receita, 0) / chartData.length : 0;
  const averagePrepMinutes = average(kitchenLeadTimes);
  const averageDispatchMinutes = average(dispatchLeadTimes);
  const averageDeliveryMinutes = average(endToEndLeadTimes);
  const prepGoalMinutes = 30;
  const deliveryGoalMinutes = 55;
  const prepStatus =
    averagePrepMinutes >= 40 ? { label: "Crítico", tone: "bg-[#fef3f2] text-[#b42318]" } :
    averagePrepMinutes >= prepGoalMinutes ? { label: "Atenção", tone: "bg-[#fff7ed] text-[#c2410c]" } :
    { label: "Dentro da meta", tone: "bg-[#ecfdf3] text-[#027a48]" };
  const deliveryStatus =
    averageDeliveryMinutes >= 70 ? { label: "Crítico", tone: "bg-[#fef3f2] text-[#b42318]" } :
    averageDeliveryMinutes >= deliveryGoalMinutes ? { label: "Atenção", tone: "bg-[#fff7ed] text-[#c2410c]" } :
    { label: "Dentro da meta", tone: "bg-[#ecfdf3] text-[#027a48]" };

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
  const strongestChannel = sourceMix[0] ?? { key: "app", label: "App", orders: 0, revenue: 0, fill: chartPalette[0] };
  const channelSummary = ["app", "ifood", "phone", "whatsapp", "site"].map((key, index) => {
    const found = sourceMix.find((row) => row.key === key);
    const ordersCount = found?.orders ?? 0;
    const revenue = found?.revenue ?? 0;
    const channelCancelCount = periodOrdersAll.filter((order) => (order.source ?? "app") === key && order.status === "cancelled").length;
    const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
    return {
      key,
      label: sourceLabels[key] ?? key,
      orders: ordersCount,
      revenue,
      avgTicket: ordersCount > 0 ? revenue / ordersCount : 0,
      cancelCount: channelCancelCount,
      share,
      status: channelCancelCount >= 3 || share < 5 ? "atenção" : "bom",
      fill: chartPalette[index % chartPalette.length],
    };
  });

  const paymentMix = Object.entries(
    completedPeriodOrders.reduce<Record<string, { revenue: number; orders: number }>>((acc, order) => {
      const key = order.paymentMethod;
      const current = acc[key] ?? { revenue: 0, orders: 0 };
      current.revenue += Number(order.total);
      current.orders += 1;
      acc[key] = current;
      return acc;
    }, {})
  )
    .map(([key, row]) => ({
      key,
      label: paymentLabels[key] ?? key,
      revenue: row.revenue,
      orders: row.orders,
      avgTicket: row.orders > 0 ? row.revenue / row.orders : 0,
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
      status: average(row.minutes) >= 55 ? "crítico" : average(row.minutes) >= 40 ? "atenção" : "bom",
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6);

  const filteredRecentOrders = (recentOrders ?? []).filter((order) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (statusFilter && order.status !== statusFilter) return false;
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
  const peakHour = hourlyVolume.reduce((best, row) => row.pedidos > best.pedidos ? row : best, hourlyVolume[0] ?? { label: "--", pedidos: 0, receita: 0 });
  const lowHour = hourlyVolume.filter((row) => row.pedidos > 0).reduce((best, row) => row.pedidos < best.pedidos ? row : best, hourlyVolume.find((row) => row.pedidos > 0) ?? { label: "--", pedidos: 0, receita: 0 });
  const riskyOrders = criticalOrders.filter((order) => order.ageMinutes >= 25 && order.ageMinutes < 35);
  const oldestQueueOrder = criticalOrders[0] ?? activeOrders
    .map((order) => ({ ...order, ageMinutes: safeMinutesDiff(order.createdAt, new Date()) ?? 0 }))
    .sort((a, b) => b.ageMinutes - a.ageMinutes)[0];
  const recommendations = [
    peakHour.pedidos > 0 ? `O maior volume do período ocorreu perto de ${peakHour.label}, com ${peakHour.pedidos} pedido(s).` : null,
    criticalOrders.length > 0 ? `${criticalOrders.length} pedido(s) ativo(s) já ultrapassaram 35 minutos.` : null,
    neighborhoodRows.some((row) => row.status !== "bom") ? "Há bairros com tempo médio de entrega acima do ideal neste período." : null,
    topProducts?.[0] ? `${topProducts[0].productName} lidera o ranking de itens vendidos no período.` : null,
    paymentMix[0] ? `${paymentMix[0].label} concentra o maior volume financeiro entre os métodos de pagamento.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 5);
  const healthRows = [
    { label: "Velocidade de confirmação", value: queueNow.pending <= 2 ? "Saudável" : queueNow.pending <= 5 ? "Atenção" : "Crítico", tone: queueNow.pending <= 2 ? "bg-[#ecfdf3] text-[#027a48]" : queueNow.pending <= 5 ? "bg-[#fff7ed] text-[#c2410c]" : "bg-[#fef3f2] text-[#b42318]" },
    { label: "Preparo dentro da meta", value: prepStatus.label, tone: prepStatus.tone },
    { label: "Entrega dentro da meta", value: deliveryStatus.label, tone: deliveryStatus.tone },
    { label: "Taxa de cancelamento", value: cancelRate >= 8 ? "Crítico" : cancelRate >= 4 ? "Atenção" : "Saudável", tone: cancelRate >= 8 ? "bg-[#fef3f2] text-[#b42318]" : cancelRate >= 4 ? "bg-[#fff7ed] text-[#c2410c]" : "bg-[#ecfdf3] text-[#027a48]" },
    { label: "Disponibilidade dos canais", value: sourceMix.length > 0 ? "Saudável" : "Atenção", tone: sourceMix.length > 0 ? "bg-[#ecfdf3] text-[#027a48]" : "bg-[#fff7ed] text-[#c2410c]" },
  ];

  const handleRefresh = () => {
    utils.orders.list.invalidate();
    utils.analytics.salesOverview.invalidate();
    utils.analytics.salesTimeSeries.invalidate();
    utils.analytics.recentOrders.invalidate();
    utils.reports.topProducts.invalidate();
    utils.operations.operations.board.invalidate();
    setLastUpdated(new Date());
  };

  return (
    <AdminPage>
      <AdminTopbar
        title="Visão geral"
        subtitle={`${selectedStoreName} • ${periodLabel} • Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
        onRefresh={handleRefresh}
        refreshing={loadingOverview || loadingPeriod || loadingSeries}
        actions={
          <AdminChipGroup
            size="sm"
            value={periodPreset}
            onChange={setPeriodPreset}
            items={[
              { value: "today", label: "Hoje" },
              { value: "yesterday", label: "Ontem" },
              { value: "7d", label: "7 dias" },
              { value: "30d", label: "30 dias" },
              { value: "custom", label: "Personalizado" },
            ]}
          />
        }
      />

      {periodPreset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[var(--admin-border)] bg-white p-3">
          <span className="mr-1 text-xs font-semibold text-[var(--admin-text-secondary)]">Período personalizado</span>
          <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="h-9 w-auto rounded-[10px]" />
          <span className="text-xs text-[var(--admin-text-muted)]">até</span>
          <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="h-9 w-auto rounded-[10px]" />
        </div>
      )}

      {loadingOverview ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <AdminCardSkeleton key={index} />)}
        </div>
      ) : (
        <AdminStatGrid className="xl:grid-cols-5">
          <AdminStat
            label="Pedidos"
            value={totalOrders}
            icon={<ShoppingBag className="h-4 w-4" />}
            trend={ordersDelta > 0 ? "up" : ordersDelta < 0 ? "down" : "neutral"}
            trendLabel={`${ordersDelta > 0 ? "+" : ""}${ordersDelta.toFixed(1)}%`}
            sub="vs. período anterior"
          />
          <AdminStat
            label="Receita"
            value={formatCompactCurrency(totalRevenue)}
            icon={<DollarSign className="h-4 w-4" />}
            trend={revenueDelta > 0 ? "up" : revenueDelta < 0 ? "down" : "neutral"}
            trendLabel={`${revenueDelta > 0 ? "+" : ""}${revenueDelta.toFixed(1)}%`}
            sub="vs. período anterior"
          />
          <AdminStat
            label="Ticket médio"
            value={formatCompactCurrency(avgTicket)}
            icon={<TrendingUp className="h-4 w-4" />}
            sub={`${deliveryShare.toFixed(0)}% do volume em delivery`}
          />
          <AdminStat
            label="Cancelamentos"
            value={`${cancelRate.toFixed(1)}%`}
            icon={<XCircle className="h-4 w-4" />}
            trend={cancelRate >= 4 ? "down" : "neutral"}
            trendLabel={cancelRate >= 4 ? "Atenção" : "Normal"}
            sub={`${cancelledOrders.length} de ${periodOrdersAll.length} pedidos`}
          />
          <AdminStat
            label="Tempo de preparo"
            value={kitchenLeadTimes.length ? `${averagePrepMinutes.toFixed(0)} min` : "—"}
            icon={<ChefHat className="h-4 w-4" />}
            trend={averagePrepMinutes > prepGoalMinutes ? "down" : "neutral"}
            trendLabel={kitchenLeadTimes.length ? prepStatus.label : undefined}
            sub={`Meta operacional: ${prepGoalMinutes} min`}
          />
        </AdminStatGrid>
      )}

      <AdminSurface
        title="Central operacional agora"
        subtitle="Fila da cozinha atualizada a cada 5 segundos, com SLA e gargalos da unidade."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-success-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-success)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-success)]" />
              Ao vivo
            </span>
            {mostUrgentTicket && (
              <AdminPill tone={mostUrgentTicket.delayed ? "danger" : mostUrgentTicket.slaRemainingMinutes <= 10 ? "warning" : "neutral"}>
                {mostUrgentTicket.delayed
                  ? `${Math.abs(mostUrgentTicket.slaRemainingMinutes)} min atrasado`
                  : `menor SLA: ${mostUrgentTicket.slaRemainingMinutes} min`}
              </AdminPill>
            )}
          </div>
        }
      >
        {loadingKitchenBoard ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => <AdminSkeleton key={index} className="h-20" />)}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Aguardando cozinha", value: kitchenNow.queued, tone: "info" as const },
                { label: "Em preparo", value: kitchenNow.preparing, tone: "warning" as const },
                { label: "Prontos", value: kitchenNow.ready, tone: "success" as const },
                { label: "Atrasados", value: kitchenNow.delayed, tone: kitchenNow.delayed ? "danger" as const : "neutral" as const },
                { label: "Aguardando motoboy", value: kitchenNow.waitingDriver, tone: kitchenNow.waitingDriver ? "warning" as const : "neutral" as const },
              ].map((item) => (
                <div key={item.label} className="rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-surface-alt)] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-[var(--admin-text-secondary)]">{item.label}</p>
                    <AdminPill tone={item.tone}>{item.value}</AdminPill>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-[-.03em] text-[var(--admin-text-primary)]">{item.value}</p>
                </div>
              ))}
            </div>

            {kitchenTickets.length > 0 && (
              <div className="overflow-hidden rounded-[14px] border border-[var(--admin-border)]">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 bg-[var(--admin-surface-alt)] px-4 py-2.5 text-[11px] font-semibold text-[var(--admin-text-secondary)]">
                  <span>Pedido</span><span>Etapa</span><span>Decorrido</span><span>SLA</span>
                </div>
                {[...kitchenTickets]
                  .sort((a, b) => a.slaRemainingMinutes - b.slaRemainingMinutes)
                  .slice(0, 6)
                  .map((ticket) => (
                    <div key={ticket.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-t border-[var(--admin-border)] px-4 py-3 text-[12px]">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--admin-text-primary)]">
                          {ticket.order?.orderNumber ?? `#${ticket.orderId}`}
                        </p>
                        <p className="truncate text-[11px] text-[var(--admin-text-muted)]">{ticket.order?.customerName ?? "Cliente"}</p>
                      </div>
                      <AdminPill tone={ticket.status === "ready" ? "success" : ticket.status === "preparing" ? "warning" : "info"}>
                        {ticket.status === "ready" ? "Pronto" : ticket.status === "preparing" ? "Em preparo" : "Fila"}
                      </AdminPill>
                      <span className="font-medium text-[var(--admin-text-secondary)]">{ticket.elapsedMinutes} min</span>
                      <span className={`font-semibold ${ticket.delayed ? "text-[var(--admin-danger)]" : ticket.slaRemainingMinutes <= 10 ? "text-[var(--admin-warning)]" : "text-[var(--admin-text-primary)]"}`}>
                        {ticket.delayed ? `+${Math.abs(ticket.slaRemainingMinutes)} min` : `${ticket.slaRemainingMinutes} min`}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </AdminSurface>

      <div className="admin-dashboard-grid">
        {loadingSeries ? (
          <AdminChartSkeleton />
        ) : (
          <AdminSurface
            title="Receita e pedidos"
            subtitle="Evolução conjunta do faturamento e do volume no período selecionado."
            actions={<AdminPill tone="brand">{periodLabel}</AdminPill>}
          >
            {chartData.length === 0 ? (
              <AdminEmptyState
                icon={<BarChart3 className="h-8 w-8" />}
                title="Sem pedidos neste período"
                description="Assim que novos pedidos entrarem, a evolução de receita e volume aparecerá aqui."
              />
            ) : (
              <>
                <div className="admin-chart-shell h-[330px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
                      <defs>
                        <linearGradient id="adminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#631014" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#631014" stopOpacity={0.015} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECEDEF" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#979AA3" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#979AA3" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "#979AA3" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `R$${value}`}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #E7E8EC", boxShadow: "0 8px 30px rgba(16,24,40,.08)" }}
                        formatter={(value: number, name: string) => [name === "receita" ? formatCurrency(value) : value, name === "receita" ? "Receita" : "Pedidos"]}
                      />
                      <Bar yAxisId="left" dataKey="pedidos" radius={[6, 6, 0, 0]} maxBarSize={30} fill="#D7A7A9" />
                      <Area yAxisId="right" type="monotone" dataKey="receita" stroke="#631014" strokeWidth={2.4} fill="url(#adminRevenueGradient)" />
                      <ReferenceLine yAxisId="right" y={dailyAverageRevenue} stroke="#979AA3" strokeDasharray="4 4" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--admin-border)] pt-4 text-xs text-[var(--admin-text-secondary)]">
                  <span>Média diária: <strong className="font-semibold text-[var(--admin-text-primary)]">{formatCompactCurrency(dailyAverageRevenue)}</strong></span>
                  {peakHour.pedidos > 0 && <span>Pico: <strong className="font-semibold text-[var(--admin-text-primary)]">{peakHour.label} • {peakHour.pedidos} pedidos</strong></span>}
                </div>
              </>
            )}
          </AdminSurface>
        )}

        <AdminSurface
          title="Saúde da operação"
          subtitle="Indicadores que afetam SLA, experiência e capacidade."
          actions={
            <AdminPill tone={criticalRate >= 35 || cancelRate >= 8 ? "danger" : criticalRate >= 15 || cancelRate >= 4 ? "warning" : "success"}>
              {opsStatus.label}
            </AdminPill>
          }
        >
          <div className="space-y-1">
            {healthRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 border-b border-[var(--admin-border)] py-3 last:border-0">
                <span className="text-[13px] text-[var(--admin-text-secondary)]">{row.label}</span>
                <AdminPill tone={row.value === "Crítico" ? "danger" : row.value === "Atenção" ? "warning" : "success"}>{row.value}</AdminPill>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[12px] bg-[var(--admin-surface-alt)] p-3">
              <p className="text-[11px] font-medium text-[var(--admin-text-muted)]">Fila ativa</p>
              <p className="mt-1 text-xl font-semibold tracking-[-.02em] text-[var(--admin-text-primary)]">{activeOrders.length}</p>
            </div>
            <div className="rounded-[12px] bg-[var(--admin-surface-alt)] p-3">
              <p className="text-[11px] font-medium text-[var(--admin-text-muted)]">Pedidos em risco</p>
              <p className="mt-1 text-xl font-semibold tracking-[-.02em] text-[var(--admin-danger)]">{criticalOrders.length}</p>
            </div>
            <div className="rounded-[12px] bg-[var(--admin-surface-alt)] p-3">
              <p className="text-[11px] font-medium text-[var(--admin-text-muted)]">Motoboys ativos</p>
              <p className="mt-1 text-xl font-semibold tracking-[-.02em] text-[var(--admin-text-primary)]">{activeDrivers}</p>
            </div>
            <div className="rounded-[12px] bg-[var(--admin-surface-alt)] p-3">
              <p className="text-[11px] font-medium text-[var(--admin-text-muted)]">Carga / motoboy</p>
              <p className="mt-1 text-xl font-semibold tracking-[-.02em] text-[var(--admin-text-primary)]">{loadPerDriver.toFixed(1)}x</p>
            </div>
          </div>
        </AdminSurface>
      </div>

      <div className="admin-dashboard-three">
        <AdminSurface title="Pedidos por status" subtitle="Distribuição do volume no período.">
          <div className="space-y-3">
            {statusRows.map((row) => {
              const max = Math.max(periodOrdersAll.length, 1);
              const width = `${(row.value / max) * 100}%`;
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === row.key ? null : row.key)}
                  className="block w-full rounded-[10px] p-1.5 text-left transition-colors hover:bg-[var(--admin-surface-alt)]"
                  aria-pressed={statusFilter === row.key}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-[var(--admin-text-secondary)]">{row.label}</span>
                    <span className="text-[13px] font-semibold text-[var(--admin-text-primary)]">{row.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F0F1F3]">
                    <div className="h-full rounded-full transition-all" style={{ width, background: row.color }} />
                  </div>
                </button>
              );
            })}
          </div>
          {statusFilter && (
            <button type="button" onClick={() => setStatusFilter(null)} className="mt-4 text-xs font-semibold text-[var(--admin-brand-700)] hover:underline">
              Limpar filtro de status
            </button>
          )}
        </AdminSurface>

        <AdminSurface title="Canais de venda" subtitle="Participação de cada origem na receita.">
          {sourceMix.length === 0 ? (
            <AdminEmptyState title="Sem canais para comparar" description="Os canais aparecerão quando houver pedidos no período." />
          ) : (
            <div className="space-y-4">
              {sourceMix.slice(0, 5).map((row, index) => {
                const share = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={row.key}>
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="font-medium text-[var(--admin-text-secondary)]">{row.label}</span>
                      <span className="font-semibold text-[var(--admin-text-primary)]">{share.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-[#F0F1F3]">
                      <div className="h-full rounded-full" style={{ width: `${share}%`, background: chartPalette[index % chartPalette.length] }} />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">{row.orders} pedidos • {formatCompactCurrency(row.revenue)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </AdminSurface>

        <AdminSurface title="Horários" subtitle="Distribuição do volume ao longo do dia.">
          {loadingPeriod ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <AdminSkeleton key={index} />)}</div>
          ) : periodOrdersAll.length === 0 ? (
            <AdminEmptyState title="Sem volume por horário" description="O gráfico será preenchido quando houver pedidos." />
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyVolume} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEDEF" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#979AA3" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "#979AA3" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #E7E8EC", boxShadow: "0 8px 30px rgba(16,24,40,.08)" }}
                    formatter={(value: number, _name: string, payload: { payload?: { receita: number } }) => [value, payload.payload ? formatCompactCurrency(payload.payload.receita) : ""]}
                  />
                  <Bar dataKey="pedidos" radius={[6, 6, 0, 0]} maxBarSize={20} fill="#631014" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminSurface>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AdminSurface title="Produtos mais vendidos" subtitle="Itens que mais puxam volume no período.">
          {loadingProducts ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <AdminSkeleton key={index} />)}</div>
          ) : !topProducts?.length ? (
            <AdminEmptyState title="Sem ranking de produtos" description="O ranking aparecerá assim que houver vendas no período." />
          ) : (
            <div className="divide-y divide-[var(--admin-border)]">
              {topProducts.slice(0, 6).map((product, index) => (
                <div key={`${product.productName}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--admin-brand-50)] text-xs font-semibold text-[var(--admin-brand-800)]">{index + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--admin-text-primary)]">{product.productName}</p>
                  <span className="text-[13px] font-semibold text-[var(--admin-text-secondary)]">{product.totalQuantity}x</span>
                </div>
              ))}
            </div>
          )}
        </AdminSurface>

        <AdminSurface title="Bairros e regiões" subtitle="Volume e tempo médio das entregas concluídas.">
          {neighborhoodRows.length === 0 ? (
            <AdminEmptyState title="Sem dados de região" description="As regiões aparecerão quando existirem entregas concluídas com endereço." />
          ) : (
            <div className="divide-y divide-[var(--admin-border)]">
              {neighborhoodRows.map((row) => (
                <div key={row.name} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--admin-text-primary)]">{row.name}</p>
                    <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">{row.orders} pedidos • {formatCompactCurrency(row.revenue)}</p>
                  </div>
                  <span className="text-[12px] font-semibold text-[var(--admin-text-secondary)]">{row.avgMinutes.toFixed(0)} min</span>
                  <AdminPill tone={row.status === "crítico" ? "danger" : row.status === "atenção" ? "warning" : "success"}>{row.status}</AdminPill>
                </div>
              ))}
            </div>
          )}
        </AdminSurface>
      </div>

      <section className="space-y-3">
        <div>
          <AdminSectionLabel>Bonatto Intelligence</AdminSectionLabel>
          <h2 className="mt-1 text-[20px] font-semibold tracking-[-.02em] text-[var(--admin-text-primary)]">O que merece atenção agora</h2>
          <p className="mt-1 text-[13px] text-[var(--admin-text-secondary)]">Insights derivados dos dados reais do período e da fila operacional atual.</p>
        </div>
        {recommendations.length === 0 ? (
          <AdminSurface>
            <AdminEmptyState
              icon={<Zap className="h-8 w-8" />}
              title="Sem insights suficientes"
              description="Quando houver dados suficientes, os principais sinais operacionais aparecerão aqui."
            />
          </AdminSurface>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((item, index) => (
              <AdminInsightCard
                key={item}
                eyebrow={index === 1 ? "Risco" : index === 2 ? "Atenção" : index === 3 ? "Produto" : "Insight"}
                title={item}
                icon={index === 1 ? <Clock className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                tone={index === 1 ? "danger" : index === 2 ? "warning" : "brand"}
              />
            ))}
          </div>
        )}
      </section>

      <AdminSurface
        title="Pedidos recentes"
        subtitle="Radar operacional dos últimos pedidos recebidos."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Buscar pedido ou cliente" className="w-full sm:w-[250px]" />
            <AdminPill tone="neutral">{filteredRecentOrders.length} visíveis</AdminPill>
          </div>
        }
        flush
      >
        {loadingRecent ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, index) => <AdminSkeleton key={index} className="h-14" />)}
          </div>
        ) : filteredRecentOrders.length === 0 ? (
          <AdminEmptyState
            title={searchQuery || statusFilter ? "Nenhum pedido encontrado" : "Sem pedidos recentes"}
            description={searchQuery || statusFilter ? "Ajuste a busca ou limpe o filtro de status." : "Os pedidos recentes aparecerão aqui automaticamente."}
          />
        ) : (
          <AdminDataTableShell className="rounded-none border-0">
            <table className="admin-data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                  <th>Horário</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-semibold">#{order.id}</td>
                    <td>{order.customerName}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[order.status] ?? "bg-[#F2F3F5] text-[#676A73]"}`}>
                        {STATUS_LABELS[order.status]?.label ?? order.status}
                      </span>
                    </td>
                    <td>{paymentLabels[order.paymentMethod] ?? order.paymentMethod}</td>
                    <td className="font-semibold">{formatCompactCurrency(Number(order.total))}</td>
                    <td className="text-[var(--admin-text-secondary)]">
                      {new Date(order.createdAt).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminDataTableShell>
        )}
      </AdminSurface>
    </AdminPage>
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

const STATUS_CHIPS = [
  { value: "all", label: "Todos", color: "bg-muted text-muted-foreground hover:bg-muted/80" },
  { value: "pending", label: "Aguardando", color: "bg-[#fff8f0] text-[#7a3a00] hover:bg-[#ffeedd]" },
  { value: "confirmed", label: "Confirmado", color: "bg-[#fce8e8] text-[#6E0D12] hover:bg-[#f9d0d0]" },
  { value: "preparing", label: "Preparando", color: "bg-[#f9d0d0] text-[#5a0a0f] hover:bg-[#f5b8b8]" },
  { value: "out_for_delivery", label: "Na Entrega", color: "bg-[#6E0D12] text-white hover:bg-[#5a0a0f]" },
  { value: "delivered", label: "Entregue", color: "bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]" },
  { value: "cancelled", label: "Cancelado", color: "bg-[#f5f5f5] text-[#6b7280] hover:bg-[#e5e7eb]" },
];

type OperationalRisk = "ok" | "attention" | "critical";

function getOperationalRisk(order: any, nowMs = Date.now()): OperationalRisk {
  if (!order || order.status === "delivered" || order.status === "cancelled") return "ok";
  const createdAt = new Date(order.createdAt).getTime();
  const ageMinutes = Math.max(0, Math.floor((nowMs - createdAt) / 60000));

  if (order.status === "out_for_delivery" && order.predictedDeliveredAt) {
    const predicted = new Date(order.predictedDeliveredAt).getTime();
    if (Number.isFinite(predicted)) {
      const deltaMinutes = Math.floor((nowMs - predicted) / 60000);
      if (deltaMinutes >= 10) return "critical";
      if (deltaMinutes >= 0) return "attention";
    }
  }

  const thresholds: Record<string, { attention: number; critical: number }> = {
    pending: { attention: 10, critical: 15 },
    confirmed: { attention: 15, critical: 20 },
    preparing: { attention: 30, critical: 40 },
    out_for_delivery: { attention: 55, critical: 70 },
  };
  const threshold = thresholds[order.status];
  if (!threshold) return "ok";
  if (ageMinutes >= threshold.critical) return "critical";
  if (ageMinutes >= threshold.attention) return "attention";
  return "ok";
}

function ElapsedTime({
  createdAt,
  status,
  predictedDeliveredAt,
}: {
  createdAt: string | number | Date;
  status?: string;
  predictedDeliveredAt?: string | number | Date | null;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.max(0, Math.floor((nowMs - new Date(createdAt).getTime()) / 60000));
  const risk = getOperationalRisk({ createdAt, status, predictedDeliveredAt }, nowMs);
  const label = elapsed < 60 ? `${elapsed}min` : `${Math.floor(elapsed / 60)}h${elapsed % 60 > 0 ? ` ${elapsed % 60}min` : ""}`;
  const riskClass =
    risk === "critical"
      ? "bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]"
      : risk === "attention"
        ? "bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]"
        : "bg-[var(--admin-surface-alt)] text-[var(--admin-text-secondary)]";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${riskClass}`}>
      <Clock className="mr-1 h-3 w-3" />
      {label}
      {risk === "critical" ? " • atrasado" : risk === "attention" ? " • atenção" : ""}
    </span>
  );
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
type OrderStatus = "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

const KANBAN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["preparing", "out_for_delivery", "cancelled"],
  preparing: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

function KanbanCard({ order, onOpen, overlay = false }: { order: any; onOpen: (o: any) => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: overlay ? `overlay-${order.id}` : `order-${order.id}`,
    data: { order },
    disabled: overlay,
  });
  const style = transform && !overlay
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const risk = getOperationalRisk(order);
  const displayNumber = order.orderNumber || String(order.id);
  const riskBorder =
    risk === "critical"
      ? "border-[var(--admin-danger)] shadow-[0_8px_26px_rgba(217,45,32,0.12)]"
      : risk === "attention"
        ? "border-[var(--admin-warning)]"
        : "border-[var(--admin-border)]";

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(order)}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`Pedido ${displayNumber}, ${order.customerName}. Segure e arraste para alterar a etapa.`}
      className={`group relative w-full touch-manipulation select-none space-y-2 overflow-hidden rounded-2xl border bg-white p-3.5 text-left shadow-[var(--admin-shadow-sm)] transition-[transform,box-shadow,opacity,border-color] duration-200 ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none active:scale-[0.985] ${riskBorder} ${
        overlay ? "rotate-2 scale-[1.02] border-[#8d171d] shadow-[0_24px_60px_rgba(55,12,15,0.24)]" : "hover:-translate-y-0.5 hover:border-[#c99a96] hover:shadow-[0_12px_30px_rgba(55,12,15,0.12)]"
      } ${isDragging ? "z-10 opacity-25" : "opacity-100"}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${risk === "critical" ? "bg-[var(--admin-danger)]" : risk === "attention" ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-brand-800)]"}`} />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold tracking-tight text-[var(--admin-text-primary)]">#{displayNumber}</span>
        <div className="flex shrink-0 items-center gap-1">
          <ElapsedTime createdAt={order.createdAt} status={order.status} predictedDeliveredAt={order.predictedDeliveredAt} />
          <GripVertical className="h-4 w-4 text-[#bda9a6] transition-colors group-hover:text-[#6e0d12]" aria-hidden="true" />
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
        <p className="truncate rounded-lg bg-[#fff3ef] px-2 py-1.5 text-xs text-[#6e0d12]">Observação: {order.notes}</p>
      )}
    </button>
  );
}

function KanbanColumn({ col, orders, activeOrder, onOpen, visibleLimit, onShowMore }: { col: (typeof KANBAN_COLS_LIGHT)[number]; orders: any[]; activeOrder: any | null; onOpen: (order: any) => void; visibleLimit: number; onShowMore: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${col.status}` });
  const canReceive = activeOrder
    ? KANBAN_TRANSITIONS[activeOrder.status as OrderStatus]?.includes(col.status as OrderStatus)
    : false;
  const visibleOrders = orders.slice(0, visibleLimit);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${col.label}, ${orders.length} pedidos`}
      className={`flex min-h-[440px] w-[286px] shrink-0 flex-col overflow-hidden rounded-[20px] border bg-[#f8f2ef] transition-[border-color,box-shadow,transform,background-color] duration-200 ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none md:w-[304px] ${
        isOver && canReceive
          ? "-translate-y-1 border-[#8d171d] bg-[#fff8f4] shadow-[0_18px_55px_rgba(110,13,18,0.16)]"
          : isOver
            ? "border-red-300 bg-red-50/70"
            : "border-[#ead9d5] shadow-[0_8px_30px_rgba(66,9,12,0.05)]"
      }`}
    >
      <header className="sticky top-0 z-[1] flex items-center justify-between border-b border-[#ead9d5] bg-[#fffaf7]/95 px-4 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_rgba(110,13,18,0.06)] ${col.dot}`} />
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#541015]">{col.label}</span>
        </div>
        <span className="min-w-7 rounded-full bg-[#6e0d12] px-2 py-1 text-center text-[11px] font-black text-white">{orders.length}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        {orders.length === 0 ? (
          <div className={`grid min-h-40 flex-1 place-items-center rounded-2xl border border-dashed px-5 text-center transition-colors ${isOver ? "border-[#8d171d]/40 bg-white/70" : "border-[#dbc5c0]"}`}>
            <div>
              <Package className="mx-auto mb-2 h-7 w-7 text-[#c7aaa5]" aria-hidden="true" />
              <p className="text-xs font-semibold text-[#987d79]">Solte um pedido aqui</p>
            </div>
          </div>
        ) : (
          <>
            {visibleOrders.map(order => <KanbanCard key={order.id} order={order} onOpen={onOpen} />)}
            {orders.length > visibleOrders.length && (
              <button
                data-help-id="orders.showMore"
                type="button"
                onClick={onShowMore}
                className="mt-1 rounded-xl border border-[#d9bbb6] bg-white px-3 py-2.5 text-xs font-bold text-[#6e0d12] transition-[transform,background-color] duration-150 hover:bg-[#fff6f2] active:scale-[0.98]"
              >
                Mostrar mais {Math.min(40, orders.length - visibleOrders.length)} pedidos
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function OrderDetailModal({ order, onClose, drivers }: { order: any; onClose: () => void; drivers: any[] }) {
  const utils = trpc.useUtils();
  const [selectedDriver, setSelectedDriver] = useState(
    order.driverId ? String(order.driverId) : "",
  );
  const [assignedDriverId, setAssignedDriverId] = useState<number | null>(
    order.driverId ?? null,
  );
  const [pixConfirmedLocally, setPixConfirmedLocally] = useState(order.paymentStatus === "paid");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState<
    "" | "customer_request" | "payment" | "address" | "out_of_stock" | "delay" | "operational" | "other"
  >("");
  const [cancelReason, setCancelReason] = useState("");
  const s = STATUS_LABELS[order.status];
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
    onSuccess: (_data, variables) => {
      utils.orders.list.invalidate();
      setSelectedDriver(variables.driverId ? String(variables.driverId) : "");
      setAssignedDriverId(variables.driverId);
      toast.success(
        variables.driverId
          ? "Motoboy atribuído ao pedido."
          : "Motoboy removido do pedido.",
      );
    },
    onError: (error) => toast.error("Erro ao atribuir motoboy", { description: error.message }),
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
            <span className="font-black text-xl">#{order.orderNumber || order.id}</span>
            <Badge className={`${s?.color} border-0`}>{s?.label}</Badge>
            {pixConfirmedLocally && (
              <Badge className="bg-[#f0fdf4] text-[#166534] border-0 text-xs gap-1"><CheckCircle className="w-3 h-3" />Pago</Badge>
            )}
            {pixNeedsReceipt && (
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs">PIX pendente</Badge>
            )}
          </div>
          <button data-help-id="common.cancel" type="button" onClick={onClose} aria-label="Fechar detalhes do pedido" className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-semibold">{order.customerName}</span></div>
            <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" /><span>{order.customerPhone}</span></div>
            <div className="flex items-center gap-1.5 col-span-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate">{order.deliveryAddress}</span></div>
            <div className="flex items-center gap-1.5 col-span-2 text-xs text-muted-foreground"><Clock className="w-3 h-3" /><span>{new Date(order.createdAt).toLocaleString("pt-BR")}</span><ElapsedTime createdAt={order.createdAt} status={order.status} predictedDeliveredAt={order.predictedDeliveredAt} /></div>
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
              <p className="font-bold">PIX aguardando confirmação</p>
              <p className="mt-1 text-xs text-amber-800">Marque como recebido antes de enviar o pedido para preparo.</p>
              <Button
                data-help-id="orders.confirmPix"
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
                  data-help-id="orders.nfce"
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

          {/* Driver assignment — independent from order status */}
          {order.serviceType === "delivery" && !["delivered", "cancelled"].includes(order.status) && (
            <div className="rounded-xl border border-[#ead9d9] bg-[#fffafa] p-3.5">
              <div className="mb-2.5 flex items-center gap-2">
                <Bike className="h-4 w-4 text-[#73151B]" />
                <div>
                  <p className="text-sm font-bold text-foreground">Motoboy responsável</p>
                  <p className="text-[11px] text-muted-foreground">
                    Você pode atribuir ou trocar o motoboy sem alterar o status do pedido.
                  </p>
                </div>
              </div>

              {activeDrivers.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={selectedDriver || "__none__"}
                    onValueChange={(value) => setSelectedDriver(value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger className="h-9 flex-1 text-xs">
                      <SelectValue placeholder="Selecionar motoboy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem motoboy</SelectItem>
                      {activeDrivers.map((driver) => (
                        <SelectItem key={driver.id} value={String(driver.id)}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    data-help-id="orders.assignDriver"
                    type="button"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    disabled={assignDriver.isPending}
                    onClick={() => assignDriver.mutate({
                      orderId: order.id,
                      driverId: selectedDriver ? Number(selectedDriver) : null,
                    })}
                  >
                    {assignDriver.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bike className="h-3.5 w-3.5" />
                    )}
                    {assignedDriverId ? "Atualizar motoboy" : "Atribuir motoboy"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-amber-700">
                  Nenhum motoboy ativo cadastrado para esta unidade.
                </p>
              )}
            </div>
          )}

          {/* Status Actions */}
          {s?.next && (
            <div className="pt-3 border-t space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Button
                  data-help-id="orders.advance"
                  size="sm"
                  onClick={async () => {
                    if (s.next === "preparing" && pixNeedsReceipt) {
                      toast.error("Marque o PIX como recebido antes de preparar o pedido.");
                      return;
                    }

                    try {
                      if (
                        s.next === "out_for_delivery"
                        && selectedDriver
                        && Number(selectedDriver) !== assignedDriverId
                      ) {
                        await assignDriver.mutateAsync({
                          orderId: order.id,
                          driverId: Number(selectedDriver),
                        });
                      }

                      await updateStatus.mutateAsync({ id: order.id, status: s.next as any });
                    } catch {
                      // Each mutation already shows the specific backend error.
                    }
                  }}
                  disabled={
                    updateStatus.isPending
                    || assignDriver.isPending
                    || (s.next === "preparing" && pixNeedsReceipt)
                  }
                  className="gap-1.5"
                >
                  {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Avançar para: {STATUS_LABELS[s.next]?.label}
                </Button>
                {order.status !== "cancelled" && (
                  <Button
                    data-help-id="orders.cancel"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCancelForm((value) => !value)}
                    disabled={updateStatus.isPending}
                    className="text-destructive hover:text-destructive border-destructive/30"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />Cancelar
                  </Button>
                )}
              </div>

              {showCancelForm && order.status !== "cancelled" && (
                <div className="mt-3 space-y-3 rounded-[12px] border border-[var(--admin-danger)]/20 bg-[var(--admin-danger-bg)] p-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-text-primary)]">Motivo do cancelamento</p>
                    <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">Esse dado será usado nos indicadores operacionais e na auditoria.</p>
                  </div>
                  <Select value={cancelReasonCode} onValueChange={(value) => setCancelReasonCode(value as typeof cancelReasonCode)}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer_request">Cliente desistiu</SelectItem>
                      <SelectItem value="payment">Pagamento</SelectItem>
                      <SelectItem value="address">Endereço / localização</SelectItem>
                      <SelectItem value="out_of_stock">Falta de produto</SelectItem>
                      <SelectItem value="delay">Atraso</SelectItem>
                      <SelectItem value="operational">Problema operacional</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Descreva o motivo com pelo menos 3 caracteres..."
                    className="w-full rounded-[10px] border border-[var(--admin-input-border)] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowCancelForm(false)}>Voltar</Button>
                    <Button
                      data-help-id="orders.confirmCancel"
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={updateStatus.isPending || !cancelReasonCode || cancelReason.trim().length < 3}
                      onClick={() => updateStatus.mutate({
                        id: order.id,
                        status: "cancelled",
                        cancellationReasonCode: cancelReasonCode || undefined,
                        cancellationReason: cancelReason.trim() || undefined,
                      })}
                    >
                      {updateStatus.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Confirmar cancelamento
                    </Button>
                  </div>
                </div>
              )}
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
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<number, OrderStatus>>({});
  const [visibleLimits, setVisibleLimits] = useState<Record<OrderStatus, number>>({
    pending: 40,
    confirmed: 40,
    preparing: 40,
    out_for_delivery: 40,
    delivered: 40,
    cancelled: 40,
  });
  const [showCancelled, setShowCancelled] = useState(false);
  const [operationNow, setOperationNow] = useState(() => Date.now());
  const { selectedStoreId, selectedStoreName } = useAdminStore();

  useEffect(() => {
    const timer = setInterval(() => setOperationNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const { data: allOrders, isLoading, dataUpdatedAt } = trpc.orders.list.useQuery(
    { limit: 1000, storeId: selectedStoreId },
    { refetchInterval: false }
  );
  const { data: drivers } = trpc.drivers.list.useQuery(
    { storeId: selectedStoreId },
    { refetchInterval: 10000, refetchIntervalInBackground: true },
  );
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );
  const moveOrder = trpc.orders.updateStatus.useMutation({
    onSuccess: (_data, variables) => {
      utils.orders.list.invalidate();
      setOptimisticStatuses(current => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      const changedOrder = allOrders?.find((order) => order.id === variables.id);
      toast.success(`Pedido #${changedOrder?.orderNumber || variables.id} movido para ${STATUS_LABELS[variables.status]?.label}.`);
    },
    onError: (error, variables) => {
      setOptimisticStatuses(current => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      toast.error(error.message);
    },
  });

  // Filter by search
  const filteredOrders = allOrders?.map(order => ({
    ...order,
    status: optimisticStatuses[order.id] ?? order.status,
  })).filter(o => {
    const q = searchQuery.toLowerCase().trim();
    return !q ||
      o.customerName?.toLowerCase().includes(q) ||
      String(o.id).includes(q) ||
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q);
  }) ?? [];

  const activeOperationalOrders = filteredOrders.filter((order) =>
    ["pending", "confirmed", "preparing", "out_for_delivery"].includes(order.status),
  );
  const attentionOrders = activeOperationalOrders.filter((order) => getOperationalRisk(order, operationNow) === "attention");
  const criticalOrders = activeOperationalOrders.filter((order) => getOperationalRisk(order, operationNow) === "critical");
  const waitingDriverOrders = activeOperationalOrders.filter((order) =>
    order.serviceType === "delivery" &&
    !order.driverId &&
    (order.status === "preparing" || order.status === "out_for_delivery"),
  );
  const activeDriversCount = (drivers ?? []).filter((driver) => driver.active).length;
  const lastSyncLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  // Group by status
  const byStatus = (status: string) => filteredOrders.filter(o => o.status === status);
  const openOrder = (order: any) => {
    setSelectedOrder(order);
    onOpenOrder?.();
  };
  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveOrder(active.data.current?.order ?? null);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const order = active.data.current?.order ?? activeOrder;
    setActiveOrder(null);
    if (!order || !over || moveOrder.isPending) return;

    const targetStatus = String(over.id).replace("column-", "") as OrderStatus;
    const sourceStatus = order.status as OrderStatus;
    if (targetStatus === sourceStatus) return;
    if (targetStatus === "cancelled") {
      toast.error("Abra o pedido para cancelar e informar o motivo.");
      return;
    }
    if (!KANBAN_TRANSITIONS[sourceStatus]?.includes(targetStatus)) {
      toast.error("Esse pedido não pode ser movido diretamente para essa etapa.");
      return;
    }
    if (targetStatus === "preparing" && order.paymentMethod === "pix" && order.paymentStatus !== "paid") {
      toast.error("Confirme o recebimento do PIX antes de preparar o pedido.");
      return;
    }

    setOptimisticStatuses(current => ({ ...current, [order.id]: targetStatus }));
    moveOrder.mutate({ id: order.id, status: targetStatus });
  };

  return (
    <AdminPage>
      <AdminTopbar
        title="Central de pedidos"
        subtitle={`${selectedStoreName} • atualização automática a cada 5s • última sincronização ${lastSyncLabel}`}
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

      <AdminStatGrid className="xl:grid-cols-5">
        <AdminStat
          label="Novos"
          value={byStatus("pending").length}
          icon={<ShoppingBag className="h-4 w-4" />}
          sub="Aguardando confirmação"
        />
        <AdminStat
          label="Em preparo"
          value={byStatus("preparing").length}
          icon={<ChefHat className="h-4 w-4" />}
          sub={attentionOrders.length ? `${attentionOrders.length} em atenção` : "Fila dentro da meta"}
        />
        <AdminStat
          label="Em entrega"
          value={byStatus("out_for_delivery").length}
          icon={<Truck className="h-4 w-4" />}
          sub={`${activeDriversCount} motoboy${activeDriversCount === 1 ? "" : "s"} ativo${activeDriversCount === 1 ? "" : "s"}`}
        />
        <AdminStat
          label="Atrasados"
          value={criticalOrders.length}
          icon={<Clock className="h-4 w-4" />}
          trend={criticalOrders.length > 0 ? "down" : "neutral"}
          trendLabel={criticalOrders.length > 0 ? "Ação necessária" : "Sob controle"}
          sub="Pedidos fora do SLA"
        />
        <AdminStat
          label="Sem motoboy"
          value={waitingDriverOrders.length}
          icon={<Bike className="h-4 w-4" />}
          trend={waitingDriverOrders.length > 0 ? "down" : "neutral"}
          trendLabel={waitingDriverOrders.length > 0 ? "Atribuir" : "Normal"}
          sub="Delivery em preparo/saída"
        />
      </AdminStatGrid>

      {(criticalOrders.length > 0 || attentionOrders.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[var(--admin-border)] bg-white px-4 py-3 text-xs">
          <span className="font-semibold text-[var(--admin-text-primary)]">Fila operacional:</span>
          {criticalOrders.length > 0 && (
            <AdminPill tone="danger">{criticalOrders.length} atrasado{criticalOrders.length === 1 ? "" : "s"}</AdminPill>
          )}
          {attentionOrders.length > 0 && (
            <AdminPill tone="warning">{attentionOrders.length} em atenção</AdminPill>
          )}
          <span className="text-[var(--admin-text-secondary)]">Priorize os cards destacados no Kanban.</span>
        </div>
      )}

      <div className="admin-toolbar">
        <AdminSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nome, telefone ou número do pedido..."
        />
        <div className="hidden items-center gap-2 rounded-xl border border-[#ead9d5] bg-[#fffaf7] px-3 py-2 text-xs font-semibold text-[#6e0d12] md:flex">
          <GripVertical className="h-4 w-4" aria-hidden="true" />
          Segure e arraste os pedidos entre as etapas
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragCancel={() => setActiveOrder(null)} onDragEnd={handleDragEnd}>
          <div className="relative -mx-2 overflow-x-auto px-2 pb-5 [scrollbar-color:#c99a96_transparent]">
            <div className="flex min-w-max items-start gap-3">
              {KANBAN_COLS_LIGHT.filter(col => !col.hideable || showCancelled).map(col => (
                <KanbanColumn
                  key={col.status}
                  col={col}
                  orders={byStatus(col.status)}
                  activeOrder={activeOrder}
                  onOpen={openOrder}
                  visibleLimit={visibleLimits[col.status as OrderStatus]}
                  onShowMore={() => setVisibleLimits(current => ({
                    ...current,
                    [col.status]: current[col.status as OrderStatus] + 40,
                  }))}
                />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.23,1,.32,1)" }}>
            {activeOrder ? (
              <div className="w-[286px] md:w-[304px]">
                <KanbanCard order={activeOrder} onOpen={() => undefined} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
  const { selectedStoreId, stores } = useAdminStore();
  const { data: categories } = trpc.categories.listAll.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const { data: products, isLoading } = trpc.products.listAll.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(() => new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<number | undefined>();
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [newProductCategoryId, setNewProductCategoryId] = useState<number | undefined>();
  const [performanceProductId, setPerformanceProductId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCatalogReplication, setShowCatalogReplication] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState<"structure" | "products" | "categories" | "modifiers" | "performance" | "slides" | "carousel">("structure");
  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [catForm, setCatForm] = useState({ name: "", slug: "", description: "", sortOrder: "", icon: "", imageUrl: "" });
  const [magnificCategoryImages, setMagnificCategoryImages] = useState<MagnificCategoryImageAsset[]>([]);
  const [magnificIcons, setMagnificIcons] = useState<MagnificIconAsset[]>([]);
  const { data: storeSettings } = trpc.storeSettings.get.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const [menuLayout, setMenuLayout] = useState<"editorial" | "compact" | "visual">("editorial");

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

  const batchProducts = trpc.products.batchUpdate.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.products.listAll.invalidate(),
        utils.products.list.invalidate(),
        utils.catalog.adminProductSummaries.invalidate(),
        utils.catalog.adminModifierGroups.invalidate(),
      ]);
      setSelectedProductIds(new Set());
      setBulkCategoryId(undefined);
      toast.success(`${result.count} produto(s) atualizado(s).`);
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
  const handleCategoryImageFile = async (file: File) => {
    if (!file) return;
    setCategoryImageUploading(true);
    try {
      const data = await uploadImageFile({ file, scope: "category", storeId: selectedStoreId });
      setCatForm((current) => ({ ...current, imageUrl: data.url }));
      toast.success("Imagem da categoria enviada!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setCategoryImageUploading(false);
    }
  };

  const filteredProducts = (products ?? []).filter((product) => {
    if (selectedCatId && product.categoryId !== selectedCatId) return false;
    if (productStatusFilter === "active" && !product.active) return false;
    if (productStatusFilter === "paused" && product.active) return false;
    const term = productSearch.trim().toLowerCase();
    if (term) {
      const categoryName = categories?.find((category) => category.id === product.categoryId)?.name ?? "";
      const haystack = `${product.name} ${product.description ?? ""} ${categoryName}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const activeProductCount = (products ?? []).filter((product) => product.active).length;
  const pausedProductCount = (products ?? []).length - activeProductCount;

  useEffect(() => {
    setProductPage(1);
    setSelectedProductIds(new Set());
  }, [selectedCatId, productSearch, productStatusFilter, selectedStoreId]);

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
    if (["editorial", "compact", "visual"].includes(storeSettings?.menuLayout ?? "")) {
      setMenuLayout(storeSettings?.menuLayout as "editorial" | "compact" | "visual");
    }
  }, [storeSettings?.menuLayout]);

  const saveMenuLayout = trpc.storeSettings.saveMenuLayout.useMutation({
    onSuccess: async () => {
      await utils.storeSettings.get.invalidate();
      toast.success("Layout do cardápio atualizado!");
    },
    onError: (error) => toast.error(error.message),
  });

  const PRODUCTS_PER_PAGE = 10;
  const [productPage, setProductPage] = useState(1);
  const totalProductPages = Math.max(1, Math.ceil((filteredProducts?.length ?? 0) / PRODUCTS_PER_PAGE));
  const paginatedProducts = filteredProducts.slice(
    (productPage - 1) * PRODUCTS_PER_PAGE,
    productPage * PRODUCTS_PER_PAGE,
  );
  const allFilteredProductsSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedProductIds.has(product.id));

  // Slides
  const { data: slides } = trpc.menuSlides.listAll.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const [showSlideForm, setShowSlideForm] = useState(false);
  const [editingSlide, setEditingSlide] = useState<any | null>(null);
  const [slideForm, setSlideForm] = useState({ title: "", subtitle: "", imageUrl: "", videoUrl: "", badgeText: "", ctaText: "", ctaLink: "", sortOrder: "" });
  const [slideImageUploading, setSlideImageUploading] = useState(false);
  const slideImageInputRef = useRef<HTMLInputElement>(null);
  const handleSlideImageFile = async (file: File) => {
    if (!file) return;
    setSlideImageUploading(true);
    try {
      const data = await uploadImageFile({ file, scope: "banner", storeId: selectedStoreId });
      setSlideForm((current) => ({ ...current, imageUrl: data.url }));
      toast.success("Imagem enviada!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setSlideImageUploading(false);
    }
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
    if (editingSlide) updateSlide.mutate({ id: editingSlide.id, storeId: selectedStoreId, ...data });
    else createSlide.mutate({ ...data, storeId: selectedStoreId });
  };

  const startEditSlide = (slide: any) => {
    setEditingSlide(slide);
    setSlideForm({ title: slide.title, subtitle: slide.subtitle ?? "", imageUrl: slide.imageUrl ?? "", videoUrl: slide.videoUrl ?? "", badgeText: slide.badgeText ?? "", ctaText: slide.ctaText ?? "", ctaLink: slide.ctaLink ?? "", sortOrder: String(slide.sortOrder ?? "") });
    setShowSlideForm(true);
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
        storeId: selectedStoreId,
      });
    } else {
      createCategoryMut.mutate({
        name: catForm.name,
        slug: slugVal,
        icon: catForm.icon || undefined,
        imageUrl: catForm.imageUrl || undefined,
        description: catForm.description || undefined,
        sortOrder: catForm.sortOrder ? parseInt(catForm.sortOrder) : undefined,
        storeId: selectedStoreId,
      });
    }
  };

  const startEdit = (product: any) => {
    setEditingProduct(product);
    setNewProductCategoryId(undefined);
    setShowForm(true);
    setActiveMenuTab("products");
  };

  const startCreateProduct = (categoryId?: number) => {
    setEditingProduct(null);
    setNewProductCategoryId(categoryId);
    setShowCatForm(false);
    setShowForm(true);
    setActiveMenuTab("products");
  };

  const openProductPerformance = (productId: number) => {
    setPerformanceProductId(productId);
    setActiveMenuTab("performance");
  };

  const startEditCat = (cat: any) => {
    setActiveMenuTab("categories");
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
    { id: "structure" as const, label: "Cardápio", count: products?.length ?? 0 },
    { id: "products" as const, label: "Produtos", count: products?.length ?? 0 },
    { id: "categories" as const, label: "Categorias", count: categories?.length ?? 0 },
    { id: "modifiers" as const, label: "Complementos", count: null as number | null },
    { id: "performance" as const, label: "Desempenho", count: null as number | null },
    { id: "slides" as const, label: "Banners", count: slides?.length ?? 0 },
    { id: "carousel" as const, label: "Carrossel", count: null as number | null },
  ];

  if (selectedStoreId === undefined) {
    return (
      <AdminPage>
        <AdminTopbar title="Cardápio" subtitle="Selecione uma loja para editar o catálogo sem misturar dados entre unidades." />
        <AdminSurface>
          <AdminEmptyState icon={<Store className="h-8 w-8" />} title="Selecione uma loja" description="Use o seletor de unidade no menu do painel para gerenciar produtos, categorias e banners desta loja." />
        </AdminSurface>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminTopbar
        title="Cardápio"
        subtitle="Gerencie a estrutura do cardápio, produtos, complementos e desempenho desta unidade."
        actions={
          <>
            <Button
              data-help-id="catalog.replicate"
              variant="outline"
              onClick={() => setShowCatalogReplication(true)}
              className="h-9 gap-1.5 text-xs"
            >
              <Copy className="h-4 w-4" />
              Sincronizar
            </Button>
            {activeMenuTab === "products" && (
              <Button onClick={() => startCreateProduct()} className="gap-1.5 h-9 text-xs">
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

      <CatalogReplicationDialog
        open={showCatalogReplication}
        onClose={() => setShowCatalogReplication(false)}
        stores={stores}
        initialSourceStoreId={selectedStoreId}
      />

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--admin-divider)' }}>
        {menuSubTabs.map((t) => {
          const active = activeMenuTab === t.id;
          return (
            <button
              key={t.id}
              data-help-id={"menu.tab." + t.id}
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

      {activeMenuTab === "structure" && (
        <MenuStructurePanel
          storeId={selectedStoreId}
          categories={categories ?? []}
          products={products ?? []}
          onCreateCategory={() => {
            setActiveMenuTab("categories");
            setEditingCat(null);
            setCatForm({ name: "", slug: "", description: "", sortOrder: "", icon: "", imageUrl: "" });
            setShowCatForm(true);
            setShowForm(false);
          }}
          onCreateProduct={(categoryId) => startCreateProduct(categoryId)}
          onEditCategory={startEditCat}
          onEditProduct={startEdit}
          onViewProductPerformance={openProductPerformance}
        />
      )}

      {activeMenuTab === "modifiers" && (
        <ModifierGroupsPanel
          storeId={selectedStoreId}
          onEditProduct={(productId) => {
            const product = products?.find((item) => item.id === productId);
            if (product) startEdit(product);
          }}
        />
      )}

      {activeMenuTab === "performance" && (
        <MenuPerformancePanel
          storeId={selectedStoreId}
          categories={(categories ?? []).map((category) => ({ id: category.id, name: category.name }))}
          onEditProduct={(productId) => {
            const product = products?.find((item) => item.id === productId);
            if (product) startEdit(product);
          }}
          focusProductId={performanceProductId}
        />
      )}

      {activeMenuTab === "products" && (
        <div className="space-y-5">
          {showForm ? (
            <ProductCatalogEditor
              key={editingProduct?.id ?? "new-product"}
              storeId={selectedStoreId}
              categories={categories ?? []}
              product={editingProduct}
              defaultCategoryId={newProductCategoryId}
              onClose={() => { setShowForm(false); setEditingProduct(null); setNewProductCategoryId(undefined); }}
              onSaved={async () => {
                setShowForm(false);
                setEditingProduct(null);
                setNewProductCategoryId(undefined);
                await Promise.all([
                  utils.products.listAll.invalidate(),
                  utils.products.list.invalidate(),
                  utils.catalog.adminProductSummaries.invalidate(),
                ]);
              }}
            />
          ) : (
            <>
              <AdminSurface
                title="Experiência do cardápio"
                subtitle="Escolha a forma de navegação desta unidade. Produtos e regras de negócio permanecem os mesmos."
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { id: "editorial", name: "Lista editorial", description: "Imagem generosa, leitura rápida e botão de compra destacado." },
                    { id: "compact", name: "Lista compacta", description: "Mais produtos visíveis e navegação eficiente para cardápios grandes." },
                    { id: "visual", name: "Vitrine visual", description: "Grade de imagens para marcas que vendem primeiro pelo visual." },
                  ] as const).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMenuLayout(option.id)}
                      className={`rounded-[14px] border p-4 text-left transition-colors ${menuLayout === option.id ? "border-[var(--admin-brand-700)] bg-[var(--admin-brand-50)]" : "border-[var(--admin-border)] bg-white hover:border-[var(--admin-border-strong)]"}`}
                    >
                      <p className="font-semibold text-[var(--admin-text-primary)]">{option.name}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--admin-text-secondary)]">{option.description}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => saveMenuLayout.mutate({ storeId: selectedStoreId, layout: menuLayout })}
                    disabled={saveMenuLayout.isPending}
                  >
                    {saveMenuLayout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Aplicar layout
                  </Button>
                </div>
              </AdminSurface>

              <ProductsManagementPanel
                storeId={selectedStoreId}
                onCreate={() => startCreateProduct()}
                onEdit={(product) => startEdit(product)}
              />
            </>
          )}
        </div>
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
                                <p className="truncate text-[11px] text-muted-foreground">Sugestão do pack Magnific</p>
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
                              onClick={() => updateCategoryMut.mutate({ id: cat.id, active: !cat.active, storeId: selectedStoreId })}
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
                                onClick={() => { if (confirm("Remover esta categoria? Os produtos nao serao excluidos.")) deleteCategoryMut.mutate({ id: cat.id, storeId: selectedStoreId }); }}
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
                          onClick={() => updateSlide.mutate({ id: slide.id, storeId: selectedStoreId, isActive: !slide.isActive })}
                          className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                            slide.isActive ? "bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]" : "bg-[#fce8e8] text-[#450709] hover:bg-[#f9d0d0]"
                          }`}
                        >
                          {slide.isActive ? "✓ Ativo" : "✕ Inativo"}
                        </button>
                        <Button size="sm" variant="ghost" onClick={() => startEditSlide(slide)}>Editar</Button>
                        <Button
                          size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Remover este slide?")) deleteSlide.mutate({ id: slide.id, storeId: selectedStoreId }); }}
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
  const { selectedStoreId } = useAdminStore();
  const { data: storeSettings } = trpc.storeSettings.getAdmin.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const { data: images, isLoading } = trpc.carousel.listAll.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const { data: destinationProducts } = trpc.products.list.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined, staleTime: 60_000 },
  );
  const { data: destinationCategories } = trpc.categories.listAll.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined, staleTime: 60_000 },
  );
  const [showForm, setShowForm] = useState(false);
  const [editingImage, setEditingImage] = useState<any | null>(null);
  const [form, setForm] = useState<{
    imageUrl: string;
    title: string;
    sortOrder: string;
    destinationType: "none" | "product" | "category" | "internal" | "external";
    destinationValue: string;
  }>({ imageUrl: "", title: "", sortOrder: "0", destinationType: "none", destinationValue: "" });
  const [uploading, setUploading] = useState(false);
  const [homeConfig, setHomeConfig] = useState<HomeAppConfig>(DEFAULT_HOME_APP_CONFIG);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof storeSettings?.homeLayoutConfig !== "string") return;
    try {
      setHomeConfig({ ...DEFAULT_HOME_APP_CONFIG, ...JSON.parse(storeSettings.homeLayoutConfig) });
    } catch {
      setHomeConfig(DEFAULT_HOME_APP_CONFIG);
    }
  }, [storeSettings?.homeLayoutConfig]);

  const createImage = trpc.carousel.create.useMutation({
    onSuccess: () => { utils.carousel.listAll.invalidate(); utils.carousel.list.invalidate(); setShowForm(false); setForm({ imageUrl: "", title: "", sortOrder: "0", destinationType: "none", destinationValue: "" }); toast.success("Imagem adicionada!"); },
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
  const saveHomeConfig = trpc.storeSettings.saveHomeLayoutConfig.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.storeSettings.get.invalidate(), utils.storeSettings.getAdmin.invalidate()]);
      toast.success("Textos da Home atualizados!");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const data = await uploadImageFile({ file, scope: "carousel", storeId: selectedStoreId });
      setForm((current) => ({ ...current, imageUrl: data.url }));
      toast.success("Imagem enviada!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (img: any) => {
    setEditingImage(img);
    setForm({
      imageUrl: img.imageUrl,
      title: img.title ?? "",
      sortOrder: String(img.sortOrder),
      destinationType: img.destinationType ?? "none",
      destinationValue: img.destinationValue ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      imageUrl: form.imageUrl,
      title: form.title || null,
      sortOrder: parseInt(form.sortOrder) || 0,
      destinationType: form.destinationType,
      destinationValue: form.destinationType === "none" ? null : form.destinationValue || null,
    };
    if (editingImage) {
      updateImage.mutate({ id: editingImage.id, storeId: selectedStoreId, ...data });
    } else {
      createImage.mutate({ ...data, storeId: selectedStoreId });
    }
  };

  const destinationLabel = (img: any) => {
    const type = img.destinationType ?? "none";
    const value = img.destinationValue ?? "";
    if (type === "product") {
      const product = destinationProducts?.find((item) => String(item.id) === String(value));
      return product ? `Produto: ${product.name}` : "Produto selecionado";
    }
    if (type === "category") {
      const category = destinationCategories?.find((item) => String(item.id) === String(value));
      return category ? `Categoria: ${category.name}` : "Categoria selecionada";
    }
    if (type === "internal") return `Página: ${value}`;
    if (type === "external") return `Link: ${value}`;
    return "Sem ação ao clicar";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Textos e atalhos da Home</CardTitle>
          <p className="text-xs text-muted-foreground">Personalize o cabeçalho, o card de pedido e os rótulos exibidos para esta loja.</p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveHomeConfig.mutate({ ...homeConfig, storeId: selectedStoreId });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="home-greeting">Texto abaixo da saudação</Label>
                <Input id="home-greeting" maxLength={100} value={homeConfig.greetingSubtitle} onChange={(event) => setHomeConfig((current) => ({ ...current, greetingSubtitle: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="home-order-title">Título do card de pedido</Label>
                <Input id="home-order-title" maxLength={80} value={homeConfig.orderTitle} onChange={(event) => setHomeConfig((current) => ({ ...current, orderTitle: event.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="home-order-description">Descrição do card</Label>
                <Textarea id="home-order-description" maxLength={180} value={homeConfig.orderDescription} onChange={(event) => setHomeConfig((current) => ({ ...current, orderDescription: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="home-order-button">Texto do botão principal</Label>
                <Input id="home-order-button" maxLength={40} value={homeConfig.orderButtonLabel} onChange={(event) => setHomeConfig((current) => ({ ...current, orderButtonLabel: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="home-quick-title">Título dos atalhos</Label>
                <Input id="home-quick-title" maxLength={60} value={homeConfig.quickActionsTitle} onChange={(event) => setHomeConfig((current) => ({ ...current, quickActionsTitle: event.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {([
                ["offersLabel", "Ofertas"],
                ["couponsLabel", "Cupons"],
                ["clubLabel", "Clube"],
                ["menuLabel", "Cardápio"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`home-${key}`}>{label}</Label>
                  <Input id={`home-${key}`} maxLength={24} value={homeConfig[key]} onChange={(event) => setHomeConfig((current) => ({ ...current, [key]: event.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saveHomeConfig.isPending}>{saveHomeConfig.isPending ? "Salvando..." : "Salvar textos da Home"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Imagens do Carrossel Hero</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie as imagens exibidas no carrossel da página inicial</p>
        </div>
        <Button data-help-id="menu.carousel.add" size="sm" onClick={() => { setEditingImage(null); setForm({ imageUrl: "", title: "", sortOrder: String((images?.length ?? 0) + 1), destinationType: "none", destinationValue: "" }); setShowForm(true); }}>
          + Adicionar Imagem
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">{editingImage ? "Editar Imagem" : "Nova Imagem"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Imagem <span className="text-xs text-muted-foreground">(JPG, PNG ou WebP — até 3 MB; faixas largas serão centralizadas)</span></label>
                <div
                  role="button"
                  tabIndex={0}
                  data-help-id="menu.carousel.image"
                  aria-label={form.imageUrl ? "Trocar imagem do banner" : "Selecionar imagem do banner"}
                  className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                    uploading ? "border-primary/50 bg-primary/5" : "border-input hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onClick={() => !uploading && inputRef.current?.click()}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !uploading) {
                      e.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Legenda (opcional)</label>
                  <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Pizza Margherita" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ordem</label>
                  <input className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background" type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder="1, 2, 3..." />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div>
                  <Label>Ao clicar nesta imagem</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Escolha exatamente para onde o cliente será levado.</p>
                </div>
                <Select
                  value={form.destinationType}
                  onValueChange={(value) => setForm((current) => ({
                    ...current,
                    destinationType: value as typeof current.destinationType,
                    destinationValue: "",
                  }))}
                >
                  <SelectTrigger data-help-id="menu.carousel.destination"><SelectValue placeholder="Escolha o destino" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem ação</SelectItem>
                    <SelectItem value="product">Abrir um produto</SelectItem>
                    <SelectItem value="category">Abrir uma categoria</SelectItem>
                    <SelectItem value="internal">Abrir uma página do site</SelectItem>
                    <SelectItem value="external">Abrir um link externo</SelectItem>
                  </SelectContent>
                </Select>

                {form.destinationType === "product" && (
                  <Select value={form.destinationValue} onValueChange={(value) => setForm((current) => ({ ...current, destinationValue: value }))}>
                    <SelectTrigger><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
                    <SelectContent>
                      {(destinationProducts ?? []).map((product) => (
                        <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {form.destinationType === "category" && (
                  <Select value={form.destinationValue} onValueChange={(value) => setForm((current) => ({ ...current, destinationValue: value }))}>
                    <SelectTrigger><SelectValue placeholder="Escolha a categoria" /></SelectTrigger>
                    <SelectContent>
                      {(destinationCategories ?? []).filter((category) => category.active).map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {form.destinationType === "internal" && (
                  <Select value={form.destinationValue} onValueChange={(value) => setForm((current) => ({ ...current, destinationValue: value }))}>
                    <SelectTrigger><SelectValue placeholder="Escolha a página" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/cardapio">Cardápio</SelectItem>
                      <SelectItem value="/minha-conta">Minha Conta</SelectItem>
                      <SelectItem value="/minha-conta?tab=promocoes">Promoções</SelectItem>
                      <SelectItem value="/minha-conta?tab=cupons">Cupons</SelectItem>
                      <SelectItem value="/minha-conta?tab=clube">Clube Bonatto</SelectItem>
                      <SelectItem value="/minha-conta?tab=sorteios">Sorteios</SelectItem>
                      <SelectItem value="/minha-conta?tab=pedidos">Meus pedidos</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {form.destinationType === "external" && (
                  <Input
                    value={form.destinationValue}
                    onChange={(e) => setForm((current) => ({ ...current, destinationValue: e.target.value }))}
                    placeholder="https://exemplo.com/pagina"
                    inputMode="url"
                  />
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingImage(null); }}>Cancelar</Button>
                <Button
                  data-help-id="menu.carousel.save"
                  type="submit"
                  disabled={
                    !form.imageUrl
                    || (form.destinationType !== "none" && !form.destinationValue)
                    || createImage.isPending
                    || updateImage.isPending
                    || uploading
                  }
                >
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
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{destinationLabel(img)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      data-help-id="menu.carousel.toggle"
                      onClick={() => updateImage.mutate({ id: img.id, storeId: selectedStoreId, active: !img.active })}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                        img.active ? "bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]" : "bg-[#fce8e8] text-[#450709] hover:bg-[#f9d0d0]"
                      }`}
                    >
                      {img.active ? "✓ Ativo" : "✕ Inativo"}
                    </button>
                    <Button data-help-id="menu.carousel.edit" size="sm" variant="ghost" onClick={() => startEdit(img)}>Editar</Button>
                    <Button data-help-id="menu.carousel.remove" size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Remover esta imagem do carrossel?")) deleteImage.mutate({ id: img.id, storeId: selectedStoreId }); }}
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
  const { selectedStoreId } = useAdminStore();
  const { data: coupons, isLoading } = trpc.coupons.list.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    minOrderValue: "",
    maxUses: "",
  });

  const createCoupon = trpc.coupons.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.coupons.list.invalidate(), utils.coupons.listPublic.invalidate()]);
      setShowForm(false);
      setForm({ code: "", discountType: "percentage", discountValue: "", minOrderValue: "", maxUses: "" });
      toast.success("Cupom criado!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCoupon = trpc.coupons.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.coupons.list.invalidate(), utils.coupons.listPublic.invalidate()]);
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
      storeId: selectedStoreId,
    });
  };

  if (selectedStoreId === undefined) {
    return (
      <AdminPage>
        <AdminTopbar title="Cupons" subtitle="Selecione a loja responsável pelos cupons." />
        <AdminSurface><AdminEmptyState icon={<Store className="h-8 w-8" />} title="Selecione uma loja" description="Cada cupom pertence a uma única loja e não será compartilhado com as demais." /></AdminSurface>
      </AdminPage>
    );
  }

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
                        onClick={() => updateCoupon.mutate({ id: coupon.id, active: !coupon.active, storeId: selectedStoreId })}
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
  const { selectedStoreId } = useAdminStore();
  const { data: promotions, isLoading } = trpc.promotions.all.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", imageUrl: "", couponCode: "", endsAt: "" });

  const createPromotion = trpc.promotions.create.useMutation({
    onSuccess: async () => { await Promise.all([utils.promotions.all.invalidate(), utils.promotions.publicActive.invalidate(), utils.promotions.homeActive.invalidate()]); setShowForm(false); setForm({ title: "", description: "", imageUrl: "", couponCode: "", endsAt: "" }); toast.success("Promoção criada!"); },
    onError: (e) => toast.error(e.message),
  });
  const updatePromotion = trpc.promotions.update.useMutation({
    onSuccess: async () => { await Promise.all([utils.promotions.all.invalidate(), utils.promotions.publicActive.invalidate(), utils.promotions.homeActive.invalidate()]); toast.success("Promoção atualizada!"); },
    onError: (e) => toast.error(e.message),
  });
  const deletePromotion = trpc.promotions.delete.useMutation({
    onSuccess: async () => { await Promise.all([utils.promotions.all.invalidate(), utils.promotions.publicActive.invalidate(), utils.promotions.homeActive.invalidate()]); toast.success("Promoção removida!"); },
    onError: (e) => toast.error(e.message),
  });

  if (selectedStoreId === undefined) {
    return <AdminPage><AdminTopbar title="Promoções" subtitle="Selecione uma loja para gerenciar campanhas independentes." /><AdminSurface><AdminEmptyState icon={<Store className="h-8 w-8" />} title="Selecione uma loja" description="As promoções não são compartilhadas entre marcas." /></AdminSurface></AdminPage>;
  }

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
            <form onSubmit={(e) => { e.preventDefault(); createPromotion.mutate({ storeId: selectedStoreId, title: form.title, description: form.description || undefined, imageUrl: form.imageUrl || undefined, couponCode: form.couponCode || undefined, active: true, endsAt: form.endsAt ? new Date(form.endsAt) : undefined }); }} className="space-y-4">
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
                  <Button size="sm" variant="ghost" onClick={() => updatePromotion.mutate({ id: promo.id, storeId: selectedStoreId, data: { active: !promo.active } })}>
                    {promo.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover promoção?")) deletePromotion.mutate({ id: promo.id, storeId: selectedStoreId }); }}>
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
  const { selectedStoreId } = useAdminStore();
  const { data: raffles, isLoading } = trpc.raffles.all.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", prize: "", imageUrl: "", endsAt: "" });
  const [viewEntries, setViewEntries] = useState<number | null>(null);
  const { data: entries } = trpc.raffles.entries.useQuery({ raffleId: viewEntries!, storeId: selectedStoreId }, { enabled: !!viewEntries && selectedStoreId !== undefined });

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

  if (selectedStoreId === undefined) {
    return <AdminPage><AdminTopbar title="Sorteios" subtitle="Selecione uma loja para gerenciar sorteios." /><AdminSurface><AdminEmptyState icon={<Store className="h-8 w-8" />} title="Selecione uma loja" description="Participantes e sorteios ficam isolados por marca." /></AdminSurface></AdminPage>;
  }

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
            <form onSubmit={(e) => { e.preventDefault(); createRaffle.mutate({ storeId: selectedStoreId, title: form.title, description: form.description || undefined, prize: form.prize, imageUrl: form.imageUrl || undefined, endsAt: form.endsAt ? new Date(form.endsAt) : undefined }); }} className="space-y-4">
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
                      <Button size="sm" onClick={() => { if (confirm("Sortear vencedor agora?")) drawWinner.mutate({ raffleId: raffle.id, storeId: selectedStoreId }); }} disabled={drawWinner.isPending}>
                        🎲 Sortear Vencedor
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateRaffle.mutate({ id: raffle.id, storeId: selectedStoreId, data: { status: "closed" } })}>
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
  const { selectedStoreId } = useAdminStore();
  const { data: upsells, isLoading } = trpc.upsells.all.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
  const { data: products } = trpc.products.list.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
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

  if (selectedStoreId === undefined) {
    return <AdminPage><AdminTopbar title="Ofertas adicionais" subtitle="Selecione uma loja para configurar as ofertas do checkout." /><AdminSurface><AdminEmptyState icon={<Store className="h-8 w-8" />} title="Selecione uma loja" description="Produtos sugeridos precisam pertencer à mesma loja do pedido." /></AdminSurface></AdminPage>;
  }

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
                storeId: selectedStoreId,
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
                <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: Adicione uma bebida ao pedido." /></div>
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
                    <Button size="sm" variant="ghost" onClick={() => updateUpsell.mutate({ id: u.id, storeId: selectedStoreId, data: { active: !u.active } })}>
                      {u.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover up-sell?")) deleteUpsell.mutate({ id: u.id, storeId: selectedStoreId }); }}>
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
  const { selectedStoreId } = useAdminStore();
  const { data: history, isLoading } = trpc.automations.getCustomerJourneyHistory.useQuery(
    { userId, storeId: selectedStoreId },
    { enabled: Boolean(selectedStoreId) },
  );
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
  const { selectedStoreId, bonattoConfig } = useAdminStore();
  const { user: authenticatedUser } = useAuth();
  const { data: userPage, isLoading, isError, error, refetch } = trpc.adminUsers.list.useQuery(
    { storeId: selectedStoreId, pageSize: 100 },
    { enabled: selectedStoreId !== undefined },
  );
  const [sendCouponForm, setSendCouponForm] = useState<{ userId: number; userName: string } | null>(null);
  const [couponForm, setCouponForm] = useState({ code: "", discountType: "percentage" as "percentage" | "fixed", discountValue: "", minOrderValue: "" });
  const [journeyHistoryUser, setJourneyHistoryUser] = useState<{ userId: number; userName: string } | null>(null);
  const users = userPage?.items ?? [];

  const sendCoupon = trpc.adminUsers.sendCoupon.useMutation({
    onSuccess: () => { utils.adminUsers.list.invalidate(); setSendCouponForm(null); setCouponForm({ code: "", discountType: "percentage", discountValue: "", minOrderValue: "" }); toast.success("Cupom enviado para o cliente!"); },
    onError: (e) => toast.error(e.message),
  });

  if (selectedStoreId === undefined) {
    return <AdminPage><AdminTopbar title="Clientes" subtitle="Selecione uma loja para consultar sua base de clientes." /><AdminSurface><AdminEmptyState icon={<Users className="h-8 w-8" />} title="Selecione uma loja" description="Cada loja enxerga somente clientes com pedidos naquela unidade." /></AdminSurface></AdminPage>;
  }

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
              sendCoupon.mutate({ storeId: selectedStoreId, userId: sendCouponForm.userId, code: couponForm.code.toUpperCase(), discountType: couponForm.discountType, discountValue: couponForm.discountValue, minOrderValue: couponForm.minOrderValue || undefined });
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

      {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? (
        <AdminSurface>
          <AdminEmptyState
            icon={<Users className="w-8 h-8" />}
            title="Não foi possível carregar os usuários"
            description={error?.message ?? "A consulta de usuários falhou. Tente novamente."}
            action={<Button variant="outline" onClick={() => void refetch()}><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button>}
          />
        </AdminSurface>
      ) : (
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
                          {(authenticatedUser?.role === "admin" || bonattoConfig.features.automations) && <Button size="sm" variant="outline" onClick={() => setJourneyHistoryUser({ userId: u.id, userName: u.name ?? "Cliente" })} className="border-[#e8ebf0] text-[#8a92a0] hover:text-[#1a1d23]">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1"><path d="M12 2v10l4 2"/><circle cx="12" cy="12" r="10"/></svg>
                            Jornadas
                          </Button>}
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
  const { selectedStoreId } = useAdminStore();
  const { data: config, isLoading } = trpc.club.getAdminConfig.useQuery(
    { storeId: selectedStoreId },
    { enabled: Boolean(selectedStoreId) },
  );
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
      storeId: selectedStoreId,
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
  const { selectedStoreId } = useAdminStore();
  const { data: settings, isLoading } = trpc.storeSettings.getAdmin.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );

  const [hours, setHours] = useState<Record<string, DaySchedule>>(DEFAULT_HOURS);
  const [manualStoreOpen, setManualStoreOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [minOrder, setMinOrder] = useState("");

  // Initialize form from DB when data arrives (useEffect to avoid setState during render)
  useEffect(() => {
    if (!settings) return;
    const h = settings.storeHours ? JSON.parse(settings.storeHours) as Record<string, DaySchedule> : DEFAULT_HOURS;
    setHours(h);
    setManualStoreOpen(settings.manualStoreOpen === "true");
    setWhatsapp(settings.whatsappNumber ?? "");
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
    save.mutate({
      storeId: selectedStoreId,
      storeHours: hours,
      manualStoreOpen,
      whatsappNumber: whatsapp || undefined,
      minOrderValue: minOrder || undefined,
    });
  }

  if (selectedStoreId === undefined) {
    return (
      <AdminPage>
        <AdminTopbar title="Configurações da loja" subtitle="Selecione uma unidade para editar horários, entrega e contato." />
        <AdminSurface><AdminEmptyState icon={<Store className="h-8 w-8" />} title="Selecione uma loja" description="Estas configurações são independentes por unidade." /></AdminSurface>
      </AdminPage>
    );
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <AdminPage className="w-full max-w-2xl">
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
              <div key={day} className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                <button
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={`w-full text-sm font-medium px-3 py-2 rounded-md border transition-colors sm:w-28 sm:py-1.5 ${
                    isOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-input"
                  }`}
                >
                  {DAY_NAMES_PT[day]}
                </button>
                {isOpen ? (
                  <>
                    <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-1.5 sm:flex sm:w-auto">
                      <Label className="text-xs text-muted-foreground">Abre</Label>
                      <Input
                        type="time"
                        value={schedule.open}
                        onChange={(e) => updateTime(key, "open", e.target.value)}
                        className="h-9 min-w-0 w-full text-sm sm:h-8 sm:w-28"
                      />
                    </div>
                    <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-1.5 sm:flex sm:w-auto">
                      <Label className="text-xs text-muted-foreground">Fecha</Label>
                      <Input
                        type="time"
                        value={schedule.close}
                        onChange={(e) => updateTime(key, "close", e.target.value)}
                        className="h-9 min-w-0 w-full text-sm sm:h-8 sm:w-28"
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
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-semibold">Abrir loja agora</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                MantÃ©m a loja aberta para pedidos mesmo fora do horÃ¡rio configurado. Desative para voltar ao horÃ¡rio automÃ¡tico.
              </p>
            </div>
            <Switch checked={manualStoreOpen} onCheckedChange={setManualStoreOpen} />
          </div>
        </CardContent>
      </Card>

      {/* Entrega por distância */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Entrega por distância
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cobertura, taxa e prazo são configurados por unidade com base na distância da rota. Bairro e prefixo de CEP não definem mais a cobrança.
          </p>
          <Button type="button" variant="outline" onClick={() => { window.location.href = "/admin/configuracoes/entrega"; }}>
            <MapPin className="mr-2 h-4 w-4" />
            Configurar entrega por distância
          </Button>
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
  const { selectedStoreId } = useAdminStore();
  const { data, isLoading } = trpc.paymentSettings.getAdmin.useQuery(
    { storeId: selectedStoreId },
    { enabled: selectedStoreId !== undefined },
  );
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
          onClick={() => save.mutate({ storeId: selectedStoreId, config, pixKey })}
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
    onError: (error) => toast.error("Erro ao cadastrar motoboy", { description: error.message }),
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
                onClick={() => {
                  if (!selectedStoreId) {
                    toast.error("Selecione uma unidade antes de cadastrar o motoboy.");
                    return;
                  }
                  createMutation.mutate({
                    name: newName.trim(),
                    phone: newPhone.trim() || undefined,
                    storeId: selectedStoreId,
                  });
                }}
                disabled={!newName.trim() || !selectedStoreId || createMutation.isPending}
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
      <LeafletActiveDriversMap />
    </AdminPage>
  );
}

// ─── ACTIVE DRIVERS MAP ───────────────────────────────────────────────────────

function LeafletActiveDriversMap() {
  const { selectedStoreId } = useAdminStore();
  const { data: locations } = trpc.drivers.allLocations.useQuery(
    { storeId: selectedStoreId },
    { refetchInterval: 5000, enabled: selectedStoreId !== undefined },
  );
  const markers = (locations ?? []).map((location) => ({
    id: location.driverId,
    position: { lat: Number(location.lat), lng: Number(location.lng) },
    title: location.driverName,
    label: location.driverName,
    variant: "driver" as const,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#7d0f14]" />
            Motoboys em rota
          </CardTitle>
          <span className="text-xs text-muted-foreground">Atualiza a cada 5s</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-xl relative">
        <MapView
          className="w-full h-[350px]"
          initialCenter={{ lat: -19.9833, lng: -44.0667 }}
          initialZoom={13}
          markers={markers}
          fitToMarkers
        />
        {markers.length === 0 && (
          <div className="absolute inset-0 z-[450] flex items-center justify-center bg-muted/60">
            <p className="text-muted-foreground text-sm">Nenhum motoboy com localizacao ativa.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveDriversMap() {
  const markersRef = useRef<Record<number, any>>({});
  const mapRef = useRef<any>(null);
  const { selectedStoreId } = useAdminStore();
  const { data: locations } = trpc.drivers.allLocations.useQuery({ storeId: selectedStoreId }, {
    refetchInterval: 5000,
    enabled: selectedStoreId !== undefined,
  });

  const handleMapReady = useCallback((map: any) => {
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
      const pos = new (window as any).google.maps.LatLng(parseFloat(loc.lat), parseFloat(loc.lng));
      if (markersRef.current[loc.driverId]) {
        markersRef.current[loc.driverId].setPosition(pos);
      } else {
        markersRef.current[loc.driverId] = new (window as any).google.maps.Marker({
          position: pos,
          map: mapRef.current!,
          title: loc.driverName,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#ef4444" stroke="white" stroke-width="2"/><text x="18" y="24" text-anchor="middle" font-size="16" fill="white">🏍️</text></svg>`
            ),
            scaledSize: new (window as any).google.maps.Size(36, 36),
            anchor: new (window as any).google.maps.Point(18, 18),
          },
          label: { text: loc.driverName, color: "#1e293b", fontSize: "11px", fontWeight: "bold" },
        });
      }
    });

    if (locations.length > 0 && mapRef.current) {
      const bounds = new (window as any).google.maps.LatLngBounds();
      locations.forEach((loc) => bounds.extend(new (window as any).google.maps.LatLng(parseFloat(loc.lat), parseFloat(loc.lng))));
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
function DisabledRestaurantChatTab() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const conversations: Array<any> = [];
  const isLoading = false;
  const refetch = () => undefined;
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  function handleSelectOrder(orderId: number) {
    setSelectedOrderId(orderId);
    // Invalida o totalUnread para atualizar o badge da sidebar
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
            <Bot className="w-10 h-10 opacity-30" />
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
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Chat com restaurante desativado.
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Bot className="w-16 h-16 opacity-20" />
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


