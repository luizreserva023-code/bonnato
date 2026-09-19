import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense, useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { CartDrawer } from "./components/CartDrawer";
import { Navbar } from "./components/Navbar";
import { StoreRibbon } from "./components/StoreRibbon";
import { BonattoBrandFrame } from "./components/consumer/BonattoBrandFrame";
import { useStore } from "./contexts/StoreContext";
import type { WhiteLabelPageKey } from "@shared/whiteLabel";
import { AdminStoreProvider, useAdminStore } from "./contexts/AdminStoreContext";
import { useAuth } from "./_core/hooks/useAuth";

const Checkout = lazy(() => import("./pages/Checkout"));
const Home = lazy(() => import("./pages/Home"));
const Cardapio = lazy(() => import("./pages/Cardapio"));
const MeusPedidos = lazy(() => import("./pages/MeusPedidos"));
const MinhaConta = lazy(() => import("./pages/MinhaConta"));
const Admin = lazy(() => import("./pages/Admin"));
const Automacoes = lazy(() => import("./pages/Automacoes"));
const CRM = lazy(() => import("./pages/CRM"));
const NotificationTemplates = lazy(() => import("./pages/NotificationTemplates"));
const DeliveryZones = lazy(() => import("./pages/DeliveryZones"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DriverApp = lazy(() => import("./pages/DriverApp"));
const WaiterApp = lazy(() => import("./pages/WaiterApp"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const DriverProfile = lazy(() => import("./pages/DriverProfile"));
const Clube = lazy(() => import("./pages/Clube"));
const PagamentoSucesso = lazy(() => import("./pages/PagamentoSucesso"));
const PagamentoCancelado = lazy(() => import("./pages/PagamentoCancelado"));
const VendasDashboard = lazy(() => import("./pages/VendasDashboard"));
const AppDashboard = lazy(() => import("./pages/AppDashboard"));
const SiteStudio = lazy(() => import("./pages/SiteStudio"));
const PlatformCenter = lazy(() => import("./pages/PlatformCenter"));
const LegalPage = lazy(() => import("./pages/Legal"));
const InAppNotificationBridge = lazy(() =>
  import("./components/InAppNotificationBridge").then((module) => ({ default: module.InAppNotificationBridge })),
);
const PushAudioBridge = lazy(() =>
  import("./components/PushAudioBridge").then((module) => ({ default: module.PushAudioBridge })),
);

function DeferredEnhancements() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const showEnhancements = () => setReady(true);
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(showEnhancements, { timeout: 2_000 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(showEnhancements, 800);
    return () => window.clearTimeout(handle);
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <PushAudioBridge />
      <InAppNotificationBridge />
    </Suspense>
  );
}

function RouteFallback() {
  return (
    <div className="min-h-[45vh] grid place-items-center bg-[#fffaf8] text-[#6e0d12]">
      <div className="flex items-center gap-3 text-sm font-semibold" role="status" aria-live="polite">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#6e0d12]/20 border-t-[#6e0d12]" />
        Carregando...
      </div>
    </div>
  );
}

function PlatformAdminRoute() {
  const { user, loading } = useAuth();

  if (loading) return <RouteFallback />;
  if (user?.role !== "admin") return <NotFound />;

  return <AdminStoreProvider><PlatformCenter /></AdminStoreProvider>;
}

function ConsumerPageFallback({ menu = false }: { menu?: boolean }) {
  return (
    <div className={`animate-pulse bg-[#f5eee6] px-4 ${menu ? "min-h-[70vh] pb-24 pt-6" : "min-h-screen pb-16 pt-32"}`} role="status" aria-label="Carregando conteúdo">
      <div className="mx-auto max-w-6xl">
        <div className={`${menu ? "h-8 w-48" : "mx-auto h-16 w-[min(82vw,680px)]"} rounded-2xl bg-[#6e0d12]/10`} />
        <div className={`${menu ? "mt-5" : "mt-8"} h-64 rounded-[28px] bg-[#6e0d12]/10 sm:h-80`} />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-white/75" />)}
        </div>
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="consumer-shell min-h-screen flex flex-col">
      <BonattoBrandFrame />
      <Navbar />
      <div className="fixed top-[88px] left-0 right-0 z-40">
        <StoreRibbon />
      </div>
      <main className="flex-1 pt-28">{children}</main>
      <CartDrawer />
    </div>
  );
}

function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="fixed top-[88px] left-0 right-0 z-40">
        <StoreRibbon />
      </div>
      <main className="flex-1">{children}</main>
      <CartDrawer />
    </div>
  );
}

function CardapioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="consumer-shell min-h-screen flex flex-col">
      <BonattoBrandFrame compact />
      <main className="flex-1">{children}</main>
      <CartDrawer />
    </div>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="consumer-shell consumer-shell--auth min-h-screen"><BonattoBrandFrame />{children}</main>;
}

function TenantPage({ page, children }: { page: WhiteLabelPageKey; children: React.ReactNode }) {
  const { tenantConfig } = useStore();
  const pageConfig = tenantConfig.pages[page];
  if (tenantConfig.status === "inactive" || !pageConfig.enabled) {
    return (
      <div className="grid min-h-[65vh] place-items-center bg-[var(--tenant-background,#fffaf8)] px-6 text-center text-[var(--tenant-text,#211719)]">
        <div className="max-w-md">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--tenant-primary,#6E0D12)]">{tenantConfig.brand.shortName}</p>
          <h1 className="mt-3 text-3xl font-black">Página indisponível</h1>
          <p className="mt-3 text-sm opacity-70">Este recurso não faz parte da experiência configurada para este estabelecimento.</p>
          <a href="/" className="mt-6 inline-flex rounded-xl bg-[var(--tenant-primary,#6E0D12)] px-5 py-3 text-sm font-bold text-white">Voltar ao início</a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function HomeRoute() {
  return <TenantPage page="home"><HomeLayout><Suspense fallback={<ConsumerPageFallback />}><Home /></Suspense></HomeLayout></TenantPage>;
}

function MenuRoute() {
  return <TenantPage page="menu"><CardapioLayout><Suspense fallback={<ConsumerPageFallback menu />}><Cardapio /></Suspense></CardapioLayout></TenantPage>;
}

function TenantFeaturePage({ feature, children }: { feature: "crm" | "automations" | "notifications" | "deliveryZones" | "salesDashboard"; children: React.ReactNode }) {
  const { tenantConfig, isLoading } = useStore();
  if (isLoading) return <RouteFallback />;
  return tenantConfig.features[feature] ? <>{children}</> : <TenantPage page="home"><NotFound /></TenantPage>;
}

function AdminFeaturePage({ feature, children }: { feature: "crm" | "automations" | "notifications" | "deliveryZones" | "salesDashboard"; children: React.ReactNode }) {
  const { tenantConfig, selectedStoreId, isLoading } = useAdminStore();
  if (isLoading) return <RouteFallback />;
  if (selectedStoreId && tenantConfig.features[feature]) return <>{children}</>;
  return <TenantPage page="home"><NotFound /></TenantPage>;
}

function AdminScopedRoute({ feature, children }: { feature: "crm" | "automations" | "notifications" | "deliveryZones" | "salesDashboard"; children: React.ReactNode }) {
  return <AdminStoreProvider><AdminFeaturePage feature={feature}>{children}</AdminFeaturePage></AdminStoreProvider>;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/cardapio" component={MenuRoute} />
        <Route path="/checkout" component={() => <TenantPage page="checkout"><PublicLayout><Checkout /></PublicLayout></TenantPage>} />
        <Route path="/meus-pedidos" component={() => <TenantPage page="orders"><PublicLayout><MeusPedidos /></PublicLayout></TenantPage>} />
        <Route path="/minha-conta" component={() => <TenantPage page="profile"><PublicLayout><MinhaConta /></PublicLayout></TenantPage>} />
        <Route path="/login" component={() => <AuthLayout><Login /></AuthLayout>} />
        <Route path="/reset-password" component={() => <AuthLayout><ResetPassword /></AuthLayout>} />
        <Route path="/termos-de-uso" component={() => <PublicLayout><LegalPage kind="terms" /></PublicLayout>} />
        <Route path="/politica-de-privacidade" component={() => <PublicLayout><LegalPage kind="privacy" /></PublicLayout>} />
        <Route path="/admin" component={Admin} />
        <Route path="/automacoes" component={() => <AdminScopedRoute feature="automations"><Automacoes /></AdminScopedRoute>} />
        <Route path="/crm" component={() => <AdminScopedRoute feature="crm"><CRM /></AdminScopedRoute>} />
        <Route path="/notificacoes" component={() => <AdminScopedRoute feature="notifications"><NotificationTemplates /></AdminScopedRoute>} />
        <Route path="/zonas-entrega" component={() => <AdminScopedRoute feature="deliveryZones"><DeliveryZones /></AdminScopedRoute>} />
        <Route path="/motoboy" component={() => <TenantPage page="driver"><DriverApp /></TenantPage>} />
        <Route path="/garcom" component={() => <TenantPage page="waiter"><WaiterApp /></TenantPage>} />
        <Route path="/rastrear/:orderId" component={() => <TenantPage page="tracking"><PublicLayout><TrackOrder /></PublicLayout></TenantPage>} />
        <Route path="/motoboy/perfil/:driverId" component={DriverProfile} />
        <Route path="/clube" component={() => <TenantPage page="club"><PublicLayout><Clube /></PublicLayout></TenantPage>} />
        <Route path="/pagamento/sucesso" component={() => <PublicLayout><PagamentoSucesso /></PublicLayout>} />
        <Route path="/pagamento/cancelado" component={() => <PublicLayout><PagamentoCancelado /></PublicLayout>} />
        <Route path="/vendas" component={() => <AdminScopedRoute feature="salesDashboard"><VendasDashboard /></AdminScopedRoute>} />
        <Route path="/plataforma" component={() => {
          window.location.replace("/admin?tab=platform");
          return <RouteFallback />;
        }} />
        <Route path="/app" component={AppDashboard} />
        <Route path="/studio" component={SiteStudio} />
        <Route path="/platform-admin" component={PlatformAdminRoute} />
        <Route path="/404" component={() => <PublicLayout><NotFound /></PublicLayout>} />
        <Route component={() => <PublicLayout><NotFound /></PublicLayout>} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CartProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <DeferredEnhancements />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
