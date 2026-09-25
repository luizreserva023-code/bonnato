import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Clock3,
  DollarSign,
  Megaphone,
  ShoppingBag,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { trpc } from "@/lib/trpc";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import {
  AdminCardSkeleton,
  AdminChipGroup,
  AdminDataTableShell,
  AdminEmptyState,
  AdminPage,
  AdminPill,
  AdminStat,
  AdminStatGrid,
  AdminSurface,
  AdminTopbar,
} from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuditLogPanel } from "./AuditLogPanel";
import ReviewsPanel from "./ReviewsPanel";
import { ReliabilityPanel } from "./ReliabilityPanel";

type PerformanceTabId = "sales" | "operations" | "menu" | "customers" | "marketing" | "reviews" | "audit" | "reliability";
type PeriodPreset = "today" | "7d" | "30d" | "90d" | "custom";
type SalesMetric = "revenue" | "orders" | "averageTicket";

const PERIOD_ITEMS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "custom", label: "Personalizado" },
] as const;

const PERFORMANCE_TABS: Array<{ id: PerformanceTabId; label: string }> = [
  { id: "sales", label: "Vendas" },
  { id: "operations", label: "Operação" },
  { id: "menu", label: "Cardápio" },
  { id: "customers", label: "Clientes" },
  { id: "marketing", label: "Marketing" },
  { id: "reviews", label: "Avaliações" },
  { id: "audit", label: "Auditoria" },
  { id: "reliability", label: "Confiabilidade" },
];

