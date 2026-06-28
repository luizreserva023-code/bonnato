import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Store } from "lucide-react";
import {
  TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  BarChart2, Bell, RefreshCw, Calendar, ChevronDown,
  ArrowUpRight, Clock, CreditCard, Banknote, QrCode, Smartphone, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AdminStoreProvider, useAdminStore } from "@/contexts/AdminStoreContext";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────
type Preset = "today" | "7d" | "30d" | "90d" | "custom";

interface DateRange { start: Date; end: Date }

type SalesTooltipPayloadItem = {
  value?: number;
};

type SalesTooltipProps = {
  active?: boolean;
  payload?: SalesTooltipPayloadItem[];
  label?: string;
};

type RecentOrder = {
  id: number;
  customerName: string;
  status: string;
  paymentMethod: string;
  total: string | number;
  createdAt: string | Date;
};

function getPresetRange(preset: Preset): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":   return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d":     return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "90d":     return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    default:        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null;
  return ((current - prev) / prev) * 100;
}

function clampDelta(value: number | null, limit = 999): number | null {
  if (value === null) return null;
  return Math.max(-limit, Math.min(limit, value));
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: SalesTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-[#6E0D12] font-black">{fmt(payload[0]?.value ?? 0)}</p>
      <p className="text-muted-foreground text-xs">{payload[1]?.value ?? 0} pedidos</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function VendasDashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, isManager, stores } = useAdminStore();

  const [preset, setPreset] = useState<Preset>("7d");
  const [customRange, setCustomRange] = useState<DateRange>(() => getPresetRange("7d"));
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Loja do manager (se aplicável)
  const isAdmin = !authLoading && user?.role === "admin";

  const range = useMemo<DateRange>(() => {
    if (preset === "custom") return customRange;
    return getPresetRange(preset);
  }, [preset, customRange]);

  // Queries
  const overviewQuery = trpc.analytics.salesOverview.useQuery(
    { startDate: range.start, endDate: range.end, storeId: selectedStoreId },
    { refetchInterval: 30_000, refetchOnWindowFocus: false, staleTime: 15_000 }
  );
  const timeSeriesQuery = trpc.analytics.salesTimeSeries.useQuery(
    { startDate: range.start, endDate: range.end, storeId: selectedStoreId },
    { refetchInterval: 60_000, refetchOnWindowFocus: false, staleTime: 30_000 }
  );
  const recentQuery = trpc.analytics.recentOrders.useQuery(
    { limit: 20, storeId: selectedStoreId },
    { refetchInterval: 30_000, refetchOnWindowFocus: false, staleTime: 15_000 }
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

  // Auth guard
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "admin" && user.role !== "manager"))) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#6E0D12] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user || (user.role !== "admin" && user.role !== "manager")) return null;

  const ov = overviewQuery.data;
  const series = timeSeriesQuery.data ?? [];
  const recent = recentQuery.data ?? [];

  const revDelta = ov ? clampDelta(pctChange(ov.totalRevenue, ov.prevTotalRevenue)) : null;
  const ordDelta = ov ? clampDelta(pctChange(ov.totalOrders, ov.prevTotalOrders)) : null;
  const comparisonLabel = "Comparado ao período anterior equivalente";

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "90d", label: "3 meses" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/admin")} className="text-primary/60 hover:text-primary transition-colors">
              <BarChart2 className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-extrabold leading-none" style={{ fontFamily: "'Poppins', sans-serif", color: '#6E0D12' }}>Visão Geral de Vendas</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(range.start, "dd/MM/yyyy", { locale: ptBR })} — {format(range.end, "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{comparisonLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filtro de loja: badge para manager, seletor para admin */}
            {isManager ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#fce8e8] border border-[#6E0D12]/20">
                <Store className="w-3 h-3 text-[#6E0D12]" />
                <span className="text-xs font-semibold text-[#6E0D12]">{selectedStoreName}</span>
              </div>
            ) : isAdmin && stores.length > 0 ? (
              <select
                value={selectedStoreId ?? ""}
                onChange={(e) => setSelectedStoreId(e.target.value ? Number(e.target.value) : undefined)}
                aria-label="Filtrar vendas por loja"
                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#6E0D12]/30 h-8"
              >
                <option value="">Todas as unidades</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : null}
            <button
              onClick={() => { overviewQuery.refetch(); timeSeriesQuery.refetch(); recentQuery.refetch(); }}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Banner de instalação PWA */}
      <div className="bg-[#6E0D12] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold leading-none">Adicione à tela inicial</p>
              <p className="text-white/70 text-xs mt-0.5">Acesse o painel direto pelo celular, como um app</p>
            </div>
          </div>
          <a
            href="/app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 bg-white text-[#6E0D12] text-xs font-bold px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir App
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                if (p.key === "custom") { setShowCustom((v) => !v); }
                else { setPreset(p.key); setShowCustom(false); }
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                preset === p.key
                  ? "bg-[#6E0D12] text-white shadow-sm"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              }`}
            >
              {p.key === "custom" && <Calendar className="w-3.5 h-3.5 inline mr-1.5" />}
              {p.label}
              {p.key === "custom" && <ChevronDown className="w-3.5 h-3.5 inline ml-1" />}
            </button>
          ))}

          {showCustom && (
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2 shadow-sm">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Data inicial do período personalizado"
                className="text-sm border-0 outline-none text-foreground bg-transparent"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="Data final do período personalizado"
                className="text-sm border-0 outline-none text-foreground bg-transparent"
              />
              <button
                onClick={handleApplyCustom}
                className="bg-[#6E0D12] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#5a0a0f] transition-colors"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Vendas */}
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border border-t-2" style={{ borderTopColor: '#6E0D12' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#fce8e8] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#6E0D12]" />
              </div>
              <DeltaBadge value={revDelta} />
            </div>
            <p className="text-2xl font-black text-foreground tabular-nums">
              {ov ? fmt(ov.totalRevenue) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total em vendas</p>
          </div>

          {/* Nº Pedidos */}
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border border-t-2 border-t-[#6E0D12]/40">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#fce8e8] flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-[#6E0D12]" />
              </div>
              <DeltaBadge value={ordDelta} />
            </div>
            <p className="text-2xl font-black text-foreground tabular-nums">
              {ov ? ov.totalOrders : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Pedidos no período</p>
          </div>

          {/* Ticket Médio */}
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border border-t-2" style={{ borderTopColor: '#9b1520' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#fce8e8] flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-[#9b1520]" />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground tabular-nums">
              {ov ? fmt(ov.avgTicket) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Ticket médio</p>
          </div>

          {/* Pedidos hoje */}
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border border-t-2" style={{ borderTopColor: '#450709' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#fce8e8] flex items-center justify-center">
                <Bell className="w-5 h-5 text-[#450709]" />
              </div>
              {recentQuery.isFetching && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <p className="text-2xl font-black text-foreground tabular-nums">
              {ov?.todayOrders ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Pedidos hoje</p>
          </div>
        </div>

        {/* Chart + Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Area Chart */}
          <div className="lg:col-span-2 bg-card rounded-2xl shadow-sm border border-border p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-extrabold text-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>Receita por dia</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Pedidos não cancelados</p>
              </div>
              {timeSeriesQuery.isFetching && (
                <RefreshCw className="w-4 h-4 text-muted-foreground/40 animate-spin" />
              )}
            </div>

            {series.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-muted-foreground/30">
                <BarChart2 className="w-10 h-10 mb-2" />
                <p className="text-sm">Nenhum dado no período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={series} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6E0D12" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6E0D12" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      const d = new Date(v + "T12:00:00");
                      return format(d, "dd/MM", { locale: ptBR });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="totalRevenue"
                    stroke="#6E0D12"
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#6E0D12" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalOrders"
                    stroke="#d1d5db"
                    strokeWidth={1.5}
                    fill="none"
                    dot={false}
                    strokeDasharray="4 3"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent Orders Feed */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>Pedidos recentes</h2>
              <span className="flex items-center gap-1 text-xs text-primary font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Ao vivo
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[340px] pr-1">
              {recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/30">
                  <Bell className="w-8 h-8 mb-2" />
                  <p className="text-sm">Nenhum pedido ainda</p>
                </div>
              ) : (
                recent.map((order: RecentOrder) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => setLocation("/admin")}
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#fce8e8] flex items-center justify-center flex-shrink-0 text-xs font-black text-[#6E0D12]">
                      #{order.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{order.customerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                        {paymentIcon(order.paymentMethod)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-foreground">
                        {fmt(Number(order.total))}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {format(new Date(order.createdAt), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function VendasDashboard() {
  return (
    <AdminStoreProvider>
      <VendasDashboardContent />
    </AdminStoreProvider>
  );
}
