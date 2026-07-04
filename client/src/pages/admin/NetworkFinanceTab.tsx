import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { Building2, CheckCircle2, FileCheck2, PackageCheck, Plus, ReceiptText, RefreshCw, Send, Trash2, WalletCards } from "lucide-react";
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

const UNIT_LABELS: Record<string, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  unit: "un",
  pack: "pct",
  slice: "fatia",
  portion: "porção",
};

function monthRange(year: number, month: number) {
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0, 23, 59, 59),
  };
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    submitted: "Recebido",
    in_review: "Em análise",
    approved: "Aceito",
    picking: "Separando",
    shipped: "Entregue para loja",
    received: "Recebido pela loja",
    rejected: "Recusado",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}

function nextSupplyStatus(status: string) {
  if (status === "submitted") return "approved";
  if (status === "approved") return "picking";
  if (status === "picking") return "shipped";
  if (status === "shipped") return "received";
  return null;
}

function nextSupplyLabel(status: string) {
  const next = nextSupplyStatus(status);
  if (next === "approved") return "Aceitar pedido";
  if (next === "picking") return "Marcar separando";
  if (next === "shipped") return "Marcar entregue";
  if (next === "received") return "Confirmar recebido";
  return null;
}

type SupplyDraftItem = {
  productId: number;
  name: string;
  unit: string;
  quantityRequested: string;
  unitCost: number;
};

