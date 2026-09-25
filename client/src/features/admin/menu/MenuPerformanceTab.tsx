import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Eye,
  Lightbulb,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { AppRouter } from "../../../../../server/routers";
import { trpc } from "@/lib/trpc";
import {
  AdminChipGroup,
  AdminDataTableShell,
  AdminEmptyState,
  AdminInsightCard,
  AdminPill,
  AdminSurface,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ProductPerformance = RouterOutputs["analytics"]["menu"]["products"][number];
type Recommendation = RouterOutputs["analytics"]["recommendations"]["recommendations"][number];
type Period = "today" | "7d" | "30d" | "90d";

const FUNNEL_LABELS: Record<string, string> = {
  MENU_VIEW: "Visitaram o cardápio",
  PRODUCT_VIEW: "Visualizaram produto",
  ADD_TO_CART: "Adicionaram à sacola",
  CHECKOUT_STARTED: "Iniciaram checkout",
  ORDER_CREATED: "Criaram pedido",
};

const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatPct = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function delta(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function Evidence({ item }: { item: Recommendation }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--admin-text-secondary)]">
      <span className="rounded-full bg-[var(--admin-surface-alt)] px-2 py-1">{item.evidence.views.toLocaleString("pt-BR")} visualizações</span>
      <span className="rounded-full bg-[var(--admin-surface-alt)] px-2 py-1">{item.evidence.soldQuantity.toLocaleString("pt-BR")} vendas</span>
      <span className="rounded-full bg-[var(--admin-surface-alt)] px-2 py-1">{formatPct(item.evidence.conversionRate)} conversão</span>
    </div>
  );
}

