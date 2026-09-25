import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense, useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UiPreferencesProvider } from "./contexts/UiPreferencesContext";
import { CartProvider } from "./contexts/CartContext";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { GlobalCommandPalette } from "./components/GlobalCommandPalette";
import { useStore } from "./contexts/StoreContext";
import type { BonattoPageKey } from "@shared/bonattoConfig";
import { AdminStoreProvider, useAdminStore } from "./contexts/AdminStoreContext";
import { AppStatusPage } from "./components/AppStatusPage";

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
const LegalPage = lazy(() => import("./pages/Legal"));
const Navbar = lazy(() => import("./components/Navbar").then((module) => ({ default: module.Navbar })));
const StoreRibbon = lazy(() => import("./components/StoreRibbon").then((module) => ({ default: module.StoreRibbon })));
const CartDrawer = lazy(() => import("./components/CartDrawer").then((module) => ({ default: module.CartDrawer })));
const BonattoBrandFrame = lazy(() =>
  import("./components/consumer/BonattoBrandFrame").then((module) => ({ default: module.BonattoBrandFrame })),
);
const StoreTrackingBridge = lazy(() =>
  import("./components/StoreTrackingBridge").then((module) => ({ default: module.StoreTrackingBridge })),
);
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
      <StoreTrackingBridge />
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
      <Suspense fallback={null}><BonattoBrandFrame /></Suspense>
      <Suspense fallback={<div className="fixed inset-x-0 top-0 z-50 h-20 bg-[#DA1923]" />}><Navbar /></Suspense>
      <div className="fixed top-[88px] left-0 right-0 z-40">
        <Suspense fallback={null}><StoreRibbon /></Suspense>
      </div>
      <main className="flex-1 pt-28">{children}</main>
      <Suspense fallback={null}><CartDrawer /></Suspense>
    </div>
  );
}

function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<div className="fixed inset-x-0 top-0 z-50 h-24 bg-[#DA1923]" />}><Navbar /></Suspense>
      <div className="fixed top-[88px] left-0 right-0 z-40">
        <Suspense fallback={null}><StoreRibbon /></Suspense>
      </div>
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}><CartDrawer /></Suspense>
    </div>
  );
}

function CardapioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="consumer-shell min-h-screen flex flex-col">
      <Suspense fallback={null}><BonattoBrandFrame compact /></Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}><CartDrawer /></Suspense>
    </div>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="consumer-shell consumer-shell--auth min-h-screen"><Suspense fallback={null}><BonattoBrandFrame /></Suspense>{children}</main>;
}

