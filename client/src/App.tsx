import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { CartDrawer } from "./components/CartDrawer";
import { Navbar } from "./components/Navbar";
import { StoreRibbon } from "./components/StoreRibbon";
import Home from "./pages/Home";
import Cardapio from "./pages/Cardapio";
import Checkout from "./pages/Checkout";
import MeusPedidos from "./pages/MeusPedidos";
import MinhaConta from "./pages/MinhaConta";
import Admin from "./pages/Admin";
import Automacoes from "./pages/Automacoes";
import CRM from "./pages/CRM";
import NotificationTemplates from "./pages/NotificationTemplates";
import DeliveryZones from "./pages/DeliveryZones";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import DriverApp from "./pages/DriverApp";
import TrackOrder from "./pages/TrackOrder";
import DriverProfile from "./pages/DriverProfile";
import Clube from "./pages/Clube";
import PagamentoSucesso from "./pages/PagamentoSucesso";
import PagamentoCancelado from "./pages/PagamentoCancelado";
import VendasDashboard from "./pages/VendasDashboard";
import AppDashboard from "./pages/AppDashboard";

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* Ribbon de unidade — aparece abaixo da navbar para visitantes com múltiplas lojas */}
      <div className="fixed top-[88px] left-0 right-0 z-40">
        <StoreRibbon />
      </div>
      {/* Espaço para compensar a navbar fixed (top-5=20px + h-16=64px + margem) + ribbon */}
      <main className="flex-1 pt-28">{children}</main>
      <CartDrawer />
    </div>
  );
}

// Layout da Home — navbar flutua sobre o hero (sem pt-24)
function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* Ribbon de unidade — aparece abaixo da navbar flutuante */}
      <div className="fixed top-[88px] left-0 right-0 z-40">
        <StoreRibbon />
      </div>
      <main className="flex-1">{children}</main>
      <CartDrawer />
    </div>
  );
}

// Layout sem Navbar — usado no Cardápio (tem header próprio estilo iFood)
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
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CartProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