export function MenuPerformanceTab({
  storeId,
  onEditProduct,
}: {
  storeId: number;
  onEditProduct: (productId: number) => void;
}) {
  const utils = trpc.useUtils();
  const [period, setPeriod] = useState<Period>("30d");
  const [search, setSearch] = useState("");
  const [ranking, setRanking] = useState<"best" | "worst">("best");
  const [selectedProduct, setSelectedProduct] = useState<ProductPerformance | null>(null);

  const menuQuery = trpc.analytics.menu.useQuery({
    storeId,
    period,
    search: search.trim() || undefined,
    limit: 500,
  });
  const overviewQuery = trpc.analytics.overview.useQuery({ storeId, period });
  const recommendationsQuery = trpc.analytics.recommendations.useQuery({ storeId, period, limit: 12 });
  const dismissRecommendation = trpc.analytics.dismissRecommendation.useMutation({
    onSuccess: async () => {
      await utils.analytics.recommendations.invalidate();
      toast.success("Recomendação dispensada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const previousFunnelMap = useMemo(
    () => new Map((overviewQuery.data?.previousFunnel ?? []).map((row) => [row.eventType, row.value])),
    [overviewQuery.data?.previousFunnel],
  );

  const ranked = useMemo(() => {
    const rows = [...(menuQuery.data?.products ?? [])];
    if (ranking === "best") {
      return rows.sort((a, b) => b.soldQuantity - a.soldQuantity || b.revenue - a.revenue);
    }
    return rows.sort((a, b) => {
      // "Menos vendidos" keeps exposure context visible instead of showing
      // only zero-sale products without traffic.
      if (a.soldQuantity !== b.soldQuantity) return a.soldQuantity - b.soldQuantity;
      return b.views - a.views;
    });
  }, [menuQuery.data?.products, ranking]);

  const trackingStart = menuQuery.data?.scope.dataAvailableFrom
    ? new Date(menuQuery.data.scope.dataAvailableFrom)
    : null;

  return (
    <div className="space-y-6">
      <AdminSurface
        title="Desempenho do cardápio"
        subtitle="Conversão, ranking e oportunidades calculados com dados reais da unidade."
        actions={
          <AdminChipGroup
            value={period}
            onChange={setPeriod}
            items={[
              { value: "today", label: "Hoje" },
              { value: "7d", label: "7 dias" },
              { value: "30d", label: "30 dias" },
              { value: "90d", label: "90 dias" },
            ]}
          />
        }
      >
        {trackingStart && (
          <div className="rounded-[12px] border border-[var(--admin-info)]/15 bg-[var(--admin-info-bg)] px-4 py-3 text-xs text-[var(--admin-text-secondary)]">
            Dados de navegação e conversão disponíveis a partir de <strong>{trackingStart.toLocaleDateString("pt-BR")}</strong>. Vendas históricas continuam sendo calculadas pelos pedidos reais.
          </div>
        )}
      </AdminSurface>

      <AdminSurface title="Conversão do cardápio" subtitle="Sessões únicas que avançaram por cada etapa no período selecionado.">
        {menuQuery.isLoading || overviewQuery.isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--admin-text-secondary)]">Calculando funil...</div>
        ) : !(menuQuery.data?.funnel?.[0]?.value) ? (
          <AdminEmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="Ainda não há sessões suficientes neste período"
            description="O funil começa a ser preenchido conforme clientes navegam pelo cardápio, adicionam itens e concluem pedidos."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-5">
            {menuQuery.data.funnel.map((stage, index) => {
              const previous = previousFunnelMap.get(stage.eventType) ?? 0;
              const variation = delta(stage.value, previous);
              return (
                <div key={stage.eventType} className="relative rounded-[14px] border border-[var(--admin-border)] bg-white p-4">
                  <p className="text-[11px] font-semibold text-[var(--admin-text-muted)]">{FUNNEL_LABELS[stage.eventType] ?? stage.eventType}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-.03em] text-[var(--admin-text-primary)]">{stage.value.toLocaleString("pt-BR")}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--admin-text-secondary)]">{formatPct(stage.rate)} do topo</p>
                  <div className="mt-3 min-h-5">
                    {variation == null ? (
                      <span className="text-[11px] text-[var(--admin-text-muted)]">Sem base anterior</span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${variation > 0 ? "text-[var(--admin-success)]" : variation < 0 ? "text-[var(--admin-danger)]" : "text-[var(--admin-text-muted)]"}`}>
                        {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : variation < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                        {variation > 0 ? "+" : ""}{formatPct(variation)} vs. período anterior
                      </span>
                    )}
                  </div>
                  {index < menuQuery.data.funnel.length - 1 && (
                    <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-[var(--admin-text-muted)] md:block">→</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AdminSurface>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.08em] text-[var(--admin-brand-700)]">Recomendações</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--admin-text-primary)]">Oportunidades encontradas nos dados</h3>
            <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">Regras usam cadastro, visualizações, carrinho e vendas. Nenhuma recomendação é criada sem evidência.</p>
          </div>
          <AdminPill tone="brand">{recommendationsQuery.data?.recommendations.length ?? 0} ativas</AdminPill>
        </div>

        {recommendationsQuery.isLoading ? (
          <AdminSurface><div className="py-10 text-center text-sm text-[var(--admin-text-secondary)]">Analisando cardápio...</div></AdminSurface>
        ) : !(recommendationsQuery.data?.recommendations.length) ? (
          <AdminSurface>
            <AdminEmptyState
              icon={<Sparkles className="h-8 w-8" />}
              title="Nenhuma recomendação relevante agora"
              description="O sistema continuará avaliando cadastro, exposição, carrinho e conversão conforme novos dados chegam."
            />
          </AdminSurface>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {recommendationsQuery.data.recommendations.map((item) => (
              <AdminInsightCard
                key={item.key}
                eyebrow={item.ruleType.replaceAll("_", " ")}
                title={item.title}
                description={item.description}
                icon={<Lightbulb className="h-4 w-4" />}
                tone={item.severity === "warning" ? "warning" : item.severity === "opportunity" ? "success" : "info"}
              >
                <Evidence item={item} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => item.action === "edit_product" ? onEditProduct(item.productId) : setSelectedProduct((menuQuery.data?.products ?? []).find((product) => product.id === item.productId) ?? null)}>
                    {item.action === "edit_product" ? "Editar produto" : "Ver desempenho"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissRecommendation.mutate({
                      storeId,
                      recommendationKey: item.key,
                      ruleType: item.ruleType,
                      productId: item.productId,
                      categoryId: item.categoryId,
                    })}
                    disabled={dismissRecommendation.isPending}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />Dispensar
                  </Button>
                </div>
              </AdminInsightCard>
            ))}
          </div>
        )}
      </section>

      <AdminSurface
        title="Itens do cardápio"
        subtitle="Visualizações, vendas, conversão e receita no período selecionado."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={ranking} onValueChange={(value) => setRanking(value as "best" | "worst")}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Mais vendidos</SelectItem>
                <SelectItem value="worst">Menos vendidos</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--admin-text-muted)]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar itens..." className="pl-9" />
            </div>
          </div>
        }
        flush
      >
        {menuQuery.isLoading ? (
          <div className="p-6 text-center text-sm text-[var(--admin-text-secondary)]">Carregando desempenho...</div>
        ) : ranked.length === 0 ? (
          <AdminEmptyState title="Nenhum item encontrado" description="Não há produtos que correspondam à busca neste período." />
        ) : (
          <AdminDataTableShell className="rounded-none border-0">
            <table className="admin-data-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th className="text-right">Visitas</th>
                  <th className="text-right">Carrinhos</th>
                  <th className="text-right">Vendas</th>
                  <th className="text-right">Conversão</th>
                  <th className="text-right">Receita</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 100).map((product, index) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="w-7 text-right text-xs font-semibold text-[var(--admin-text-muted)]">{index + 1}º</span>
                        {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-[9px] object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-[9px] bg-[var(--admin-surface-alt)]"><Eye className="h-4 w-4 text-[var(--admin-text-muted)]" /></div>}
                        <span className="max-w-[260px] truncate font-semibold">{product.name}</span>
                      </div>
                    </td>
                    <td>{product.categoryName}</td>
                    <td className="text-right">{product.views.toLocaleString("pt-BR")}</td>
                    <td className="text-right">{product.cartSessions.toLocaleString("pt-BR")}</td>
                    <td className="text-right">{product.soldQuantity.toLocaleString("pt-BR")}</td>
                    <td className="text-right font-semibold">{product.views > 0 ? formatPct(product.conversionRate) : "—"}</td>
                    <td className="text-right font-semibold">{formatCurrency(product.revenue)}</td>
                    <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setSelectedProduct(product)}>Ver desempenho</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminDataTableShell>
        )}
      </AdminSurface>

      <Dialog open={Boolean(selectedProduct)} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>Desempenho — {selectedProduct.name}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Visualizações", selectedProduct.views.toLocaleString("pt-BR"), Eye],
                  ["Carrinhos", selectedProduct.cartSessions.toLocaleString("pt-BR"), ShoppingCart],
                  ["Vendas", selectedProduct.soldQuantity.toLocaleString("pt-BR"), ShoppingBag],
                  ["Receita", formatCurrency(selectedProduct.revenue), BarChart3],
                ].map(([label, value, Icon]) => {
                  const IconComponent = Icon as typeof Eye;
                  return (
                    <div key={String(label)} className="rounded-[14px] border border-[var(--admin-border)] p-4">
                      <IconComponent className="h-4 w-4 text-[var(--admin-brand-800)]" />
                      <p className="mt-3 text-[11px] font-semibold text-[var(--admin-text-muted)]">{label as string}</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--admin-text-primary)]">{value as string}</p>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[14px] bg-[var(--admin-surface-alt)] p-4"><p className="text-xs text-[var(--admin-text-secondary)]">Produto → compra</p><p className="mt-2 text-2xl font-semibold">{selectedProduct.views ? formatPct(selectedProduct.conversionRate) : "—"}</p></div>
                <div className="rounded-[14px] bg-[var(--admin-surface-alt)] p-4"><p className="text-xs text-[var(--admin-text-secondary)]">Produto → carrinho</p><p className="mt-2 text-2xl font-semibold">{selectedProduct.views ? formatPct(selectedProduct.cartRate) : "—"}</p></div>
                <div className="rounded-[14px] bg-[var(--admin-surface-alt)] p-4"><p className="text-xs text-[var(--admin-text-secondary)]">Carrinho → compra</p><p className="mt-2 text-2xl font-semibold">{selectedProduct.cartSessions ? formatPct(selectedProduct.checkoutConversionRate) : "—"}</p></div>
              </div>
              <p className="text-xs leading-5 text-[var(--admin-text-secondary)]">
                Conversão usa sessões de compra associadas ao produto ÷ sessões que visualizaram o produto. Não usamos quantidade vendida dividida por pageviews.
              </p>
              <div className="flex justify-end"><Button onClick={() => { onEditProduct(selectedProduct.id); setSelectedProduct(null); }}>Editar produto</Button></div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
