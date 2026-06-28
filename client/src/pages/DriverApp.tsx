/**
 * DriverApp  Aplicativo do Motoboy Bonatto Pizza
 *
 * Melhorias implementadas:
 * 1. Identidade visual Bonatto (bord #6E0D12, Poppins, gradiente)
 * 2. UX mobile-first: boto GPS grande, wakeLock, vibrao, rea de toque 56px+
 * 3. Dashboard do dia: entregas, ganhos estimados, avaliao mdia
 * 4. Navegao integrada: botes Maps e Waze com endereo do cliente
 * 5. Notificaes push: subscription automtica ao abrir o app
 * 6. Perfil com avaliaes: link para /motoboy/perfil/:id
 * 7. v42.0: Lista scrollvel de TODOS os pedidos atribudos simultaneamente
 */

import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useDriverPushNotifications } from "@/hooks/useDriverPushNotifications";
import { useDriverPWA } from "@/hooks/useDriverPWA";
import {
  AlertCircle,
  Award,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Share2,
  Star,
  TrendingUp,
  User,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

const LOGO_URL =
  "/brand/bonatto-logo-driver.jpg";

const NOTIFICATION_SOUND_URL = "/manus-storage/notification-motoboy_31cd6501.mp3";

//  Hook: Notificao Sonora de Novo Pedido 

function useNewOrderSound(assignedOrderIds: number[]) {
  const prevIdsRef = useRef<Set<number> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pr-carrega o udio uma vez
  useEffect(() => {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Na primeira carga, apenas registra os IDs sem tocar
    if (prevIdsRef.current === null) {
      prevIdsRef.current = new Set(assignedOrderIds);
      return;
    }

    const prevIds = prevIdsRef.current;
    const hasNewOrder = assignedOrderIds.some((id) => !prevIds.has(id));

    if (hasNewOrder && audioRef.current) {
      // Toca o som (pode ser bloqueado pelo navegador se no houver interao prvia)
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Autoplay bloqueado  silencioso; push notification j cobre esse caso
      });
      // Vibrao no celular
      if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    }

    // Atualiza a referncia com os IDs atuais
    prevIdsRef.current = new Set(assignedOrderIds);
  }, [assignedOrderIds]);
}

//  Helpers 

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(date: Date | string | null | undefined) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    out_for_delivery: "Em entrega",
    delivered: "Entregue",
    confirmed: "Confirmado",
    preparing: "Preparando",
    cancelled: "Cancelado",
  };
  return map[status] ?? status;
}

function statusColor(status: string) {
  if (status === "delivered") return "bg-emerald-100 text-emerald-800";
  if (status === "out_for_delivery") return "bg-blue-100 text-blue-800";
  if (status === "cancelled") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

//  WakeLock Hook 

function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let cancelled = false;
    (navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } })
      .wakeLock.request("screen")
      .then((lock) => {
        if (!cancelled) wakeLockRef.current = lock;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [active]);
}

//  GPS Hook 

interface GpsState {
  active: boolean;
  lat: string | null;
  lng: string | null;
  error: string | null;
}

function useGps(token: string | null, activeOrderId?: number | null) {
  const [gps, setGps] = useState<GpsState>({ active: false, lat: null, lng: null, error: null });
  const watchIdRef = useRef<number | null>(null);
  const updateLocation = trpc.drivers.updateLocation.useMutation();

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setGps((s) => ({ ...s, error: "GPS no disponvel neste dispositivo" }));
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(7);
        const lng = pos.coords.longitude.toFixed(7);
        setGps({ active: true, lat, lng, error: null });
        if (token) {
          updateLocation.mutate({
            token,
            lat,
            lng,
            orderId: activeOrderId ?? undefined,
          });
        }
      },
      (err) => {
        setGps((s) => ({ ...s, active: false, error: err.message }));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    setGps((s) => ({ ...s, active: true, error: null }));
  }, [token, activeOrderId]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGps((s) => ({ ...s, active: false }));
  }, []);

  const toggle = useCallback(() => {
    if (gps.active) stop();
    else start();
  }, [gps.active, start, stop]);

  useEffect(
    () => () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    },
    []
  );

  return { gps, toggle };
}

//  OrderCard Component 

interface OrderCardProps {
  order: {
    id: number;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    deliveryComplement: string | null;
    total: string | number;
    paymentMethod: string | null;
    paymentStatus: string | null;
  };
  items: Array<{
    id: number;
    quantity: number;
    productName: string;
    subtotal: string | number;
  }>;
  onConfirm: (orderId: number) => void;
  isConfirming: boolean;
}

