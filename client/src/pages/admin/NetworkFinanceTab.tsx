import { useMemo, useState } from "react";
import { Building2, FileCheck2, PackageCheck, Plus, ReceiptText, RefreshCw, Scale, Send, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminEmptyState, AdminPage, AdminPill, AdminStat, AdminStatGrid, AdminSurface, AdminTopbar } from "@/components/admin/ui";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { trpc } from "@/lib/trpc";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function monthRange(year: number, month: number) {
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0, 23, 59, 59),
  };
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    submitted: "Enviado",
    in_review: "Em análise",
    approved: "Aprovado",
    picking: "Separando",
    shipped: "Enviado para loja",
    received: "Recebido",
    rejected: "Recusado",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}

export function NetworkFinanceTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId, selectedStoreName, stores, isManager } = useAdminStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [expenseForm, setExpenseForm] = useState({ category: "fornecedores", description: "", amount: "", paymentMethod: "pix", notes: "" });
  const [feeForm, setFeeForm] = useState({ name: "", category: "taxas de aplicativo", amount: "", calculationType: "fixed" as "fixed" | "percentage", rate: "0" });
  const [supplyForm, setSupplyForm] = useState({ ingredientId: "", quantity: "", notes: "" });

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const queryInput = { storeId: selectedStoreId, startDate: range.startDate, endDate: range.endDate };
  const { data: overview, isLoading, refetch } = trpc.restaurantNetwork.overview.useQuery(queryInput);
  const { data: ingredients = [] } = trpc.inventory.list.useQuery({ storeId: selectedStoreId, activeOnly: true });
  const { data: closings = [] } = trpc.restaurantNetwork.monthlyClosings.useQuery({ storeId: selectedStoreId, year });
  const { data: auditLogs = [] } = trpc.restaurantNetwork.auditLogs.useQuery({ storeId: selectedStoreId, limit: 30 });
  const supplyOrders = (overview?.supplyOrders ?? []) as Array<any>;
  const totals = overview?.totals as Record<string, number> | undefined;

  const invalidateNetwork = async () => {
    await Promise.all([
      utils.restaurantNetwork.overview.invalidate(),
      utils.restaurantNetwork.supplyOrders.invalidate(),
      utils.restaurantNetwork.monthlyClosings.invalidate(),
      utils.restaurantNetwork.auditLogs.invalidate(),
      utils.inventory.list.invalidate(),
      utils.inventory.movements.invalidate(),
    ]);
  };

  const createExpense = trpc.restaurantNetwork.createExpense.useMutation({
    onSuccess: async () => {
      toast.success("Despesa registrada.");
      setExpenseForm({ category: "fornecedores", description: "", amount: "", paymentMethod: "pix", notes: "" });
      await invalidateNetwork();
    },
    onError: (error) => toast.error(error.message),
  });

  const createFee = trpc.restaurantNetwork.createFinancialFee.useMutation({
    onSuccess: async () => {
      toast.success("Taxa registrada.");
      setFeeForm({ name: "", category: "taxas de aplicativo", amount: "", calculationType: "fixed", rate: "0" });
      await invalidateNetwork();
    },
    onError: (error) => toast.error(error.message),
  });

  const createSupplyOrder = trpc.restaurantNetwork.createSupplyOrder.useMutation({
    onSuccess: async () => {
      toast.success("Pedido ao centro de distribuição criado.");
      setSupplyForm({ ingredientId: "", quantity: "", notes: "" });
      await invalidateNetwork();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateSupplyStatus = trpc.restaurantNetwork.updateSupplyOrderStatus.useMutation({
    onSuccess: async () => {
      toast.success("Status atualizado.");
      await invalidateNetwork();
    },
    onError: (error) => toast.error(error.message),
  });

  const closeMonth = trpc.restaurantNetwork.upsertMonthlyClosing.useMutation({
    onSuccess: async () => {
      toast.success("Fechamento mensal atualizado.");
      await invalidateNetwork();
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedStoreLabel = selectedStoreId ? selectedStoreName : "Rede completa";
  const selectedIngredient = ingredients.find((item: any) => String(item.id) === supplyForm.ingredientId) as any;

  return (
    <AdminPage>
      <AdminTopbar
        title="Rede & Financeiro"
        subtitle={`Centro de distribuição, gastos e fechamento mensal — ${selectedStoreLabel}`}
        onRefresh={() => refetch()}
        refreshing={isLoading}
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
              <SelectTrigger className="h-8 w-[118px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}/{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="h-8 w-20" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
        }
      />

      <div className="space-y-5 p-4 md:p-6">
        <AdminStatGrid>
          <AdminStat label="Receita" value={BRL.format(totals?.revenueTotal ?? 0)} icon={<WalletCards className="h-4 w-4" />} sub={`${totals?.orderCount ?? 0} pedidos`} trend="neutral" />
          <AdminStat label="Despesas" value={BRL.format(totals?.expenseTotal ?? 0)} icon={<ReceiptText className="h-4 w-4" />} sub={`${totals?.expenseCount ?? 0} lançamentos`} trend="down" />
          <AdminStat label="Taxas + CD" value={BRL.format((totals?.feeTotal ?? 0) + (totals?.supplyCostTotal ?? 0))} icon={<Scale className="h-4 w-4" />} sub="taxas e pedidos internos" trend="neutral" />
          <AdminStat label="Resultado" value={BRL.format(totals?.netResult ?? 0)} icon={<Building2 className="h-4 w-4" />} sub={`${totals?.marginPercent ?? 0}% margem`} trend={(totals?.netResult ?? 0) >= 0 ? "up" : "down"} />
        </AdminStatGrid>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <AdminSurface title="Pedido ao centro de distribuição" subtitle="Use os ingredientes já cadastrados no estoque.">
            <div className="space-y-3">
              {!selectedStoreId && !isManager ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Selecione uma loja no topo para criar pedido ao CD.</p>
              ) : null}
              <div className="space-y-1.5">
                <Label>Produto/insumo</Label>
                <Select value={supplyForm.ingredientId} onValueChange={(value) => setSupplyForm((state) => ({ ...state, ingredientId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar insumo" /></SelectTrigger>
                  <SelectContent>
                    {ingredients.map((item: any) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Quantidade</Label>
                  <Input value={supplyForm.quantity} onChange={(e) => setSupplyForm((state) => ({ ...state, quantity: e.target.value }))} placeholder="10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Custo estimado</Label>
                  <Input readOnly value={selectedIngredient && supplyForm.quantity ? BRL.format(Number(selectedIngredient.unitCost ?? 0) * Number(supplyForm.quantity || 0)) : "R$ 0,00"} />
                </div>
              </div>
              <Textarea value={supplyForm.notes} onChange={(e) => setSupplyForm((state) => ({ ...state, notes: e.target.value }))} placeholder="Observações para o CD..." />
              <Button
                className="w-full gap-2"
                disabled={!selectedStoreId || !supplyForm.ingredientId || !supplyForm.quantity || createSupplyOrder.isPending}
                onClick={() => {
                  if (!selectedStoreId) return toast.error("Selecione uma loja.");
                  createSupplyOrder.mutate({
                    storeId: selectedStoreId,
                    notes: supplyForm.notes || undefined,
                    submit: true,
                    items: [{ ingredientId: Number(supplyForm.ingredientId), quantityRequested: supplyForm.quantity }],
                  });
                }}
              >
                <Send className="h-4 w-4" />
                Enviar pedido ao CD
              </Button>
            </div>
          </AdminSurface>

          <AdminSurface title="Registrar despesa" subtitle="Lançamentos entram no fechamento mensal.">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Input value={expenseForm.category} onChange={(e) => setExpenseForm((state) => ({ ...state, category: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor</Label>
                  <Input value={expenseForm.amount} onChange={(e) => setExpenseForm((state) => ({ ...state, amount: e.target.value }))} placeholder="250.00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input value={expenseForm.description} onChange={(e) => setExpenseForm((state) => ({ ...state, description: e.target.value }))} placeholder="Compra emergencial, energia, marketing..." />
              </div>
              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <Input value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm((state) => ({ ...state, paymentMethod: e.target.value }))} />
              </div>
              <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm((state) => ({ ...state, notes: e.target.value }))} placeholder="Observações..." />
              <Button
                className="w-full gap-2"
                disabled={!expenseForm.category || !expenseForm.description || !expenseForm.amount || createExpense.isPending}
                onClick={() => createExpense.mutate({
                  storeId: selectedStoreId,
                  category: expenseForm.category,
                  description: expenseForm.description,
                  amount: expenseForm.amount,
                  paymentMethod: expenseForm.paymentMethod,
                  expenseDate: new Date(),
                  notes: expenseForm.notes || undefined,
                })}
              >
                <Plus className="h-4 w-4" />
                Registrar despesa
              </Button>
            </div>
          </AdminSurface>

          <AdminSurface title="Taxas agregadas" subtitle="Cartão, app, banco, impostos e comissões.">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={feeForm.name} onChange={(e) => setFeeForm((state) => ({ ...state, name: e.target.value }))} placeholder="Taxa iFood, cartão, imposto..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Input value={feeForm.category} onChange={(e) => setFeeForm((state) => ({ ...state, category: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor</Label>
                  <Input value={feeForm.amount} onChange={(e) => setFeeForm((state) => ({ ...state, amount: e.target.value }))} placeholder="99.90" />
                </div>
              </div>
              <Button
                className="w-full gap-2"
                disabled={!feeForm.name || !feeForm.amount || createFee.isPending}
                onClick={() => createFee.mutate({
                  storeId: selectedStoreId,
                  name: feeForm.name,
                  category: feeForm.category,
                  calculationType: feeForm.calculationType,
                  rate: feeForm.rate,
                  amount: feeForm.amount,
                  periodStart: range.startDate,
                  periodEnd: range.endDate,
                })}
              >
                <Plus className="h-4 w-4" />
                Registrar taxa
              </Button>
            </div>
          </AdminSurface>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AdminSurface
            title="Pedidos das lojas para o CD"
            subtitle="Fluxo real: loja solicita, CD aprova/separa/envia, loja recebe."
            actions={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
          >
            {supplyOrders.length === 0 ? (
              <AdminEmptyState icon={<PackageCheck />} title="Nenhum pedido ao CD" description="Os pedidos criados pelas lojas aparecerão aqui." />
            ) : (
              <div className="space-y-2">
                {supplyOrders.slice(0, 12).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <p className="font-semibold">#{order.id} · {order.storeName ?? "Loja"}</p>
                      <p className="text-xs text-muted-foreground">{order.itemCount} itens · {BRL.format(Number(order.estimatedCost ?? 0))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AdminPill tone={order.status === "received" ? "success" : order.status === "rejected" ? "danger" : "warning"}>{statusLabel(order.status)}</AdminPill>
                      {order.status !== "received" && order.status !== "rejected" && order.status !== "cancelled" ? (
                        <Button size="sm" variant="outline" onClick={() => {
                          const next = order.status === "submitted" ? "approved" : order.status === "approved" ? "picking" : order.status === "picking" ? "shipped" : "received";
                          updateSupplyStatus.mutate({ id: Number(order.id), status: next as any });
                        }}>
                          Avançar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminSurface>

          <AdminSurface
            title="Fechamento mensal"
            subtitle="Consolida receitas, despesas, taxas e custo de pedidos ao CD."
            actions={
              <Button size="sm" className="gap-2" onClick={() => closeMonth.mutate({ storeId: selectedStoreId, year, month, status: "closed" })}>
                <FileCheck2 className="h-4 w-4" />
                Fechar mês
              </Button>
            }
          >
            <div className="space-y-2">
              {closings.length === 0 ? (
                <AdminEmptyState icon={<FileCheck2 />} title="Sem fechamentos" description="Feche um mês para travar e auditar o resultado." />
              ) : (
                closings.slice(0, 8).map((closing: any) => (
                  <div key={closing.id} className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <p className="font-semibold">{String(closing.month).padStart(2, "0")}/{closing.year} · {closing.storeName ?? "Rede"}</p>
                      <p className="text-xs text-muted-foreground">Resultado {BRL.format(Number(closing.netResult ?? 0))} · margem {Number(closing.marginPercent ?? 0).toFixed(2)}%</p>
                    </div>
                    <AdminPill tone={closing.status === "closed" ? "success" : "info"}>{closing.status}</AdminPill>
                  </div>
                ))
              )}
            </div>
          </AdminSurface>
        </div>

        <AdminSurface title="Auditoria operacional" subtitle="Registro das ações financeiras e de estoque deste módulo.">
          {auditLogs.length === 0 ? (
            <AdminEmptyState icon={<ReceiptText />} title="Sem auditoria ainda" description="Ações novas deste módulo aparecerão aqui." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="rounded-xl border p-3">
                  <p className="text-sm font-semibold">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.entityType} #{log.entityId ?? "-"} · {new Date(log.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          )}
        </AdminSurface>
      </div>
    </AdminPage>
  );
}
