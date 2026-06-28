import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { Loader2, DollarSign, Package, Phone, ShoppingBag, Store, TrendingUp } from "lucide-react";
import { BarChart, Bar, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { AdminChipGroup, AdminEmptyState, AdminPage, AdminStat, AdminStatGrid, AdminSurface, AdminTopbar } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppRouter } from "../../../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ReportTopProduct = RouterOutputs["reports"]["topProducts"][number];
type ReportTopCategory = RouterOutputs["reports"]["topCategories"][number];

export function ReportsTab() {
  const [period, setPeriod] = useState("7");
  const [customStartStr, setCustomStartStr] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  });
  const [customEndStr, setCustomEndStr] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const periodNum = period === "custom" ? 30 : parseInt(period, 10);
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, isManager, stores } = useAdminStore();

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
  }, [period, periodNum, customStartStr, customEndStr]);

  const sendReport = trpc.system.sendDailyReport.useMutation({
    onSuccess: () => toast.success("Relatorio enviado via WhatsApp!"),
    onError: (error) => toast.error(error.message),
  });

  const [timezoneOffset] = useState(() => new Date().getTimezoneOffset());
  const { data: sales, isLoading: loadingSales } = trpc.reports.sales.useQuery({ startDate, endDate, storeId: selectedStoreId });
  const { data: topProducts, isLoading: loadingProducts } = trpc.reports.topProducts.useQuery({ limit: 10, storeId: selectedStoreId });
  const { data: dailyRevenue, isLoading: loadingRevenue } = trpc.reports.dailyRevenue.useQuery({ days: periodNum, storeId: selectedStoreId, timezoneOffset });
  const { data: topCategories, isLoading: loadingCategories } = trpc.reports.topCategories.useQuery({ startDate, endDate, storeId: selectedStoreId });

  const isLoading = loadingSales || loadingProducts || loadingRevenue || loadingCategories;
  const reportTopProducts: ReportTopProduct[] = topProducts ?? [];
  const reportTopCategories: ReportTopCategory[] = topCategories ?? [];
  const chartData = (dailyRevenue ?? []).map((day) => ({
    date: new Date(`${day.date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    receita: parseFloat(String(day.totalRevenue ?? 0)),
    pedidos: Number(day.totalOrders),
  }));

  return (
    <AdminPage>
      <AdminTopbar
        title="Relatorios"
        subtitle="Desempenho de vendas e produtos"
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
              onChange={setPeriod}
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

      {period === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customStartStr}
            onChange={(event) => setCustomStartStr(event.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 outline-none h-9"
            style={{ borderColor: "var(--admin-input-border)", color: "var(--admin-text)", background: "var(--admin-input-bg)" }}
          />
          <span className="text-xs" style={{ color: "var(--admin-text-muted)" }}>ate</span>
          <input
            type="date"
            value={customEndStr}
            onChange={(event) => setCustomEndStr(event.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 outline-none h-9"
            style={{ borderColor: "var(--admin-input-border)", color: "var(--admin-text)", background: "var(--admin-input-bg)" }}
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {isManager ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fce8e8] border border-[#6E0D12]/20">
            <Store className="w-3.5 h-3.5 text-[#6E0D12]" />
            <span className="text-xs font-semibold text-[#6E0D12]">{selectedStoreName}</span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-[#6E0D12]/30 text-[#6E0D12]/70 ml-1">Sua unidade</Badge>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Filtrar por unidade:</span>
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
            {selectedStoreId && (
              <button
                onClick={() => setSelectedStoreId(undefined)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Limpar
              </button>
            )}
          </div>
        )}
        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Carregando...
          </div>
        )}
      </div>

      <AdminStatGrid className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3">
        <AdminStat label="Total de Pedidos" value={String(sales?.totalOrders ?? 0)} icon={<ShoppingBag className="w-4 h-4" />} />
        <AdminStat label="Receita Total" value={`R$ ${parseFloat(String(sales?.totalRevenue ?? 0)).toFixed(2).replace(".", ",")}`} icon={<DollarSign className="w-4 h-4" />} />
        <AdminStat label="Ticket Medio" value={`R$ ${parseFloat(String(sales?.avgOrderValue ?? 0)).toFixed(2).replace(".", ",")}`} icon={<TrendingUp className="w-4 h-4" />} />
      </AdminStatGrid>

      {chartData.length > 0 && (
        <AdminSurface title="Receita por dia">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-chart-grid)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--admin-chart-tick)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--admin-chart-tick)" }} axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value}`} />
              <Tooltip
                cursor={{ fill: "rgba(110,13,18,0.04)" }}
                contentStyle={{ borderRadius: 8, border: "none", boxShadow: "var(--admin-tooltip-shadow)", fontSize: 12, background: "var(--admin-tooltip-bg)", color: "var(--admin-text)" }}
                formatter={(value: number) => [`R$ ${value.toFixed(2).replace(".", ",")}`, "Receita"]}
              />
              <Bar dataKey="receita" fill="#920000" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </AdminSurface>
      )}

      <AdminSurface title="Vendas por categoria" subtitle="Distribuicao de pedidos no periodo selecionado">
        {loadingCategories ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#920000" }} /></div>
        ) : reportTopCategories.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--admin-text-muted)" }}>Nenhum dado disponivel</p>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div style={{ width: "100%", maxWidth: 300, height: 240 }}>
              <PieChart width={300} height={240}>
                <Pie data={reportTopCategories} dataKey="totalQuantity" nameKey="categoryName" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={3}>
                  {reportTopCategories.map((_, index: number) => {
                    const colors = ["#ff0000", "#920000", "#c41a1a", "#e63333", "#b30000", "#ff4444", "#7a0000", "#ff6666"];
                    return <Cell key={index} fill={colors[index % colors.length]} />;
                  })}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} unid.`, name]} contentStyle={{ background: "var(--admin-tooltip-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, fontSize: 12, color: "var(--admin-text)" }} />
                <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11, color: "var(--admin-text-heading)" }}>{value}</span>} />
              </PieChart>
            </div>
            <div className="flex-1 w-full space-y-2">
              {reportTopCategories.map((category: ReportTopCategory, index: number) => {
                const colors = ["#ff0000", "#920000", "#c41a1a", "#e63333", "#b30000", "#ff4444", "#7a0000", "#ff6666"];
                const total = reportTopCategories.reduce((sum, entry) => sum + entry.totalQuantity, 0);
                const percentage = total > 0 ? Math.round((category.totalQuantity / total) * 100) : 0;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[index % colors.length] }} />
                    <div className="flex-1">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs font-medium" style={{ color: "var(--admin-text-heading)" }}>{category.categoryName}</span>
                        <span className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{category.totalQuantity} unid. · {percentage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--admin-progress-bg)" }}>
                        <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: colors[index % colors.length] }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </AdminSurface>

      <AdminSurface title="Produtos mais vendidos">
        {reportTopProducts.length === 0 ? (
          <AdminEmptyState icon={<Package className="w-8 h-8" />} title="Sem dados" description="Nenhum produto vendido no periodo." />
        ) : (
          <div className="space-y-2">
            {reportTopProducts.map((product: ReportTopProduct, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-xl" style={{ background: index % 2 === 0 ? "var(--admin-order-row-bg)" : "transparent" }}>
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={index === 0 ? { background: "linear-gradient(135deg, #ff0000 0%, #920000 100%)", color: "#fff" } : { background: "var(--admin-badge-bg)", color: "var(--admin-badge-text)" }}
                  >
                    {index + 1}
                  </span>
                  <span className="font-medium text-sm" style={{ color: "var(--admin-text-heading)" }}>{product.productName}</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm" style={{ color: "var(--admin-badge-text)" }}>{product.totalQuantity} unid.</p>
                  <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>
                    R$ {parseFloat(String(product.totalRevenue ?? 0)).toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSurface>
    </AdminPage>
  );
}