function OrderCard({ order, items, onConfirm, isConfirming }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);

  function openMaps(address: string) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      "_blank"
    );
  }

  function openWaze(address: string) {
    window.open(
      `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`,
      "_blank"
    );
  }

  return (
    <div className="bg-[#1f0508] border border-[#6E0D12]/40 rounded-2xl overflow-hidden">
      {/* Header do card */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full bg-[#6E0D12]/20 px-4 py-3 flex items-center justify-between text-left hover:bg-[#6E0D12]/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#ff6b6b]" />
          <span className="font-bold text-sm">Pedido #{order.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-900/50 text-blue-300 border-0 text-xs">
            Em entrega
          </Badge>
          <ChevronRight
            className={`w-4 h-4 text-white/40 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {/* Resumo sempre visvel */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#6E0D12]/30 flex items-center justify-center shrink-0">
          <MapPin className="w-4 h-4 text-[#ff6b6b]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm break-words">
            {order.deliveryAddress ?? "Endereo no informado"}
          </p>
          {order.deliveryComplement && (
            <p className="text-white/50 text-xs">{order.deliveryComplement}</p>
          )}
          <p className="text-white/40 text-xs mt-0.5">{order.customerName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-emerald-400 font-bold text-sm">
            {formatCurrency(Number(order.total))}
          </p>
        </div>
      </div>

      {/* Detalhes expandveis */}
      {expanded && (
        <div className="px-4 pb-3 space-y-3 border-t border-white/5 pt-3">
          {/* Cliente */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#6E0D12]/30 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-[#ff6b6b]" />
            </div>
            <div>
              <p className="text-white/60 text-xs">Cliente</p>
              <p className="font-semibold text-sm">{order.customerName}</p>
              {order.customerPhone && (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="text-[#ff6b6b] text-xs underline"
                >
                  {order.customerPhone}
                </a>
              )}
            </div>
          </div>

          {/* Itens */}
          {items.length > 0 && (
            <div className="bg-white/5 rounded-xl px-3 py-2 space-y-1">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-white/80">
                    {item.quantity}x {item.productName}
                  </span>
                  <span className="text-white/50">
                    {formatCurrency(Number(item.subtotal))}
                  </span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-1 flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-emerald-400">
                  {formatCurrency(Number(order.total))}
                </span>
              </div>
            </div>
          )}

          {/* Pagamento */}
          <div className="flex items-center gap-2 text-xs text-white/50">
            <DollarSign className="w-3.5 h-3.5" />
            <span>
              {order.paymentMethod === "cash"
                ? "= Dinheiro"
                : order.paymentMethod === "pix"
                ? "= Pix"
                : order.paymentMethod === "credit_card"
                ? "= Carto de crdito"
                : "= Carto de dbito"}
              {"  "}
              {order.paymentStatus === "paid"
                ? " Pago"
                : " Cobrar na entrega"}
            </span>
          </div>

          {/* Botes de navegao */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openMaps(order.deliveryAddress ?? "")}
              className="flex items-center justify-center gap-2 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/40 rounded-xl py-3 text-blue-300 text-sm font-semibold transition-colors active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              Google Maps
            </button>
            <button
              onClick={() => openWaze(order.deliveryAddress ?? "")}
              className="flex items-center justify-center gap-2 bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-700/40 rounded-xl py-3 text-cyan-300 text-sm font-semibold transition-colors active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              Waze
            </button>
          </div>
        </div>
      )}

      {/* Boto Confirmar Entrega */}
      <div className="px-4 pb-4 pt-2">
        <button
          onClick={() => onConfirm(order.id)}
          disabled={isConfirming}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 font-black text-base flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-900/50"
          style={{ minHeight: 64 }}
        >
          {isConfirming ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-6 h-6" />
          )}
          {isConfirming ? "Confirmando..." : "Confirmar Entrega"}
        </button>
      </div>
    </div>
  );
}

//  Main Component 

export default function DriverApp() {
  const [token, setToken] = useState<string>(
    () => localStorage.getItem("driverToken") ?? ""
  );
  const [tokenInput, setTokenInput] = useState("");
  const [activeTab, setActiveTab] = useState<"home" | "history">("home");
  // Rastrear quais pedidos esto sendo confirmados individualmente
  const [confirmingOrders, setConfirmingOrders] = useState<Set<number>>(new Set());

  // Auth query
  const meQuery = trpc.drivers.myActiveOrder.useQuery(
    { token },
    { enabled: !!token, retry: false, refetchInterval: 15_000 }
  );

  const driver = meQuery.data?.driver;

  // Queries
  const todayStats = trpc.drivers.todayStats.useQuery(
    { token },
    { enabled: !!token && !!driver, refetchInterval: 30_000 }
  );

  // Nova query: lista de TODOS os pedidos atribudos
  const assignedOrdersQuery = trpc.drivers.assignedOrders.useQuery(
    { token },
    { enabled: !!token && !!driver, refetchInterval: 10_000 }
  );

  const todayDeliveries = trpc.drivers.todayDeliveries.useQuery(
    { token },
    { enabled: !!token && !!driver && activeTab === "history", refetchInterval: 30_000 }
  );

  // Mutations
  const confirmDelivery = trpc.drivers.confirmDelivery.useMutation();

  // GPS  passa o primeiro pedido da lista como referncia de localizao
  const firstOrderId = assignedOrdersQuery.data?.[0]?.order?.id ?? null;
  const { gps, toggle: toggleGps } = useGps(token || null, firstOrderId);

  // WakeLock: manter tela ativa quando GPS ligado
  useWakeLock(gps.active);

  // PWA  manifest dedicado + banner de instalao
  const { showBanner: showPWABanner, installState, promptInstall, dismissInstall } = useDriverPWA();

  // Push notifications  hook dedicado para motoboy
  const driverPush = useDriverPushNotifications();

  // Notificao sonora: toca quando um novo pedido  atribudo ao motoboy
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assignedOrderIds = useMemo(
    () => (assignedOrdersQuery.data ?? []).map((a) => a.order.id),
    // Usar JSON.stringify como dep garante estabilidade referencial sem loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify((assignedOrdersQuery.data ?? []).map((a) => a.order.id))]
  );
  useNewOrderSound(assignedOrderIds);

  // Subscription automtica ao autenticar (se j tem permisso concedida)
  useEffect(() => {
    if (driver && token && driverPush.isSupported && !driverPush.isSubscribed) {
      if (Notification.permission === "granted") {
        driverPush.subscribe(token);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.id]);

  //  Login 

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    localStorage.setItem("driverToken", t);
    setToken(t);
  }

  function handleLogout() {
    localStorage.removeItem("driverToken");
    setToken("");
    setTokenInput("");
  }

  //  Confirmar entrega individual 

  async function handleConfirmDelivery(orderId: number) {
    setConfirmingOrders((prev) => new Set(prev).add(orderId));
    try {
      await confirmDelivery.mutateAsync({ token, orderId });
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      toast.success("Entrega confirmada! <", {
        description: `Pedido #${orderId} entregue. timo trabalho!`,
      });
      meQuery.refetch();
      todayStats.refetch();
      assignedOrdersQuery.refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro", { description: message });
    } finally {
      setConfirmingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  }

  //  Tela de Login 

  if (!token || (meQuery.isError && !meQuery.isFetching)) {
    return (
      <div className="min-h-screen bg-[#1a0305] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <img
              src={LOGO_URL}
              alt="Bonatto Pizza"
              className="w-20 h-20 rounded-full object-cover border-4 border-[#6E0D12] shadow-lg shadow-[#6E0D12]/40 mb-6"
            />
            <h1 className="text-white text-2xl font-black tracking-tight">App do Motoboy</h1>
            <p className="text-white/50 text-sm mt-1">Bonatto Pizza</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Token de Acesso
              </label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Cole seu token aqui..."
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none focus:border-[#6E0D12] focus:ring-2 focus:ring-[#6E0D12]/30"
                autoComplete="off"
              />
            </div>
            {meQuery.isError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Token invlido. Solicite um novo ao administrador.</span>
              </div>
            )}
            <button
              type="submit"
              disabled={!tokenInput.trim()}
              className="w-full h-14 bg-[#6E0D12] hover:bg-[#8B1018] disabled:opacity-50 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  //  Loading 

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#1a0305] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#6E0D12] animate-spin" />
          <p className="text-white/60 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  const stats = todayStats.data;
  const assignedOrders = assignedOrdersQuery.data ?? [];
  const deliveries = todayDeliveries.data ?? [];

  //  App Principal 

  return (
    <div className="min-h-screen bg-[#0f0204] text-white flex flex-col max-w-md mx-auto">

      {/*  Header com gradiente Bonatto  */}
      <div className="bg-gradient-to-b from-[#6E0D12] to-[#4a0809] px-4 pt-8 pb-6 relative overflow-hidden">
        {/* Grid decorativo */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img
                src={LOGO_URL}
                alt="Bonatto"
                className="w-9 h-9 rounded-full object-cover border-2 border-white/40"
              />
              <div>
                <p className="text-white/60 text-xs">Bem-vindo,</p>
                <p className="font-black text-base leading-tight">{driver?.name ?? "Motoboy"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {driver && (
                <Link href={`/motoboy/perfil/${driver.id}`}>
                  <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                    <User className="w-4 h-4" />
                  </button>
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="text-white/50 text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>

          {/* KPI Cards do dia */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <Package className="w-5 h-5 mx-auto mb-1 text-white/70" />
              <p className="text-xl font-black">{stats?.deliveries ?? 0}</p>
              <p className="text-white/60 text-xs">Entregas</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <DollarSign className="w-5 h-5 mx-auto mb-1 text-emerald-300" />
              <p className="text-xl font-black text-emerald-300">
                {formatCurrency(stats?.earnings ?? 0)}
              </p>
              <p className="text-white/60 text-xs">Ganhos</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <Star className="w-5 h-5 mx-auto mb-1 text-yellow-300" />
              <p className="text-xl font-black text-yellow-300">
                {stats?.avgRating && stats.avgRating > 0 ? stats.avgRating.toFixed(1) : ""}
              </p>
              <p className="text-white/60 text-xs">Avaliao</p>
            </div>
          </div>
        </div>
      </div>

      {/*  Banner PWA  */}
      {showPWABanner && (
        <div className="mx-4 mt-4 rounded-2xl overflow-hidden border border-[#6E0D12]/40 bg-[#1a0305]">
          {installState === "available" ? (
            /* Android/Chrome: prompt nativo */
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl bg-[#6E0D12]/20 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-[#ff6b6b]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">Instalar App do Motoboy</p>
                <p className="text-white/50 text-xs mt-0.5">Acesso rpido na tela inicial</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={promptInstall}
                  className="bg-[#6E0D12] hover:bg-[#8B1018] text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  Instalar
                </button>
                <button
                  onClick={dismissInstall}
                  className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* iOS: instrues manuais */
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#ff6b6b]" />
                  <p className="text-white font-bold text-sm">Adicionar  Tela Inicial</p>
                </div>
                <button
                  onClick={dismissInstall}
                  className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-1.5 text-white/60 text-xs">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#6E0D12]/40 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">1</span>
                  <span>Toque no boto <strong className="text-white/80">Compartilhar</strong> <Share2 className="w-3 h-3 inline" /> na barra do Safari</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#6E0D12]/40 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">2</span>
                  <span>Selecione <strong className="text-white/80">&ldquo;Adicionar  Tela de Inicio&rdquo;</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#6E0D12]/40 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">3</span>
                  <span>Confirme tocando em <strong className="text-white/80">Adicionar</strong></span>
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/*  Tabs  */}
      <div className="flex border-b border-white/10 bg-[#1a0305]">
        {(["home", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-[#6E0D12]"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {tab === "home" ? (
              <span className="flex items-center justify-center gap-1.5">
                Pedidos Ativos
                {assignedOrders.length > 0 && (
                  <span className="bg-[#6E0D12] text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">
                    {assignedOrders.length}
                  </span>
                )}
              </span>
            ) : "Hoje"}
          </button>
        ))}
      </div>

      {/*  Contedo  */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/*  Aba Home  */}
        {activeTab === "home" && (
          <>
            {/* Boto GPS  rea de toque grande (80px) */}
            <button
              onClick={toggleGps}
              className={`w-full rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 ${
                gps.active
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/50"
                  : "bg-[#6E0D12] hover:bg-[#8B1018] shadow-lg shadow-red-900/50"
              }`}
              style={{ minHeight: 80 }}
            >
              {gps.active ? (
                <>
                  <span className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-white" />
                  </span>
                  <Wifi className="w-6 h-6" />
                  GPS Ativo  Toque para parar
                </>
              ) : (
                <>
                  <WifiOff className="w-6 h-6" />
                  Iniciar GPS
                </>
              )}
            </button>

            {gps.error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{gps.error}</span>
              </div>
            )}

            {/* Banner de notificaes push */}
            {driverPush.isSupported && !driverPush.isSubscribed && driverPush.permission !== "denied" && (
              <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3">
                <Bell className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-amber-300 text-sm font-semibold">Ativar notificaes</p>
                  <p className="text-amber-400/70 text-xs">Receba alertas instantneos de novos pedidos</p>
                </div>
                <button
                  onClick={() => driverPush.subscribe(token)}
                  disabled={driverPush.isLoading}
                  className="shrink-0 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  {driverPush.isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Ativar"
                  )}
                </button>
              </div>
            )}

            {/* Banner: permisso negada */}
            {driverPush.isSupported && driverPush.permission === "denied" && (
              <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/30 rounded-xl px-4 py-3">
                <BellOff className="w-5 h-5 text-red-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-red-300 text-sm font-semibold">Notificaes bloqueadas</p>
                  <p className="text-red-400/70 text-xs">Ative nas configuraes do navegador para receber alertas de pedidos</p>
                </div>
              </div>
            )}

            {/* Indicador: notificaes ativas */}
            {driverPush.isSubscribed && (
              <div className="flex items-center gap-2 text-emerald-400/80 text-xs bg-emerald-900/10 rounded-xl px-4 py-2">
                <Bell className="w-3.5 h-3.5" />
                <span>Notificaes de pedidos ativas</span>
                <button
                  onClick={() => driverPush.unsubscribe(token)}
                  className="ml-auto text-white/30 hover:text-white/60 text-xs underline"
                >
                  Desativar
                </button>
              </div>
            )}

            {gps.active && gps.lat && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-900/20 rounded-xl px-4 py-2">
                <Navigation className="w-3.5 h-3.5" />
                <span>
                  Posio: {gps.lat}, {gps.lng}
                </span>
              </div>
            )}

            {/* Lista de Pedidos Ativos */}
            {assignedOrdersQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
              </div>
            ) : assignedOrders.length > 0 ? (
              <div className="space-y-3">
                {/* Cabealho da lista */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">
                    {assignedOrders.length} {assignedOrders.length === 1 ? "pedido em rota" : "pedidos em rota"}
                  </p>
                  <p className="text-white/30 text-xs">Toque para expandir</p>
                </div>

                {/* Cards de pedidos */}
                {assignedOrders.map(({ order, items }) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    items={items}
                    onConfirm={handleConfirmDelivery}
                    isConfirming={confirmingOrders.has(order.id)}
                  />
                ))}
              </div>
            ) : (
              /* Sem pedidos ativos */
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-[#6E0D12]/20 flex items-center justify-center mb-4">
                  <Package className="w-10 h-10 text-[#6E0D12]/60" />
                </div>
                <p className="text-white/60 font-semibold">Nenhum pedido ativo</p>
                <p className="text-white/30 text-sm mt-1">
                  Aguardando atribuio pelo restaurante
                </p>
              </div>
            )}

            {/* Link para perfil */}
            {driver && (
              <Link href={`/motoboy/perfil/${driver.id}`}>
                <div className="flex items-center justify-between bg-[#1f0508] border border-white/10 rounded-2xl px-4 py-4 hover:border-[#6E0D12]/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#6E0D12]/30 flex items-center justify-center">
                      <Award className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Meu Perfil & Avaliaes</p>
                      <p className="text-white/40 text-xs">Ver histrico e notas dos clientes</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30" />
                </div>
              </Link>
            )}
          </>
        )}

        {/*  Aba Histrico do Dia  */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {/* Resumo do dia */}
            <div className="bg-[#1f0508] border border-[#6E0D12]/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#ff6b6b]" />
                <span className="font-bold text-sm">Resumo de Hoje</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-black">{stats?.deliveries ?? 0}</p>
                  <p className="text-white/50 text-xs">Entregas</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-400">
                    {formatCurrency(stats?.earnings ?? 0)}
                  </p>
                  <p className="text-white/50 text-xs">Ganhos</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-yellow-400">
                    {stats?.avgRating && stats.avgRating > 0
                      ? stats.avgRating.toFixed(1)
                      : ""}
                  </p>
                  <p className="text-white/50 text-xs">Nota</p>
                </div>
              </div>
            </div>

            {/* Lista de entregas do dia */}
            {todayDeliveries.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
              </div>
            ) : deliveries.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Clock className="w-12 h-12 text-white/20 mb-3" />
                <p className="text-white/50">Nenhuma entrega hoje ainda</p>
              </div>
            ) : (
              deliveries.map((d) => (
                <div
                  key={d.id}
                  className="bg-[#1f0508] border border-white/10 rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#6E0D12]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-[#ff6b6b]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">Pedido #{d.id}</p>
                      <p className="text-white/50 text-xs truncate">{d.deliveryAddress}</p>
                      <p className="text-white/30 text-xs mt-0.5">{d.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={`text-xs border-0 ${statusColor(d.status)}`}>
                      {statusLabel(d.status)}
                    </Badge>
                    <p className="text-white/40 text-xs mt-1">{formatTime(d.updatedAt)}</p>
                    <p className="text-emerald-400 text-xs font-semibold">
                      {formatCurrency(Number(d.total))}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
