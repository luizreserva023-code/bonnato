/**
 * AppDashboard — Painel de Vendas em modo PWA/Standalone
 * Acessível em /app — sem navbar, sem menu lateral, fullscreen
 * Ideal para adicionar à tela inicial do celular
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  RefreshCw, Calendar, ChevronDown, Clock,
  CreditCard, Banknote, QrCode, BarChart2, LogIn,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────
type Preset = "today" | "7d" | "30d" | "90d" | "custom";
interface DateRange { start: Date; end: Date }

function getPresetRange(preset: Preset): DateRange {
  const now = new Date();
  switch (preset) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":    return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d":   return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "90d":   return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    default:      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
  }
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null;
  return ((current - prev) / prev) * 100;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      positive ? "bg-[#f0fdf4] text-[#166534]" : "bg-[#fce8e8] text-[#450709]"
    }`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function paymentIcon(method: string) {
  if (method === "pix") return <QrCode className="w-3.5 h-3.5 text-[#6E0D12]" />;
  if (method === "cash") return <Banknote className="w-3.5 h-3.5 text-[#5a0a0f]" />;
  return <CreditCard className="w-3.5 h-3.5 text-[#7d0f14]" />;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    pending: "bg-[#fce8e8] text-[#6E0D12]",
    confirmed: "bg-[#fdf5f5] text-[#5a0a0f]",
    preparing: "bg-[#f9d0d0] text-[#450709]",
    out_for_delivery: "bg-[#fce8e8] text-[#7d0f14]",
    delivered: "bg-[#f0fdf4] text-[#166534]",
    cancelled: "bg-muted text-muted-foreground",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pendente", confirmed: "Confirmado", preparing: "Preparando",
    out_for_delivery: "A caminho", delivered: "Entregue", cancelled: "Cancelado",
  };
  return map[status] ?? status;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-[#6E0D12] font-black">{fmt(payload[0]?.value ?? 0)}</p>
      <p className="text-gray-400 text-xs">{payload[1]?.value ?? 0} pedidos</p>
    </div>
  );
}

// ─── Tela de Login Inline ─────────────────────────────────────────────────────
function LoginScreen() {
  const loginUrl = getLoginUrl("/app");
  return (
    <div className="min-h-screen bg-[#6E0D12] flex flex-col items-center justify-center px-6 text-white">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <BarChart2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Bonatto Admin</h1>
        <p className="text-white/60 text-sm mt-1">Painel de Vendas</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/20">
        <p className="text-white/80 text-sm mb-6 leading-relaxed">
          Faça login com sua conta de administrador para acessar o painel de vendas.
        </p>
        <a
          href={loginUrl}
          className="flex items-center justify-center gap-2 w-full bg-white text-[#6E0D12] font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
        >
          <LogIn className="w-4 h-4" />
          Entrar como Admin
        </a>
      </div>

      <p className="text-white/30 text-xs mt-8">Bonatto Pizza · Painel Administrativo</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AppDashboard() {
  const { user, loading: authLoading } = useAuth();

  const [preset, setPreset] = useState<Preset>("7d");
  const [customRange, setCustomRange] = useState<DateRange>(() => getPresetRange("7d"));
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Detectar se está rodando como PWA standalone
  const isStandalone = useMemo(() =>
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true,
  []);

  // Adicionar padding-top para safe area no iOS (notch)
  useEffect(() => {
    document.documentElement.style.setProperty("--safe-top", "env(safe-area-inset-top, 0px)");
  }, []);

  const range = useMemo<DateRange>(() => {
    if (preset === "custom") return customRange;
    return getPresetRange(preset);
  }, [preset, customRange]);

  const overviewQuery = trpc.analytics.salesOverview.useQuery(
    { startDate: range.start, endDate: range.end },
    { refetchInterval: 30_000 }
  );
  const timeSeriesQuery = trpc.analytics.salesTimeSeries.useQuery(
    { startDate: range.start, endDate: range.end },
    { refetchInterval: 60_000 }
  );
  const recentQuery = trpc.analytics.recentOrders.useQuery(
    { limit: 15 },
    { refetchInterval: 30_000 }
  );

  const handleApplyCustom = useCallback(() => {
    if (!customStart || !customEnd) return;
    setCustomRange({
      start: startOfDay(new Date(customStart + "T00:00:00")),
      end: endOfDay(new Date(customEnd + "T23:59:59")),
    });
    setPreset("custom");
    setShowCustom(false);
  }, [customStart, customEnd]);

  // Loading
  if (authLoading) return (
    <div className="min-h-screen bg-[#6E0D12] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );

  // Não autenticado ou não é admin
  if (!user || user.role !== "admin") return <LoginScreen />;

  const ov = overviewQuery.data;
  const series = timeSeriesQuery.data ?? [];
  const recent = recentQuery.data ?? [];
  const revDelta = ov ? pctChange(ov.totalRevenue, ov.prevTotalRevenue) : null;
  const ordDelta = ov ? pctChange(ov.totalOrders, ov.prevTotalOrders) : null;

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "3m" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div
      className="min-h-screen bg-[#f5f5f7] flex flex-col"
      style={{ paddingTop: isStandalone ? "env(safe-area-inset-top, 0px)" : "0" }}
    >
      {/* Header — vermelho escuro, estilo app nativo */}
      <div className="bg-[#6E0D12] text-white sticky top-0 z-20"
        style={{ paddingTop: isStandalone ? "env(safe-area-inset-top, 0px)" : "0" }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black leading-none">Painel de Vendas</h1>
            <p className="text-white/60 text-xs mt-0.5">
              {format(range.start, "dd/MM", { locale: ptBR })} — {format(range.end, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <button
            onClick={() => { overviewQuery.refetch(); timeSeriesQuery.refetch(); recentQuery.refetch(); }}
            className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Seletor de período */}
        <div className="px-4 pb-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                if (p.key === "custom") setShowCustom((v) => !v);
                else { setPreset(p.key); setShowCustom(false); }
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                preset === p.key
                  ? "bg-white text-[#6E0D12]"
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {p.key === "custom" && <Calendar className="w-3 h-3 inline mr-1" />}
              {p.label}
              {p.key === "custom" && <ChevronDown className="w-3 h-3 inline ml-0.5" />}
            </button>
          ))}
        </div>

        {/* Date picker personalizado */}
        {showCustom && (
          <div className="mx-4 mb-3 bg-white/10 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 text-xs bg-white/20 text-white rounded-lg px-2 py-1.5 outline-none border border-white/20 min-w-[120px]"
            />
            <span className="text-white/50 text-xs">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 text-xs bg-white/20 text-white rounded-lg px-2 py-1.5 outline-none border border-white/20 min-w-[120px]"
            />
            <button
              onClick={handleApplyCustom}
              className="bg-white text-[#6E0D12] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>

        {/* KPI Cards — 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Vendas */}
          <div className="bg-white rounded-2xl p-4 shadow-sm col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#6E0D12]/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-[#6E0D12]" />
                </div>
                <span className="text-xs font-medium text-gray-500">Total em vendas</span>
              </div>
              <DeltaBadge value={revDelta} />
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">
              {ov ? fmt(ov.totalRevenue) : "—"}
            </p>
          </div>

          {/* Pedidos */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-[#fce8e8] rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5 text-[#6E0D12]" />
              </div>
              <span className="text-xs font-medium text-gray-500">Pedidos</span>
            </div>
            <div className="flex items-end gap-1.5 mt-2">
              <p className="text-xl font-black text-gray-900">{ov?.totalOrders ?? "—"}</p>
              <DeltaBadge value={ordDelta} />
            </div>
          </div>

          {/* Ticket Médio */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-[#fdf5f5] rounded-xl flex items-center justify-center">
                <BarChart2 className="w-3.5 h-3.5 text-[#9b1520]" />
              </div>
              <span className="text-xs font-medium text-gray-500">Ticket médio</span>
            </div>
            <p className="text-xl font-black text-gray-900 mt-2">
              {ov ? fmt(ov.avgTicket) : "—"}
            </p>
          </div>

          {/* Pedidos Hoje */}
          <div className="bg-white rounded-2xl p-4 shadow-sm col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#fce8e8] rounded-xl flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-[#450709]" />
                </div>
                <span className="text-xs font-medium text-gray-500">Pedidos hoje</span>
              </div>
              <span className="text-2xl font-black text-gray-900">{ov?.todayOrders ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        {series.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-800 mb-1">Receita por dia</p>
            <p className="text-xs text-gray-400 mb-4">Pedidos não cancelados</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="appRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6E0D12" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6E0D12" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#6E0D12" strokeWidth={2}
                  fill="url(#appRevGrad)" dot={false} activeDot={{ r: 4, fill: "#6E0D12" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pedidos recentes */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">Pedidos recentes</p>
            <span className="flex items-center gap-1 text-xs text-[#6E0D12] font-semibold">
              <span className="w-1.5 h-1.5 bg-[#6E0D12] rounded-full animate-pulse" />
              Ao vivo
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Nenhum pedido ainda</p>
            ) : recent.map((order: any) => (
              <div key={order.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-700">#{order.orderNumber}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusColor(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gray-500 truncate">{order.customerName}</span>
                    {paymentIcon(order.paymentMethod)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-gray-900">{fmt(order.total)}</p>
                  <p className="text-[10px] text-gray-400 flex items-center justify-end gap-0.5 mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {format(new Date(order.createdAt), "HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs text-gray-300 pb-2">
          Bonatto Pizza · Painel Admin · Atualiza a cada 30s
        </p>
      </div>
    </div>
  );
}