export function NetworkFinanceTab({ mode = "finance" }: { mode?: "finance" | "distribution" }) {
  const utils = trpc.useUtils();
  const { selectedStoreId, selectedStoreName, isManager } = useAdminStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [expenseForm, setExpenseForm] = useState({ category: "fornecedores", description: "", amount: "", paymentMethod: "pix", notes: "" });
  const [feeForm, setFeeForm] = useState({ name: "", category: "taxas de aplicativo", amount: "", calculationType: "fixed" as "fixed" | "percentage", rate: "0" });
  const [catalogForm, setCatalogForm] = useState({
    name: "",
    category: "",
    unit: "unit" as "g" | "kg" | "ml" | "l" | "unit" | "pack" | "slice" | "portion",
    availableQuantity: "0",
    minimumQuantity: "0",
    minOrderQuantity: "1",
    maxOrderQuantity: "",
    unitCost: "0.0000",
    notes: "",
  });
  const [supplyForm, setSupplyForm] = useState({ productId: "", quantity: "", notes: "" });
  const [supplyItems, setSupplyItems] = useState<SupplyDraftItem[]>([]);

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const queryInput = { storeId: selectedStoreId, startDate: range.startDate, endDate: range.endDate };
  const { data: overview, isLoading, refetch } = trpc.restaurantNetwork.overview.useQuery(queryInput);
  const { data: cdProducts = [] } = trpc.restaurantNetwork.distributionProducts.useQuery({ activeOnly: mode !== "distribution" });
  const { data: closings = [] } = trpc.restaurantNetwork.monthlyClosings.useQuery({ storeId: selectedStoreId, year }, { enabled: mode === "finance" });
  const { data: auditLogs = [] } = trpc.restaurantNetwork.auditLogs.useQuery({ storeId: selectedStoreId, limit: 30 }, { enabled: mode === "finance" });
  const supplyOrders = (overview?.supplyOrders ?? []) as Array<any>;
  const totals = overview?.totals as Record<string, number> | undefined;
  const selectedProduct = (cdProducts as any[]).find((item) => String(item.id) === supplyForm.productId);

  const invalidateNetwork = async () => {
    await Promise.all([
      utils.restaurantNetwork.overview.invalidate(),
      utils.restaurantNetwork.supplyOrders.invalidate(),
      utils.restaurantNetwork.distributionProducts.invalidate(),
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

  const createProduct = trpc.restaurantNetwork.createDistributionProduct.useMutation({
    onSuccess: async () => {
      toast.success("Produto do CD cadastrado.");
      setCatalogForm({ name: "", category: "", unit: "unit", availableQuantity: "0", minimumQuantity: "0", minOrderQuantity: "1", maxOrderQuantity: "", unitCost: "0.0000", notes: "" });
      await invalidateNetwork();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateProduct = trpc.restaurantNetwork.updateDistributionProduct.useMutation({
    onSuccess: async () => {
      toast.success("Produto atualizado.");
      await invalidateNetwork();
    },
    onError: (error) => toast.error(error.message),
  });

  const createSupplyOrder = trpc.restaurantNetwork.createSupplyOrder.useMutation({
    onSuccess: async () => {
      toast.success("Pedido enviado ao Centro de Distribuição.");
      setSupplyForm({ productId: "", quantity: "", notes: "" });
      setSupplyItems([]);
      await invalidateNetwork();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateSupplyStatus = trpc.restaurantNetwork.updateSupplyOrderStatus.useMutation({
    onSuccess: async () => {
      toast.success("Pedido do CD atualizado.");
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
  const supplyEstimate = supplyItems.reduce((sum, item) => sum + Number(item.quantityRequested || 0) * item.unitCost, 0);

  const addSupplyItem = () => {
    if (!selectedProduct) return toast.error("Selecione um produto do CD.");
    const quantity = Number(supplyForm.quantity);
    if (!supplyForm.quantity || quantity <= 0) return toast.error("Informe uma quantidade válida.");
    const min = Number(selectedProduct.minOrderQuantity ?? 0);
    const max = selectedProduct.maxOrderQuantity == null ? null : Number(selectedProduct.maxOrderQuantity);
    if (quantity < min) return toast.error(`Quantidade mínima: ${min} ${selectedProduct.unit}`);
    if (max !== null && quantity > max) return toast.error(`Quantidade máxima: ${max} ${selectedProduct.unit}`);

    setSupplyItems((current) => {
      const existing = current.find((item) => item.productId === Number(selectedProduct.id));
      if (existing) {
        return current.map((item) =>
          item.productId === Number(selectedProduct.id)
            ? { ...item, quantityRequested: String(Number(item.quantityRequested) + quantity) }
            : item
        );
      }
      return [
        ...current,
        {
          productId: Number(selectedProduct.id),
          name: selectedProduct.name,
          unit: selectedProduct.unit,
          quantityRequested: supplyForm.quantity,
          unitCost: Number(selectedProduct.unitCost ?? 0),
        },
      ];
    });
    setSupplyForm((state) => ({ ...state, productId: "", quantity: "" }));
  };

  const title = mode === "distribution" ? "Centro de Distribuição" : "Rede & Financeiro";
  const subtitle = mode === "distribution"
    ? `Controle dos produtos liberados e pedidos de cada loja - ${selectedStoreLabel}`
    : `Centro de distribuição, gastos e fechamento mensal - ${selectedStoreLabel}`;

  return (
    <AdminPage>
      <AdminTopbar
        title={title}
        subtitle={subtitle}
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
        {mode === "finance" ? (
          <AdminStatGrid>
            <AdminStat label="Receita" value={BRL.format(totals?.revenueTotal ?? 0)} icon={<WalletCards className="h-4 w-4" />} sub={`${totals?.orderCount ?? 0} pedidos`} trend="neutral" />
            <AdminStat label="Despesas" value={BRL.format(totals?.expenseTotal ?? 0)} icon={<ReceiptText className="h-4 w-4" />} sub={`${totals?.expenseCount ?? 0} lançamentos`} trend="down" />
            <AdminStat label="Custo CD" value={BRL.format(totals?.supplyCostTotal ?? 0)} icon={<PackageCheck className="h-4 w-4" />} sub={`${totals?.supplyOrderCount ?? 0} pedidos internos`} trend="neutral" />
            <AdminStat label="Resultado" value={BRL.format(totals?.netResult ?? 0)} icon={<Building2 className="h-4 w-4" />} sub={`${totals?.marginPercent ?? 0}% margem`} trend={(totals?.netResult ?? 0) >= 0 ? "up" : "down"} />
          </AdminStatGrid>
        ) : null}

        <div className={`grid grid-cols-1 gap-4 ${mode === "distribution" ? "xl:grid-cols-[420px,1fr]" : "xl:grid-cols-3"}`}>
          {mode === "distribution" ? (
            <AdminSurface title="Catálogo do CD" subtitle="Defina o que cada loja pode pedir, quantidade disponível, limites e custo.">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Produto</Label>
                    <Input value={catalogForm.name} onChange={(e) => setCatalogForm((s) => ({ ...s, name: e.target.value }))} placeholder="Queijo mussarela" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Input value={catalogForm.category} onChange={(e) => setCatalogForm((s) => ({ ...s, category: e.target.value }))} placeholder="Laticínios" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Unidade</Label>
                    <Select value={catalogForm.unit} onValueChange={(value) => setCatalogForm((s) => ({ ...s, unit: value as typeof catalogForm.unit }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(UNIT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custo unitário</Label>
                    <Input value={catalogForm.unitCost} onChange={(e) => setCatalogForm((s) => ({ ...s, unitCost: e.target.value }))} placeholder="0.1200" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label>Disponível</Label>
                    <Input value={catalogForm.availableQuantity} onChange={(e) => setCatalogForm((s) => ({ ...s, availableQuantity: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mín. pedido</Label>
                    <Input value={catalogForm.minOrderQuantity} onChange={(e) => setCatalogForm((s) => ({ ...s, minOrderQuantity: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Máx. pedido</Label>
                    <Input value={catalogForm.maxOrderQuantity} onChange={(e) => setCatalogForm((s) => ({ ...s, maxOrderQuantity: e.target.value }))} placeholder="opcional" />
                  </div>
                </div>
                <Textarea value={catalogForm.notes} onChange={(e) => setCatalogForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Observações internas..." />
                <Button
                  className="w-full gap-2"
                  disabled={!catalogForm.name || !catalogForm.unitCost || createProduct.isPending}
                  onClick={() => createProduct.mutate({
                    ...catalogForm,
                    category: catalogForm.category || undefined,
                    maxOrderQuantity: catalogForm.maxOrderQuantity || undefined,
                    notes: catalogForm.notes || undefined,
                    active: true,
                  })}
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar produto do CD
                </Button>

                <div className="space-y-2 pt-2">
                  {(cdProducts as any[]).slice(0, 12).map((product) => (
                    <div key={product.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {Number(product.availableQuantity ?? 0)} {UNIT_LABELS[product.unit] ?? product.unit} disponíveis - {BRL.format(Number(product.unitCost ?? 0))}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateProduct.mutate({ id: Number(product.id), active: !Boolean(product.active) })}
                        >
                          {product.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AdminSurface>
          ) : (
            <SupplyOrderForm
              cdProducts={cdProducts as any[]}
              selectedStoreId={selectedStoreId}
              isManager={isManager}
              supplyForm={supplyForm}
              setSupplyForm={setSupplyForm}
              supplyItems={supplyItems}
              setSupplyItems={setSupplyItems}
              selectedProduct={selectedProduct}
              supplyEstimate={supplyEstimate}
              addSupplyItem={addSupplyItem}
              createSupplyOrder={(notes) => {
                if (!selectedStoreId) return toast.error("Selecione uma loja.");
                createSupplyOrder.mutate({
                  storeId: selectedStoreId,
                  notes: notes || undefined,
                  submit: true,
                  items: supplyItems.map((item) => ({ productId: item.productId, quantityRequested: item.quantityRequested })),
                });
              }}
              isPending={createSupplyOrder.isPending}
            />
          )}

          {mode === "finance" ? (
            <>
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
            </>
          ) : (
            <SupplyOrdersPanel supplyOrders={supplyOrders} updateSupplyStatus={updateSupplyStatus} limit={120} />
          )}
        </div>

        {mode === "finance" ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SupplyOrdersPanel supplyOrders={supplyOrders} updateSupplyStatus={updateSupplyStatus} limit={20} />
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
                  (closings as any[]).slice(0, 8).map((closing) => (
                    <div key={closing.id} className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <p className="font-semibold">{String(closing.month).padStart(2, "0")}/{closing.year} - {closing.storeName ?? "Rede"}</p>
                        <p className="text-xs text-muted-foreground">Resultado {BRL.format(Number(closing.netResult ?? 0))} - margem {Number(closing.marginPercent ?? 0).toFixed(2)}%</p>
                      </div>
                      <AdminPill tone={closing.status === "closed" ? "success" : "info"}>{closing.status}</AdminPill>
                    </div>
                  ))
                )}
              </div>
            </AdminSurface>
          </div>
        ) : null}

        {mode === "finance" ? (
          <AdminSurface title="Auditoria operacional" subtitle="Registro das ações financeiras e de estoque deste módulo.">
            {auditLogs.length === 0 ? (
              <AdminEmptyState icon={<ReceiptText />} title="Sem auditoria ainda" description="Ações novas deste módulo aparecerão aqui." />
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {(auditLogs as any[]).map((log) => (
                  <div key={log.id} className="rounded-xl border p-3">
                    <p className="text-sm font-semibold">{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.entityType} #{log.entityId ?? "-"} - {new Date(log.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
              </div>
            )}
          </AdminSurface>
        ) : null}
      </div>
    </AdminPage>
  );
}

function SupplyOrderForm({
  cdProducts,
  selectedStoreId,
  isManager,
  supplyForm,
  setSupplyForm,
  supplyItems,
  setSupplyItems,
  selectedProduct,
  supplyEstimate,
  addSupplyItem,
  createSupplyOrder,
  isPending,
}: {
  cdProducts: any[];
  selectedStoreId?: number;
  isManager: boolean;
  supplyForm: { productId: string; quantity: string; notes: string };
  setSupplyForm: Dispatch<SetStateAction<{ productId: string; quantity: string; notes: string }>>;
  supplyItems: SupplyDraftItem[];
  setSupplyItems: Dispatch<SetStateAction<SupplyDraftItem[]>>;
  selectedProduct: any;
  supplyEstimate: number;
  addSupplyItem: () => void;
  createSupplyOrder: (notes: string) => void;
  isPending: boolean;
}) {
  return (
    <AdminSurface title="Pedido ao Centro de Distribuição" subtitle="A loja pede apenas os produtos liberados no catálogo do CD.">
      <div className="space-y-3">
        {!selectedStoreId && !isManager ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Selecione uma loja no topo para criar pedido ao CD.</p>
        ) : null}
        <div className="space-y-1.5">
          <Label>Produto liberado pelo CD</Label>
          <Select value={supplyForm.productId} onValueChange={(value) => setSupplyForm((state) => ({ ...state, productId: value }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
            <SelectContent>
              {cdProducts.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name} - {Number(item.availableQuantity ?? 0)} {UNIT_LABELS[item.unit] ?? item.unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Quantidade</Label>
            <Input value={supplyForm.quantity} onChange={(e) => setSupplyForm((state) => ({ ...state, quantity: e.target.value }))} placeholder={selectedProduct?.minOrderQuantity ?? "1"} />
          </div>
          <div className="space-y-1.5">
            <Label>Custo estimado</Label>
            <Input readOnly value={selectedProduct && supplyForm.quantity ? BRL.format(Number(selectedProduct.unitCost ?? 0) * Number(supplyForm.quantity || 0)) : "R$ 0,00"} />
          </div>
        </div>
        {selectedProduct ? (
          <p className="text-xs text-muted-foreground">
            Mínimo {Number(selectedProduct.minOrderQuantity ?? 0)} {UNIT_LABELS[selectedProduct.unit] ?? selectedProduct.unit}
            {selectedProduct.maxOrderQuantity ? ` - máximo ${Number(selectedProduct.maxOrderQuantity)} ${UNIT_LABELS[selectedProduct.unit] ?? selectedProduct.unit}` : ""}
          </p>
        ) : null}
        <Button type="button" variant="outline" className="w-full gap-2" onClick={addSupplyItem} disabled={!supplyForm.productId || !supplyForm.quantity}>
          <Plus className="h-4 w-4" />
          Adicionar produto ao pedido
        </Button>

        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Itens do pedido</p>
            <p className="text-xs text-muted-foreground">{supplyItems.length} itens - {BRL.format(supplyEstimate)}</p>
          </div>
          {supplyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Adicione os produtos que a loja quer pedir ao CD.</p>
          ) : (
            <div className="space-y-2">
              {supplyItems.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.quantityRequested} {UNIT_LABELS[item.unit] ?? item.unit} - {BRL.format(item.unitCost * Number(item.quantityRequested || 0))}</p>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setSupplyItems((current) => current.filter((row) => row.productId !== item.productId))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Textarea value={supplyForm.notes} onChange={(e) => setSupplyForm((state) => ({ ...state, notes: e.target.value }))} placeholder="Observações para o CD..." />
        <Button className="w-full gap-2" disabled={!selectedStoreId || supplyItems.length === 0 || isPending} onClick={() => createSupplyOrder(supplyForm.notes)}>
          <Send className="h-4 w-4" />
          Enviar pedido ao CD
        </Button>
      </div>
    </AdminSurface>
  );
}

function SupplyOrdersPanel({ supplyOrders, updateSupplyStatus, limit }: { supplyOrders: any[]; updateSupplyStatus: any; limit: number }) {
  return (
    <AdminSurface
      title="Pedidos das lojas para o CD"
      subtitle="O CD vê a loja, aceita o pedido, separa e marca como entregue."
      actions={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
    >
      {supplyOrders.length === 0 ? (
        <AdminEmptyState icon={<PackageCheck />} title="Nenhum pedido ao CD" description="Os pedidos criados pelas lojas aparecerão aqui." />
      ) : (
        <div className="space-y-2">
          {supplyOrders.slice(0, limit).map((order) => {
            const next = nextSupplyStatus(order.status);
            const label = nextSupplyLabel(order.status);
            return (
              <div key={order.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">#{order.id} - {order.storeName ?? "Loja"}</p>
                    <p className="text-xs text-muted-foreground">{order.itemCount} itens - {BRL.format(Number(order.estimatedCost ?? 0))}</p>
                    {order.itemSummary ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{order.itemSummary}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AdminPill tone={order.status === "received" ? "success" : order.status === "rejected" ? "danger" : "warning"}>{statusLabel(order.status)}</AdminPill>
                    {next && label ? (
                      <Button size="sm" variant="outline" onClick={() => updateSupplyStatus.mutate({ id: Number(order.id), status: next })}>
                        {next === "shipped" ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : null}
                        {label}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminSurface>
  );
}
