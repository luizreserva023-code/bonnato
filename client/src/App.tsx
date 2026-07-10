import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { CartDrawer } from "./components/CartDrawer";
import { Navbar } from "./components/Navbar";
import { InAppNotificationBridge } from "./components/InAppNotificationBridge";
import { PushAudioBridge } from "./components/PushAudioBridge";
import { StoreRibbon } from "./components/StoreRibbon";
import Home from "./pages/Home";
import Cardapio from "./pages/Cardapio";

const Checkout = lazy(() => import("./pages/Checkout"));
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

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
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
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      <CartDrawer />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={() => <HomeLayout><Home /></HomeLayout>} />
        <Route path="/cardapio" component={() => <CardapioLayout><Cardapio /></CardapioLayout>} />
        <Route path="/checkout" component={() => <PublicLayout><Checkout /></PublicLayout>} />
        <Route path="/meus-pedidos" component={() => <PublicLayout><MeusPedidos /></PublicLayout>} />
        <Route path="/minha-conta" component={() => <PublicLayout><MinhaConta /></PublicLayout>} />
        <Route path="/login" component={Login} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/admin" component={Admin} />
        <Route path="/automacoes" component={Automacoes} />
        <Route path="/crm" component={CRM} />
        <Route path="/notificacoes" component={NotificationTemplates} />
        <Route path="/zonas-entrega" component={DeliveryZones} />
        <Route path="/motoboy" component={DriverApp} />
        <Route path="/garcom" component={WaiterApp} />
        <Route path="/rastrear/:orderId" component={TrackOrder} />
        <Route path="/motoboy/perfil/:driverId" component={DriverProfile} />
        <Route path="/clube" component={() => <PublicLayout><Clube /></PublicLayout>} />
        <Route path="/pagamento/sucesso" component={() => <PublicLayout><PagamentoSucesso /></PublicLayout>} />
        <Route path="/pagamento/cancelado" component={() => <PublicLayout><PagamentoCancelado /></PublicLayout>} />
        <Route path="/vendas" component={VendasDashboard} />
        <Route path="/app" component={AppDashboard} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
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
            <PushAudioBridge />
            <InAppNotificationBridge />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