function BonattoPage({ page, children }: { page: BonattoPageKey; children: React.ReactNode }) {
  const { bonattoConfig } = useStore();
  const pageConfig = bonattoConfig.pages[page];
  if (!pageConfig.enabled) {
    return (
      <div className="grid min-h-[65vh] place-items-center bg-[var(--bonatto-background,#fffaf8)] px-6 text-center text-[var(--bonatto-text,#211719)]">
        <div className="max-w-md">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--bonatto-primary,#6E0D12)]">{bonattoConfig.brand.shortName}</p>
          <h1 className="mt-3 text-3xl font-black">Página indisponível</h1>
          <p className="mt-3 text-sm opacity-70">Este recurso não faz parte da experiência configurada para este estabelecimento.</p>
          <a href="/" className="mt-6 inline-flex rounded-xl bg-[var(--bonatto-primary,#6E0D12)] px-5 py-3 text-sm font-bold text-white">Voltar ao início</a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function HomeRoute() {
  return <BonattoPage page="home"><HomeLayout><Suspense fallback={<ConsumerPageFallback />}><Home /></Suspense></HomeLayout></BonattoPage>;
}

function StoreSlugGuard({ children }: { children: React.ReactNode }) {
  const { stores, isLoading, selectedStore } = useStore();
  const slug = window.location.pathname.split("/").filter(Boolean)[0];

  // Returning customers already have the selected store persisted locally.
  // Render immediately and refresh the store list in the background instead of
  // blocking the whole consumer page on a network round trip.
  if (isLoading && selectedStore?.slug === slug) return <>{children}</>;
  if (isLoading) return <RouteFallback />;

  if (!stores.some((store) => store.slug === slug)) {
    return <PublicLayout><NotFound /></PublicLayout>;
  }
  return <>{children}</>;
}

function MenuRoute() {
  return <BonattoPage page="menu"><CardapioLayout><Suspense fallback={<ConsumerPageFallback menu />}><Cardapio /></Suspense></CardapioLayout></BonattoPage>;
}

function BonattoFeaturePage({ feature, children }: { feature: "crm" | "automations" | "notifications" | "deliveryZones" | "salesDashboard"; children: React.ReactNode }) {
  const { bonattoConfig, isLoading } = useStore();
  if (isLoading) return <RouteFallback />;
  return bonattoConfig.features[feature] ? <>{children}</> : <BonattoPage page="home"><NotFound /></BonattoPage>;
}

function AdminFeaturePage({ feature, children }: { feature: "crm" | "automations" | "notifications" | "deliveryZones" | "salesDashboard"; children: React.ReactNode }) {
  const { bonattoConfig, isLoading } = useAdminStore();
  if (isLoading) return <RouteFallback />;
  if (bonattoConfig.features[feature]) return <>{children}</>;
  return <BonattoPage page="home"><NotFound /></BonattoPage>;
}

function AdminScopedRoute({ feature, children }: { feature: "crm" | "automations" | "notifications" | "deliveryZones" | "salesDashboard"; children: React.ReactNode }) {
  return <AdminStoreProvider><AdminFeaturePage feature={feature}>{children}</AdminFeaturePage></AdminStoreProvider>;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/:storeSlug/cardapio" component={() => <StoreSlugGuard><MenuRoute /></StoreSlugGuard>} />
        <Route path="/:storeSlug/checkout" component={() => <StoreSlugGuard><BonattoPage page="checkout"><PublicLayout><Checkout /></PublicLayout></BonattoPage></StoreSlugGuard>} />
        <Route path="/:storeSlug/meus-pedidos" component={() => <StoreSlugGuard><BonattoPage page="orders"><PublicLayout><MeusPedidos /></PublicLayout></BonattoPage></StoreSlugGuard>} />
        <Route path="/:storeSlug/minha-conta" component={() => <StoreSlugGuard><BonattoPage page="profile"><PublicLayout><MinhaConta /></PublicLayout></BonattoPage></StoreSlugGuard>} />
        <Route path="/:storeSlug/termos-de-uso" component={() => <StoreSlugGuard><PublicLayout><LegalPage kind="terms" /></PublicLayout></StoreSlugGuard>} />
        <Route path="/:storeSlug/politica-de-privacidade" component={() => <StoreSlugGuard><PublicLayout><LegalPage kind="privacy" /></PublicLayout></StoreSlugGuard>} />
        <Route path="/:storeSlug/rastrear/:orderId" component={() => <StoreSlugGuard><BonattoPage page="tracking"><PublicLayout><TrackOrder /></PublicLayout></BonattoPage></StoreSlugGuard>} />
        <Route path="/:storeSlug/clube" component={() => <StoreSlugGuard><BonattoPage page="club"><PublicLayout><Clube /></PublicLayout></BonattoPage></StoreSlugGuard>} />
        <Route path="/:storeSlug/pagamento/sucesso" component={() => <StoreSlugGuard><PublicLayout><PagamentoSucesso /></PublicLayout></StoreSlugGuard>} />
        <Route path="/:storeSlug/pagamento/cancelado" component={() => <StoreSlugGuard><PublicLayout><PagamentoCancelado /></PublicLayout></StoreSlugGuard>} />

        <Route path="/" component={HomeRoute} />
        <Route path="/cardapio" component={MenuRoute} />
        <Route path="/checkout" component={() => <BonattoPage page="checkout"><PublicLayout><Checkout /></PublicLayout></BonattoPage>} />
        <Route path="/meus-pedidos" component={() => <BonattoPage page="orders"><PublicLayout><MeusPedidos /></PublicLayout></BonattoPage>} />
        <Route path="/minha-conta" component={() => <BonattoPage page="profile"><PublicLayout><MinhaConta /></PublicLayout></BonattoPage>} />
        <Route path="/login" component={() => <AuthLayout><Login /></AuthLayout>} />
        <Route path="/reset-password" component={() => <AuthLayout><ResetPassword /></AuthLayout>} />
        <Route path="/termos-de-uso" component={() => <PublicLayout><LegalPage kind="terms" /></PublicLayout>} />
        <Route path="/politica-de-privacidade" component={() => <PublicLayout><LegalPage kind="privacy" /></PublicLayout>} />
        <Route path="/admin" component={Admin} />
        <Route path="/automacoes" component={() => <AdminScopedRoute feature="automations"><Automacoes /></AdminScopedRoute>} />
        <Route path="/crm" component={() => <AdminScopedRoute feature="crm"><CRM /></AdminScopedRoute>} />
        <Route path="/notificacoes" component={() => <AdminScopedRoute feature="notifications"><NotificationTemplates /></AdminScopedRoute>} />
        <Route path="/admin/configuracoes/entrega" component={() => <AdminScopedRoute feature="deliveryZones"><DeliveryZones /></AdminScopedRoute>} />
        <Route path="/zonas-entrega" component={() => <AdminScopedRoute feature="deliveryZones"><DeliveryZones /></AdminScopedRoute>} />
        <Route path="/motoboy" component={() => <BonattoPage page="driver"><DriverApp /></BonattoPage>} />
        <Route path="/garcom" component={() => <BonattoPage page="waiter"><WaiterApp /></BonattoPage>} />
        <Route path="/rastrear/:orderId" component={() => <BonattoPage page="tracking"><PublicLayout><TrackOrder /></PublicLayout></BonattoPage>} />
        <Route path="/motoboy/perfil/:driverId" component={DriverProfile} />
        <Route path="/clube" component={() => <BonattoPage page="club"><PublicLayout><Clube /></PublicLayout></BonattoPage>} />
        <Route path="/pagamento/sucesso" component={() => <PublicLayout><PagamentoSucesso /></PublicLayout>} />
        <Route path="/pagamento/cancelado" component={() => <PublicLayout><PagamentoCancelado /></PublicLayout>} />
        <Route path="/vendas" component={() => <AdminScopedRoute feature="salesDashboard"><VendasDashboard /></AdminScopedRoute>} />
        <Route path="/app" component={AppDashboard} />
        <Route path="/studio" component={SiteStudio} />
        <Route path="/403" component={() => <AppStatusPage kind="forbidden" />} />
        <Route path="/500" component={() => <AppStatusPage kind="server" onRetry={() => window.location.reload()} />} />
        <Route path="/maintenance" component={() => <AppStatusPage kind="maintenance" onRetry={() => window.location.reload()} />} />
        <Route path="/404" component={() => <PublicLayout><NotFound /></PublicLayout>} />
        <Route path="/:storeSlug" component={() => <StoreSlugGuard><HomeRoute /></StoreSlugGuard>} />
        <Route component={() => <PublicLayout><NotFound /></PublicLayout>} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={false}>
        <UiPreferencesProvider>
          <CartProvider>
            <TooltipProvider>
              <Toaster richColors position="top-right" />
              <NetworkStatusBanner />
              <GlobalCommandPalette />
              <DeferredEnhancements />
              <Router />
            </TooltipProvider>
          </CartProvider>
        </UiPreferencesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