const CANCEL_REASON_LABELS: Record<string, string> = {
  customer_request: "Cliente desistiu",
  payment: "Pagamento",
  address: "Endereço / localização",
  out_of_stock: "Falta de produto",
  delay: "Atraso",
  operational: "Problema operacional",
  other: "Outro",
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const number = (value: number, digits = 0) => value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (value: number) => `${number(value, 2)}%`;

function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function trendProps(current: number, previous: number) {
  const value = delta(current, previous);
  if (value == null) return { trend: "neutral" as const, trendLabel: "Sem base anterior" };
  return {
    trend: value > 0 ? "up" as const : value < 0 ? "down" as const : "neutral" as const,
    trendLabel: `${value > 0 ? "+" : ""}${number(value, 1)}%`,
  };
}

function minutes(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${number(value, 1)} min`;
}

export function PerformanceTab() {
  const { selectedStoreId: contextStoreId, selectedStoreName, isManager, isPlatformAdmin, stores } = useAdminStore();
  const [analyticsStoreId, setAnalyticsStoreId] = useState<number | undefined>(() => {
    const raw = new URLSearchParams(window.location.search).get("storeId");
    const parsed = raw ? Number(raw) : undefined;
    return Number.isFinite(parsed) && Number(parsed) > 0 ? Number(parsed) : contextStoreId;
  });
  const [activeTab, setActiveTab] = useState<PerformanceTabId>("sales");
  const [period, setPeriod] = useState<PeriodPreset>(() => {
    const current = new URLSearchParams(window.location.search).get("period");
    return (["today", "7d", "30d", "90d", "custom"].includes(current ?? "") ? current : "7d") as PeriodPreset;
  });
  const [customStart, setCustomStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const [salesMetric, setSalesMetric] = useState<SalesMetric>("revenue");
  const [hourScope, setHourScope] = useState<"weekday" | "weekend">("weekday");
  const [menuRanking, setMenuRanking] = useState<"best" | "worst">("best");
  const [menuSearch, setMenuSearch] = useState("");

  useEffect(() => {
    if (isManager && contextStoreId && analyticsStoreId !== contextStoreId) {
      setAnalyticsStoreId(contextStoreId);
    }
  }, [analyticsStoreId, contextStoreId, isManager]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("period", period);
    if (analyticsStoreId) params.set("storeId", String(analyticsStoreId));
    else params.delete("storeId");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [analyticsStoreId, period]);

  const customRange = period === "custom"
    ? {
        startDate: new Date(`${customStart}T00:00:00-03:00`),
        endDate: new Date(`${customEnd}T23:59:59.999-03:00`),
      }
    : {};

  const performance = trpc.analytics.performance.useQuery(
    { storeId: analyticsStoreId, period, ...customRange },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const menu = trpc.analytics.menu.useQuery(
    { storeId: analyticsStoreId, period, ...customRange, search: menuSearch.trim() || undefined, limit: 300 },
    { enabled: activeTab === "menu", staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const data = performance.data;
  const scopeLabel = analyticsStoreId
    ? (stores.find((store) => store.id === analyticsStoreId)?.name ?? selectedStoreName)
    : "Todas as unidades";

  const series = useMemo(() => {
    if (!data) return [];
    return data.series.map((row, index) => {
      const previous = data.previousSeries[index];
      return {
        ...row,
        label: new Date(`${row.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        previousRevenue: previous?.revenue ?? null,
        previousOrders: previous?.orders ?? null,
        previousAverageTicket: previous?.averageTicket ?? null,
      };
    });
  }, [data]);

  const hourRows = useMemo(() => {
    if (!data) return [];
    return data.distribution.byHour
      .filter((row) => row.weekend === (hourScope === "weekend"))
      .map((row) => ({ ...row, label: `${String(row.hour).padStart(2, "0")}h` }));
  }, [data, hourScope]);

  const bestHour = useMemo(
    () => hourRows.reduce<(typeof hourRows)[number] | null>((best, row) => !best || row.orders > best.orders ? row : best, null),
    [hourRows],
  );
  const bestDay = useMemo(() => {
    const rows = data?.distribution.byWeekday ?? [];
    return rows.reduce<(typeof rows)[number] | null>((best, row) => !best || row.orders > best.orders ? row : best, null);
  }, [data]);

  const menuRows = useMemo(() => {
    const rows = [...(menu.data?.products ?? [])];
    if (menuRanking === "best") {
      return rows.sort((a, b) => b.soldQuantity - a.soldQuantity || b.revenue - a.revenue);
    }
    return rows.sort((a, b) => a.soldQuantity - b.soldQuantity || b.views - a.views);
  }, [menu.data?.products, menuRanking]);

  if (performance.isLoading) {
    return (
      <AdminPage>
        <AdminTopbar title="Desempenho" subtitle="Acompanhe os principais indicadores da operação." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <AdminCardSkeleton key={index} />)}
        </div>
        <AdminCardSkeleton className="h-[360px]" />
      </AdminPage>
    );
  }

  if (performance.isError || !data) {
    return (
      <AdminPage>
        <AdminTopbar title="Desempenho" subtitle="Acompanhe os principais indicadores da operação." onRefresh={() => performance.refetch()} />
        <AdminSurface>
          <AdminEmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="Não foi possível carregar o desempenho"
            description={performance.error?.message ?? "Tente atualizar os dados."}
          />
        </AdminSurface>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminTopbar
        title="Desempenho"
        subtitle={`${scopeLabel} • métricas calculadas no fuso America/Sao_Paulo`}
        onRefresh={() => performance.refetch()}
        actions={
          <AdminChipGroup
            size="sm"
            value={period}
            onChange={(value) => setPeriod(value as PeriodPreset)}
            items={PERIOD_ITEMS.map((item) => ({ ...item }))}
          />
        }
      />

      <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--admin-border)] bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {!isManager && (
            <Select
              value={analyticsStoreId ? String(analyticsStoreId) : "all"}
              onValueChange={(value) => setAnalyticsStoreId(value === "all" ? undefined : Number(value))}
            >
              <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {stores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {isManager && <AdminPill tone="brand">{selectedStoreName}</AdminPill>}
          {period === "custom" && (
            <>
              <Input type="date" className="w-auto" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <span className="text-xs text-[var(--admin-text-muted)]">até</span>
              <Input type="date" className="w-auto" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </>
          )}
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {PERFORMANCE_TABS.filter((tab) => tab.id !== "reliability" || isPlatformAdmin).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="admin-chip shrink-0"
              data-active={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "sales" && (
        <>
          <AdminStatGrid className="xl:grid-cols-4">
            <AdminStat label="Total de pedidos" value={data.sales.totalOrders.toLocaleString("pt-BR")} icon={<ShoppingBag className="h-4 w-4" />} {...trendProps(data.sales.totalOrders, data.previousSales.totalOrders)} sub="vs. período anterior" />
            <AdminStat label="Valor total das vendas" value={money(data.sales.revenue)} icon={<DollarSign className="h-4 w-4" />} {...trendProps(data.sales.revenue, data.previousSales.revenue)} sub="pedidos não cancelados" />
            <AdminStat label="Ticket médio" value={money(data.sales.averageTicket)} icon={<TrendingUp className="h-4 w-4" />} {...trendProps(data.sales.averageTicket, data.previousSales.averageTicket)} sub="receita ÷ pedidos considerados" />
            <AdminStat label="Novos clientes" value={data.sales.newCustomers.toLocaleString("pt-BR")} icon={<Users className="h-4 w-4" />} {...trendProps(data.sales.newCustomers, data.previousSales.newCustomers)} sub="primeiro pedido entregue" />
          </AdminStatGrid>

          <AdminSurface
            title="Evolução de vendas"
            subtitle="Período atual comparado ao período imediatamente anterior de mesma duração."
            actions={
              <AdminChipGroup
                size="sm"
                value={salesMetric}
                onChange={(value) => setSalesMetric(value as SalesMetric)}
                items={[
                  { value: "revenue", label: "Valor" },
                  { value: "orders", label: "Pedidos" },
                  { value: "averageTicket", label: "Ticket" },
                ]}
              />
            }
          >
            {series.length === 0 ? (
              <AdminEmptyState title="Ainda não há vendas neste período" description="O gráfico aparecerá assim que houver pedidos." />
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="performanceArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#631014" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#631014" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEDEF" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#979AA3" }} axisLine={false} tickLine={false} minTickGap={18} />
                    <YAxis tick={{ fontSize: 11, fill: "#979AA3" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #E7E8EC", boxShadow: "0 8px 30px rgba(16,24,40,.08)" }}
                      formatter={(value: number, name: string) => {
                        const monetary = salesMetric !== "orders";
                        return [monetary ? money(Number(value)) : number(Number(value)), name === "Atual" ? "Período atual" : "Período anterior"];
                      }}
                    />
                    <Area type="monotone" dataKey={salesMetric} name="Atual" stroke="#631014" strokeWidth={2.4} fill="url(#performanceArea)" />
                    <Line
                      type="monotone"
                      dataKey={salesMetric === "revenue" ? "previousRevenue" : salesMetric === "orders" ? "previousOrders" : "previousAverageTicket"}
                      name="Anterior"
                      stroke="#979AA3"
                      strokeWidth={1.8}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </AdminSurface>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminSurface
              title="Horários com mais vendas"
              subtitle={bestHour ? `Melhor horário: ${bestHour.label} • ${bestHour.orders} pedido(s)` : "Sem volume suficiente"}
              actions={
                <AdminChipGroup
                  size="sm"
                  value={hourScope}
                  onChange={(value) => setHourScope(value as "weekday" | "weekend")}
                  items={[
                    { value: "weekday", label: "Durante a semana" },
                    { value: "weekend", label: "Final de semana" },
                  ]}
                />
              }
            >
              {hourRows.length === 0 ? (
                <AdminEmptyState icon={<Clock3 className="h-8 w-8" />} title="Sem dados por horário" description="A distribuição aparecerá quando houver pedidos." />
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourRows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEDEF" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#979AA3" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#979AA3" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="orders" fill="#631014" radius={[6, 6, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </AdminSurface>

            <AdminSurface
              title="Dias com mais vendas"
              subtitle={bestDay ? `Melhor dia: ${WEEKDAY_LABELS[bestDay.weekday]} • ${bestDay.orders} pedido(s)` : "Sem volume suficiente"}
            >
              {(data.distribution.byWeekday ?? []).length === 0 ? (
                <AdminEmptyState icon={<CalendarDays className="h-8 w-8" />} title="Sem dados por dia" description="A distribuição aparecerá quando houver pedidos." />
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.distribution.byWeekday.map((row) => ({ ...row, label: WEEKDAY_LABELS[row.weekday] }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEDEF" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#979AA3" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#979AA3" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="orders" fill="#B25E62" radius={[6, 6, 0, 0]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </AdminSurface>
          </div>
        </>
      )}

      {activeTab === "operations" && (
        <>
          <AdminStatGrid className="xl:grid-cols-4">
            <AdminStat label="Taxa de cancelamento" value={percent(data.operations.cancellationRate)} icon={<XCircle className="h-4 w-4" />} trend={data.operations.cancellationRate > data.previousOperations.cancellationRate ? "down" : "up"} trendLabel={`${number(data.previousOperations.cancellationRate, 2)}% anterior`} />
            <AdminStat label="Pedidos concluídos" value={data.operations.completedOrders.toLocaleString("pt-BR")} icon={<ShoppingBag className="h-4 w-4" />} {...trendProps(data.operations.completedOrders, data.previousOperations.completedOrders)} />
            <AdminStat label="Pedidos despachados" value={data.operations.dispatchedOrders.toLocaleString("pt-BR")} icon={<TrendingUp className="h-4 w-4" />} {...trendProps(data.operations.dispatchedOrders, data.previousOperations.dispatchedOrders)} />
            <AdminStat label="Pedidos atrasados" value={data.operations.delayedOrders.toLocaleString("pt-BR")} icon={<Clock3 className="h-4 w-4" />} trend={data.operations.delayedOrders > 0 ? "down" : "neutral"} trendLabel={data.operations.delayedOrders > 0 ? "Atenção" : "Sem atraso identificado"} />
          </AdminStatGrid>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminSurface title="Tempos operacionais" subtitle="Calculados somente quando os timestamps necessários existem.">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Até confirmação", minutes(data.operations.averageConfirmationMinutes)],
                  ["Preparo", minutes(data.operations.averagePreparationMinutes)],
                  ["Aguardando entrega", minutes(data.operations.averageWaitingDeliveryMinutes)],
                  ["Até despacho", minutes(data.operations.averageDispatchMinutes)],
                  ["Tempo total", minutes(data.operations.averageTotalMinutes)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[12px] bg-[var(--admin-surface-alt)] p-4">
                    <p className="text-xs text-[var(--admin-text-secondary)]">{label}</p>
                    <p className="mt-2 text-xl font-semibold tracking-[-.02em] text-[var(--admin-text-primary)]">{value}</p>
                  </div>
                ))}
              </div>
            </AdminSurface>

            <AdminSurface title="Motivos de cancelamento" subtitle="Pedidos históricos sem motivo estruturado aparecem separadamente.">
              {data.operations.cancellationReasons.length === 0 ? (
                <AdminEmptyState title="Sem cancelamentos no período" description="Nenhum motivo para analisar." />
              ) : (
                <div className="space-y-3">
                  {data.operations.cancellationReasons.map((row) => {
                    const total = Math.max(data.operations.cancelledOrders, 1);
                    const share = (row.count / total) * 100;
                    return (
                      <div key={row.code ?? "unknown"}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-[var(--admin-text-secondary)]">{row.code ? CANCEL_REASON_LABELS[row.code] ?? row.code : "Sem motivo registrado"}</span>
                          <span className="font-semibold text-[var(--admin-text-primary)]">{row.count}</span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-[#F0F1F3]">
                          <div className="h-full rounded-full bg-[var(--admin-brand-700)]" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminSurface>
          </div>

          <AdminSurface title="Disponibilidade da loja">
            <AdminEmptyState
              title="Histórico de disponibilidade ainda não é coletado"
              description="O sistema não vai estimar esse número a partir de pedidos. Para medir disponibilidade com confiança, precisamos registrar intervalos reais de loja aberta/fechada a partir desta versão."
            />
          </AdminSurface>
        </>
      )}

      {activeTab === "customers" && (
        <AdminStatGrid className="xl:grid-cols-3">
          <AdminStat label="Clientes únicos" value={data.customers.uniqueCustomers.toLocaleString("pt-BR")} icon={<Users className="h-4 w-4" />} {...trendProps(data.customers.uniqueCustomers, data.previousCustomers.uniqueCustomers)} sub="com pedido entregue" />
          <AdminStat label="Novos clientes" value={data.customers.newCustomers.toLocaleString("pt-BR")} icon={<Users className="h-4 w-4" />} {...trendProps(data.customers.newCustomers, data.previousCustomers.newCustomers)} sub="primeiro pedido entregue no período" />
          <AdminStat label="Clientes recorrentes" value={data.customers.recurringCustomers.toLocaleString("pt-BR")} icon={<Users className="h-4 w-4" />} {...trendProps(data.customers.recurringCustomers, data.previousCustomers.recurringCustomers)} sub="já tinham pedido entregue antes" />
          <AdminStat label="Taxa de recompra" value={percent(data.customers.repurchaseRate)} icon={<TrendingUp className="h-4 w-4" />} {...trendProps(data.customers.repurchaseRate, data.previousCustomers.repurchaseRate)} />
          <AdminStat label="Pedidos por cliente" value={number(data.customers.ordersPerCustomer, 2)} icon={<ShoppingBag className="h-4 w-4" />} {...trendProps(data.customers.ordersPerCustomer, data.previousCustomers.ordersPerCustomer)} />
          <AdminStat label="Receita média por cliente" value={money(data.customers.averageRevenuePerCustomer)} icon={<DollarSign className="h-4 w-4" />} {...trendProps(data.customers.averageRevenuePerCustomer, data.previousCustomers.averageRevenuePerCustomer)} />
        </AdminStatGrid>
      )}

      {activeTab === "marketing" && (
        <AdminSurface
          title="Origem das vendas"
          subtitle="Sessões vêm das UTMs/eventos coletados; pedidos e receita vêm da atribuição gravada no pedido."
          actions={<Megaphone className="h-4 w-4 text-[var(--admin-brand-800)]" />}
        >
          {data.marketing.length === 0 ? (
            <AdminEmptyState
              title="Ainda não há origem suficiente para analisar"
              description="As UTMs e sessões começarão a aparecer conforme o novo tracking receber tráfego."
            />
          ) : (
            <AdminDataTableShell>
              <table className="admin-data-table min-w-[720px]">
                <thead><tr><th>Origem</th><th>Sessões</th><th>Pedidos</th><th>Conversão</th><th>Receita</th></tr></thead>
                <tbody>
                  {data.marketing.map((row) => (
                    <tr key={row.source}>
                      <td className="font-semibold capitalize">{row.source}</td>
                      <td>{row.sessions.toLocaleString("pt-BR")}</td>
                      <td>{row.orders.toLocaleString("pt-BR")}</td>
                      <td>{percent(row.conversionRate)}</td>
                      <td className="font-semibold">{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminDataTableShell>
          )}
          {data.scope.dataAvailableFrom && (
            <p className="mt-4 text-xs text-[var(--admin-text-muted)]">
              Dados de navegação/conversão disponíveis a partir de {new Date(data.scope.dataAvailableFrom).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
            </p>
          )}
        </AdminSurface>
      )}

      {activeTab === "reviews" && <ReviewsPanel storeId={analyticsStoreId} />}
      {activeTab === "audit" && <AuditLogPanel storeId={analyticsStoreId} />}
      {activeTab === "reliability" && isPlatformAdmin && <ReliabilityPanel />}

      {activeTab === "menu" && (
        <>
          <AdminSurface title="Conversão do cardápio" subtitle="Sessões únicas por etapa do funil.">
            {!data.scope.dataAvailableFrom ? (
              <AdminEmptyState title="Tracking ainda sem dados" description="As métricas de navegação começam quando eventos reais são registrados." />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ["Visitou o cardápio", data.funnel.find((row) => row.eventType === "MENU_VIEW")?.value ?? 0],
                    ["Visualizou produto", data.funnel.find((row) => row.eventType === "PRODUCT_VIEW")?.value ?? 0],
                    ["Adicionou à sacola", data.funnel.find((row) => row.eventType === "ADD_TO_CART")?.value ?? 0],
                    ["Iniciou checkout", data.funnel.find((row) => row.eventType === "CHECKOUT_STARTED")?.value ?? 0],
                    ["Concluiu pedido", data.funnel.find((row) => row.eventType === "ORDER_CREATED")?.value ?? 0],
                  ].map(([label, value], index, rows) => {
                    const base = Number(rows[0][1]) || 0;
                    const pct = base > 0 ? (Number(value) / base) * 100 : 0;
                    return (
                      <div key={String(label)} className="rounded-[14px] border border-[var(--admin-border)] bg-white p-4">
                        <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">{label}</p>
                        <p className="mt-2 text-2xl font-semibold text-[var(--admin-text-primary)]">{Number(value).toLocaleString("pt-BR")}</p>
                        <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{index === 0 ? "100%" : percent(pct)}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-[var(--admin-text-muted)]">
                  Dados de conversão disponíveis a partir de {new Date(data.scope.dataAvailableFrom).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
                </p>
              </>
            )}
          </AdminSurface>

          <AdminSurface
            title="Itens do cardápio"
            subtitle="Compare exposição, vendas e conversão para diferenciar baixo tráfego de baixa conversão."
            actions={
              <div className="flex flex-wrap gap-2">
                <AdminChipGroup
                  size="sm"
                  value={menuRanking}
                  onChange={(value) => setMenuRanking(value as "best" | "worst")}
                  items={[
                    { value: "best", label: "Mais vendidos" },
                    { value: "worst", label: "Menos vendidos" },
                  ]}
                />
                <Input value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Buscar item..." className="w-[190px]" />
              </div>
            }
          >
            {menu.isLoading ? (
              <div className="py-10 text-center text-sm text-[var(--admin-text-secondary)]">Carregando itens...</div>
            ) : menuRows.length === 0 ? (
              <AdminEmptyState title="Nenhum item encontrado" description="Ajuste a busca ou aguarde dados reais do período." />
            ) : (
              <AdminDataTableShell>
                <table className="admin-data-table min-w-[780px]">
                  <thead><tr><th>#</th><th>Produto</th><th>Visitas</th><th>Carrinhos</th><th>Vendas</th><th>Conversão</th><th>Receita</th></tr></thead>
                  <tbody>
                    {menuRows.slice(0, 100).map((product, index) => (
                      <tr key={product.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-9 w-9 rounded-[8px] object-cover" /> : <div className="h-9 w-9 rounded-[8px] bg-[var(--admin-surface-alt)]" />}
                            <div><p className="font-semibold">{product.name}</p><p className="text-[11px] text-[var(--admin-text-muted)]">{product.categoryName}</p></div>
                          </div>
                        </td>
                        <td>{product.views.toLocaleString("pt-BR")}</td>
                        <td>{product.cartSessions.toLocaleString("pt-BR")}</td>
                        <td>{product.soldQuantity.toLocaleString("pt-BR")}</td>
                        <td>{product.views > 0 ? percent(product.conversionRate) : "Sem visitas"}</td>
                        <td className="font-semibold">{money(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminDataTableShell>
            )}
          </AdminSurface>
        </>
      )}
    </AdminPage>
  );
}

export default PerformanceTab;
