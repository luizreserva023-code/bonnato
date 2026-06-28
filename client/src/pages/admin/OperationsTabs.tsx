import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { toast } from "sonner";
import { AlertTriangle, ChefHat, Clock3, Copy, Plus, RefreshCw, Store, Trash2, Users, UtensilsCrossed, Warehouse } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useAdminStore } from "@/contexts/AdminStoreContext";
import { AdminPage, AdminSearch, AdminSectionLabel, AdminStat, AdminStatGrid, AdminSurface, AdminTopbar } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AppRouter } from "../../../../server/routers";

type DecimalString = string;
type RouterOutputs = inferRouterOutputs<AppRouter>;
type IngredientUnit = "g" | "kg" | "ml" | "l" | "unit" | "pack" | "slice" | "portion";
type InventoryMovementType = "entry" | "manual_adjustment" | "waste" | "reversal";
type StaffRole = "admin" | "manager" | "waiter" | "cashier" | "attendant" | "kitchen" | "driver";

type InventoryIngredient = RouterOutputs["inventory"]["list"][number];
type InventoryMovement = RouterOutputs["inventory"]["movements"][number];
type InventoryRecipeItem = RouterOutputs["inventory"]["recipe"][number];
type ProductListItem = RouterOutputs["products"]["listAll"][number];
type StaffMember = RouterOutputs["staffMembers"]["list"][number];
type DiningTableRecord = RouterOutputs["diningRoom"]["tables"][number];

type DiningSessionItem = {
  id: number;
  tableSessionId: number;
  productId: number;
  productName: string;
  unitPrice: string;
  quantity: number;
  notes: string | null;
  addedByStaffId: number | null;
  addedByStaffName: string | null;
  status: string;
  requestedAt: string | Date;
  readyAt: string | Date | null;
  servedAt: string | Date | null;
  createdAt: string | Date;
  lineTotal: string;
};

type DiningLinkedOrder = {
  orderId: number;
  customerName: string;
  status: string;
  total: string;
  createdAt: string | Date;
};

type DiningSessionRecord = {
  id: number;
  tableId: number;
  storeId: number | null;
  waiterStaffId: number | null;
  customerName: string | null;
  guestCount: number;
  status: "open" | "awaiting_closure" | "closed" | "cancelled";
  notes: string | null;
  openedAt: string | Date;
  closedAt?: string | Date | null;
  subtotal: string;
  discountAmount: string;
  tipAmount: string;
  total: string;
  tableName: string;
  tableCapacity: number;
  waiterName: string | null;
  items: DiningSessionItem[];
  linkedOrders: DiningLinkedOrder[];
  itemCount: number;
  linkedOrderCount: number;
  itemsSubtotal: string;
  linkedOrdersTotal: string;
  computedSubtotal: string;
  computedTotal: string;
};

function requireStoreSelection(selectedStoreId: number | undefined, actionLabel: string) {
  if (selectedStoreId) return true;
  toast.error(`Selecione uma loja no topo do painel antes de ${actionLabel}.`);
  return false;
}

export function InventoryTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId } = useAdminStore();
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    category: "",
    unit: "g" as IngredientUnit,
    currentStock: "0",
    minimumStock: "0",
    unitCost: "0",
    supplier: "",
    notes: "",
  });
  const [recipeItems, setRecipeItems] = useState<Array<{ ingredientId: number; quantity: DecimalString; wastePercent: DecimalString }>>([]);
  const [stockAdjust, setStockAdjust] = useState<{ ingredientId: string; quantityDelta: string; movementType: InventoryMovementType; reason: string }>({
    ingredientId: "",
    quantityDelta: "",
    movementType: "entry",
    reason: "",
  });

  const { data: ingredientsData, isLoading } = trpc.inventory.list.useQuery({
    storeId: selectedStoreId,
    activeOnly: true,
  });
  const { data: lowStockData } = trpc.inventory.lowStock.useQuery({ storeId: selectedStoreId });
  const { data: movementsData } = trpc.inventory.movements.useQuery({ storeId: selectedStoreId, limit: 15 });
  const { data: productsData } = trpc.products.listAll.useQuery();
  const { data: recipeData } = trpc.inventory.recipe.useQuery(
    { productId: selectedProductId ?? 0 },
    { enabled: !!selectedProductId }
  );
  const ingredients: InventoryIngredient[] = ingredientsData ?? [];
  const lowStock: InventoryIngredient[] = lowStockData ?? [];
  const movements: InventoryMovement[] = movementsData ?? [];
  const products: ProductListItem[] = productsData ?? [];
  const recipe: InventoryRecipeItem[] = recipeData ?? [];

  const createIngredient = trpc.inventory.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.inventory.list.invalidate(),
        utils.inventory.lowStock.invalidate(),
        utils.inventory.movements.invalidate(),
      ]);
      setIngredientForm({ name: "", category: "", unit: "g", currentStock: "0", minimumStock: "0", unitCost: "0", supplier: "", notes: "" });
      toast.success("Ingrediente criado.");
    },
    onError: (err) => toast.error(err.message),
  });

  const adjustStock = trpc.inventory.adjust.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.inventory.list.invalidate(),
        utils.inventory.lowStock.invalidate(),
        utils.inventory.movements.invalidate(),
      ]);
      setStockAdjust({ ingredientId: "", quantityDelta: "", movementType: "entry", reason: "" });
      toast.success("Estoque ajustado.");
    },
    onError: (err) => toast.error(err.message),
  });

  const setRecipe = trpc.inventory.setRecipe.useMutation({
    onSuccess: async () => {
      await utils.inventory.recipe.invalidate();
      toast.success("Ficha técnica salva.");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredIngredients = ingredients.filter((item) => {
    const q = search.trim().toLowerCase();
    return !q || item.name.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
  });

  const selectedProduct = products.find((item) => item.id === selectedProductId);

  return (
    <AdminPage>
      <AdminTopbar
        title="Operação e Estoque"
        subtitle="Ingredientes, ficha técnica e movimentação automática por pedido"
        onRefresh={() => {
          utils.inventory.list.invalidate();
          utils.inventory.lowStock.invalidate();
          utils.inventory.movements.invalidate();
        }}
      />

      <AdminStatGrid>
        <AdminStat label="Ingredientes ativos" value={String(ingredients?.length ?? 0)} icon={<Warehouse className="w-4 h-4" />} />
        <AdminStat label="Baixo estoque" value={String(lowStock.length)} icon={<AlertTriangle className="w-4 h-4" />} trend={lowStock.length > 0 ? "down" : "up"} />
        <AdminStat label="Produtos cadastrados" value={String(products.length)} icon={<ChefHat className="w-4 h-4" />} />
        <AdminStat label="Movimentos recentes" value={String(movements.length)} icon={<Store className="w-4 h-4" />} />
      </AdminStatGrid>

      {!selectedStoreId && (
        <AdminSurface title="Selecione uma loja" subtitle="Cadastros operacionais precisam estar vinculados a uma unidade específica.">
          <p className="text-sm text-muted-foreground">Escolha uma loja no topo do painel para cadastrar ingredientes, equipe, mesas e comandas sem erro.</p>
        </AdminSurface>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminSurface title="Ingredientes" subtitle="Cadastre e acompanhe o estoque por insumo.">
          <div className="space-y-4">
            <AdminSearch value={search} onChange={setSearch} placeholder="Buscar ingrediente ou categoria..." />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={ingredientForm.name} onChange={(e) => setIngredientForm((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={ingredientForm.category} onChange={(e) => setIngredientForm((s) => ({ ...s, category: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={ingredientForm.unit} onValueChange={(value) => setIngredientForm((s) => ({ ...s, unit: value as IngredientUnit }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"].map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estoque atual</Label>
                <Input value={ingredientForm.currentStock} onChange={(e) => setIngredientForm((s) => ({ ...s, currentStock: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Estoque mínimo</Label>
                <Input value={ingredientForm.minimumStock} onChange={(e) => setIngredientForm((s) => ({ ...s, minimumStock: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Custo unitário</Label>
                <Input value={ingredientForm.unitCost} onChange={(e) => setIngredientForm((s) => ({ ...s, unitCost: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Fornecedor</Label>
                <Input value={ingredientForm.supplier} onChange={(e) => setIngredientForm((s) => ({ ...s, supplier: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Notas</Label>
                <Textarea value={ingredientForm.notes} onChange={(e) => setIngredientForm((s) => ({ ...s, notes: e.target.value }))} rows={3} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (!requireStoreSelection(selectedStoreId, "cadastrar ingrediente")) return;
                  createIngredient.mutate({ ...ingredientForm, storeId: selectedStoreId });
                }}
                disabled={createIngredient.isPending || !ingredientForm.name.trim() || !selectedStoreId}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Criar ingrediente
              </Button>
            </div>

            <Separator />

            <div className="grid gap-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando ingredientes...</p>
              ) : filteredIngredients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum ingrediente encontrado.</p>
              ) : (
                filteredIngredients.map((item) => {
                  const isLow = Number(item.currentStock) <= Number(item.minimumStock);
                  return (
                    <div key={item.id} className="rounded-xl border p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.category || "Sem categoria"} · {Number(item.currentStock).toFixed(3)} {item.unit}
                          </p>
                        </div>
                        {isLow ? <Badge variant="destructive">Baixo estoque</Badge> : <Badge variant="secondary">OK</Badge>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </AdminSurface>

        <div className="space-y-4">
          <AdminSurface title="Ajuste rápido de estoque" subtitle="Entradas, perdas e correções manuais.">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Ingrediente</Label>
                <Select value={stockAdjust.ingredientId} onValueChange={(value) => setStockAdjust((s) => ({ ...s, ingredientId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o ingrediente" /></SelectTrigger>
                  <SelectContent>
                    {ingredients.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input value={stockAdjust.quantityDelta} onChange={(e) => setStockAdjust((s) => ({ ...s, quantityDelta: e.target.value }))} placeholder="Ex: 5.000" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={stockAdjust.movementType} onValueChange={(value) => setStockAdjust((s) => ({ ...s, movementType: value as InventoryMovementType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entrada</SelectItem>
                      <SelectItem value="manual_adjustment">Ajuste</SelectItem>
                      <SelectItem value="waste">Perda</SelectItem>
                      <SelectItem value="reversal">Estorno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Input value={stockAdjust.reason} onChange={(e) => setStockAdjust((s) => ({ ...s, reason: e.target.value }))} />
              </div>
              <Button
                className="w-full"
                disabled={adjustStock.isPending || !stockAdjust.ingredientId || !stockAdjust.quantityDelta}
                onClick={() =>
                  adjustStock.mutate({
                    ingredientId: Number(stockAdjust.ingredientId),
                    quantityDelta: stockAdjust.quantityDelta,
                    movementType: stockAdjust.movementType as "entry" | "manual_adjustment" | "waste" | "reversal",
                    reason: stockAdjust.reason || undefined,
                  })
                }
              >
                Ajustar estoque
              </Button>
            </div>
          </AdminSurface>

          <AdminSurface title="Ficha técnica por produto" subtitle="Defina quais ingredientes cada produto consome.">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select
                  value={selectedProductId ? String(selectedProductId) : ""}
                  onValueChange={(value) => {
                    const productId = Number(value);
                    setSelectedProductId(productId);
                    setRecipeItems([]);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProduct && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Produto atual: <span className="font-semibold text-foreground">{selectedProduct.name}</span>
                  </p>
                  <div className="space-y-2">
                    {recipe.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span>{item.ingredientName}</span>
                        <span className="text-muted-foreground">
                          {Number(item.quantity).toFixed(3)} {item.ingredientUnit} · perda {Number(item.wastePercent).toFixed(2)}%
                        </span>
                      </div>
                    ))}
                    {recipe.length === 0 && <p className="text-sm text-muted-foreground">Esse produto ainda não possui ficha técnica.</p>}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {recipeItems.map((item, index) => (
                      <div key={`${item.ingredientId}-${index}`} className="grid grid-cols-12 gap-2">
                        <div className="col-span-5">
                          <Select
                            value={String(item.ingredientId)}
                            onValueChange={(value) =>
                              setRecipeItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ingredientId: Number(value) } : row))
                            }
                          >
                            <SelectTrigger><SelectValue placeholder="Ingrediente" /></SelectTrigger>
                            <SelectContent>
                              {ingredients.map((ingredient) => (
                                <SelectItem key={ingredient.id} value={String(ingredient.id)}>{ingredient.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input
                            value={item.quantity}
                            onChange={(e) => setRecipeItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: e.target.value } : row))}
                            placeholder="Qtd"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            value={item.wastePercent}
                            onChange={(e) => setRecipeItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, wastePercent: e.target.value } : row))}
                            placeholder="% perda"
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setRecipeItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}>×</Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full gap-2" onClick={() => setRecipeItems((current) => [...current, { ingredientId: (ingredients?.[0]?.id ?? 0), quantity: "1", wastePercent: "0" }])}>
                      <Plus className="w-4 h-4" />
                      Adicionar ingrediente à ficha
                    </Button>
                    <Button
                      className="w-full"
                      disabled={!selectedProductId || setRecipe.isPending}
                      onClick={() =>
                        setRecipe.mutate({
                          productId: selectedProductId!,
                          items: recipeItems.filter((item) => item.ingredientId > 0 && item.quantity),
                        })
                      }
                    >
                      Salvar ficha técnica
                    </Button>
                  </div>
                </>
              )}
            </div>
          </AdminSurface>
        </div>
      </div>
    </AdminPage>
  );
}

export function StaffTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId } = useAdminStore();
  const [form, setForm] = useState<{ name: string; phone: string; email: string; role: StaffRole }>({ name: "", phone: "", email: "", role: "attendant" });
  const [lastAccess, setLastAccess] = useState<{ name: string; token: string } | null>(null);
  const { data: staffData } = trpc.staffMembers.list.useQuery({ storeId: selectedStoreId, activeOnly: true });
  const staff: StaffMember[] = staffData ?? [];

  const createStaff = trpc.staffMembers.create.useMutation({
    onSuccess: async (data) => {
      await utils.staffMembers.list.invalidate();
      setForm({ name: "", phone: "", email: "", role: "attendant" });
      if (data.accessToken) {
        setLastAccess({ name: form.name, token: data.accessToken });
      }
      toast.success("Membro da equipe cadastrado.");
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateAccessToken = trpc.staffMembers.regenerateAccessToken.useMutation({
    onSuccess: async (data, variables) => {
      await utils.staffMembers.list.invalidate();
      const member = staff.find((item) => item.id === variables.id);
      setLastAccess({ name: member?.name ?? "Garcom", token: data.accessToken });
      toast.success("Novo token do garcom gerado.");
    },
    onError: (err) => toast.error(err.message),
  });

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    toast.success("Token copiado.");
  };

  return (
    <AdminPage>
      <AdminTopbar title="Equipe operacional" subtitle="Garcom, caixa, cozinha, atendimento e lideranca" onRefresh={() => utils.staffMembers.list.invalidate()} />
      <AdminStatGrid>
        <AdminStat label="Total da equipe" value={String(staff.length)} icon={<Users className="w-4 h-4" />} />
        <AdminStat label="Cozinha" value={String(staff.filter((item) => item.role === "kitchen").length)} icon={<ChefHat className="w-4 h-4" />} />
        <AdminStat label="Atendimento" value={String(staff.filter((item) => item.role === "attendant" || item.role === "cashier").length)} icon={<Store className="w-4 h-4" />} />
        <AdminStat label="Salao" value={String(staff.filter((item) => item.role === "waiter").length)} icon={<UtensilsCrossed className="w-4 h-4" />} />
      </AdminStatGrid>

      {!selectedStoreId && (
        <AdminSurface title="Selecione uma loja" subtitle="Equipe operacional sempre pertence a uma unidade.">
          <p className="text-sm text-muted-foreground">Escolha uma loja no topo do admin antes de cadastrar novos membros da equipe.</p>
        </AdminSurface>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <AdminSurface title="Novo membro" subtitle="Cadastre um perfil operacional">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Funcao</Label>
                <Select value={form.role} onValueChange={(value) => setForm((s) => ({ ...s, role: value as StaffRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"].map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              disabled={createStaff.isPending || !form.name.trim() || !selectedStoreId}
              onClick={() => {
                if (!requireStoreSelection(selectedStoreId, "cadastrar equipe")) return;
                createStaff.mutate({ ...form, storeId: selectedStoreId });
              }}
            >
              Cadastrar equipe
            </Button>
            {lastAccess && (
              <div className="rounded-xl border border-dashed p-3 text-sm">
                <p className="font-semibold">Acesso do garcom</p>
                <p className="text-muted-foreground mt-1">{lastAccess.name} pode entrar em <code>/garcom</code> com este token:</p>
                <div className="mt-2 flex gap-2">
                  <code className="block flex-1 rounded-lg bg-muted px-3 py-2 break-all">{lastAccess.token}</code>
                  <Button type="button" size="icon" variant="outline" onClick={() => copyToken(lastAccess.token)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </AdminSurface>

        <AdminSurface title="Equipe atual" subtitle="Estrutura operacional ativa por loja">
          <div className="grid gap-3">
            {staff.map((member) => (
              <div key={member.id} className="rounded-xl border p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.phone || "Sem telefone"} - {member.email || "Sem e-mail"}</p>
                  {member.role === "waiter" && (
                    <div className="mt-3 rounded-lg bg-muted/60 p-3 space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Acesso do garcom</p>
                      <code className="block break-all text-xs">{member.accessToken || "Token pendente"}</code>
                      <div className="flex flex-wrap gap-2">
                        {member.accessToken && (
                          <Button type="button" size="sm" variant="outline" onClick={() => copyToken(member.accessToken)}>
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            Copiar token
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={regenerateAccessToken.isPending}
                          onClick={() => regenerateAccessToken.mutate({ id: member.id })}
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          {member.accessToken ? "Regenerar token" : "Gerar token"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <Badge variant="secondary">{member.role}</Badge>
              </div>
            ))}
            {staff.length === 0 && <p className="text-sm text-muted-foreground">Nenhum membro cadastrado ainda.</p>}
          </div>
        </AdminSurface>
      </div>
    </AdminPage>
  );
}

export function DiningRoomTab() {
  const utils = trpc.useUtils();
  const { selectedStoreId } = useAdminStore();
  const [tableForm, setTableForm] = useState({ name: "", capacity: "4" });
  const [sessionForm, setSessionForm] = useState({ tableId: "", customerName: "", guestCount: "2", notes: "" });
  const [itemDrafts, setItemDrafts] = useState<Record<number, { productId: string; quantity: string; notes: string }>>({});
  const [closingDrafts, setClosingDrafts] = useState<Record<number, { discountAmount: string; tipAmount: string }>>({});
  const { data: tablesData } = trpc.diningRoom.tables.useQuery({ storeId: selectedStoreId, activeOnly: true });
  const { data: sessionsData } = trpc.diningRoom.sessions.useQuery({ storeId: selectedStoreId });
  const { data: productsData } = trpc.products.listAll.useQuery();
  const tables = (tablesData ?? []) as DiningTableRecord[];
  const sessions = (sessionsData ?? []) as DiningSessionRecord[];
  const products = (productsData ?? []) as ProductListItem[];

  const invalidateDining = async () => {
    await Promise.all([utils.diningRoom.tables.invalidate(), utils.diningRoom.sessions.invalidate()]);
  };

  const createTable = trpc.diningRoom.createTable.useMutation({
    onSuccess: async () => {
      await utils.diningRoom.tables.invalidate();
      setTableForm({ name: "", capacity: "4" });
      toast.success("Mesa criada.");
    },
    onError: (err) => toast.error(err.message),
  });

  const openSession = trpc.diningRoom.openSession.useMutation({
    onSuccess: async () => {
      await invalidateDining();
      setSessionForm({ tableId: "", customerName: "", guestCount: "2", notes: "" });
      toast.success("Comanda aberta.");
    },
    onError: (err) => toast.error(err.message),
  });

  const closeSession = trpc.diningRoom.closeSession.useMutation({
    onSuccess: async () => {
      await invalidateDining();
      toast.success("Comanda atualizada.");
    },
    onError: (err) => toast.error(err.message),
  });

  const addItem = trpc.diningRoom.addItem.useMutation({
    onSuccess: async (_, variables) => {
      await invalidateDining();
      setItemDrafts((current) => ({
        ...current,
        [variables.tableSessionId]: { productId: "", quantity: "1", notes: "" },
      }));
      toast.success("Consumo adicionado na comanda.");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeItem = trpc.diningRoom.removeItem.useMutation({
    onSuccess: async () => {
      await invalidateDining();
      toast.success("Item removido da comanda.");
    },
    onError: (err) => toast.error(err.message),
  });

  const availableTables = useMemo(
    () => tables.filter((table) => table.status === "free" || table.status === "reserved"),
    [tables]
  );
  const activeProducts = useMemo(
    () => products.filter((product) => product.active),
    [products]
  );
  const getDraft = (sessionId: number) => itemDrafts[sessionId] ?? { productId: "", quantity: "1", notes: "" };
  const setDraftValue = (sessionId: number, next: Partial<{ productId: string; quantity: string; notes: string }>) => {
    setItemDrafts((current) => ({
      ...current,
      [sessionId]: {
        ...getDraft(sessionId),
        ...next,
      },
    }));
  };
  const getClosingDraft = (sessionId: number) => closingDrafts[sessionId] ?? { discountAmount: "0.00", tipAmount: "0.00" };

  return (
    <AdminPage>
      <AdminTopbar title="Salão e comandas" subtitle="Mesas, ocupação e sessões abertas" onRefresh={() => {
        utils.diningRoom.tables.invalidate();
        utils.diningRoom.sessions.invalidate();
      }} />

      <AdminStatGrid>
        <AdminStat label="Mesas ativas" value={String(tables.length)} icon={<UtensilsCrossed className="w-4 h-4" />} />
        <AdminStat label="Ocupadas" value={String(tables.filter((item) => item.status === "occupied").length)} icon={<Store className="w-4 h-4" />} />
        <AdminStat label="Comandas abertas" value={String(sessions.filter((item) => item.status === "open").length)} icon={<Users className="w-4 h-4" />} />
        <AdminStat label="Aguardando fechamento" value={String(sessions.filter((item) => item.status === "awaiting_closure").length)} icon={<AlertTriangle className="w-4 h-4" />} />
      </AdminStatGrid>

      {!selectedStoreId && (
        <AdminSurface title="Selecione uma loja" subtitle="Mesas e comandas não podem ser criadas em modo global.">
          <p className="text-sm text-muted-foreground">Escolha a unidade no topo do painel para liberar as ações de salão.</p>
        </AdminSurface>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <AdminSurface title="Nova mesa">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome da mesa</Label>
                <Input value={tableForm.name} onChange={(e) => setTableForm((s) => ({ ...s, name: e.target.value }))} placeholder="Mesa 01" />
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input value={tableForm.capacity} onChange={(e) => setTableForm((s) => ({ ...s, capacity: e.target.value }))} />
              </div>
              <Button
                className="w-full"
                disabled={createTable.isPending || !tableForm.name.trim() || !selectedStoreId}
                onClick={() => {
                  if (!requireStoreSelection(selectedStoreId, "criar mesa")) return;
                  createTable.mutate({ storeId: selectedStoreId, name: tableForm.name, capacity: Number(tableForm.capacity || 4) });
                }}
              >
                Criar mesa
              </Button>
            </div>
          </AdminSurface>

          <AdminSurface title="Abrir comanda">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Mesa</Label>
                <Select value={sessionForm.tableId} onValueChange={(value) => setSessionForm((s) => ({ ...s, tableId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a mesa" /></SelectTrigger>
                  <SelectContent>
                    {availableTables.map((table) => (
                      <SelectItem key={table.id} value={String(table.id)}>{table.name} · {table.status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input value={sessionForm.customerName} onChange={(e) => setSessionForm((s) => ({ ...s, customerName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Pessoas</Label>
                  <Input value={sessionForm.guestCount} onChange={(e) => setSessionForm((s) => ({ ...s, guestCount: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={sessionForm.notes} onChange={(e) => setSessionForm((s) => ({ ...s, notes: e.target.value }))} />
              </div>
              <Button
                className="w-full"
                disabled={openSession.isPending || !sessionForm.tableId || !selectedStoreId}
                onClick={() => {
                  if (!requireStoreSelection(selectedStoreId, "abrir comanda")) return;
                  openSession.mutate({
                    storeId: selectedStoreId,
                    tableId: Number(sessionForm.tableId),
                    customerName: sessionForm.customerName || undefined,
                    guestCount: Number(sessionForm.guestCount || 1),
                    notes: sessionForm.notes || undefined,
                  });
                }}
              >
                Abrir comanda
              </Button>
            </div>
          </AdminSurface>
        </div>

        <AdminSurface title="Mesas e comandas abertas" subtitle="Acompanhe ocupação do salão em tempo real">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {tables.map((table) => (
                <div key={table.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{table.name}</p>
                      <p className="text-xs text-muted-foreground">Capacidade {table.capacity} pessoas</p>
                    </div>
                    <Badge variant={table.status === "free" ? "secondary" : "default"}>{table.status}</Badge>
                  </div>
                </div>
              ))}
            </div>

            <AdminSectionLabel>Comandas</AdminSectionLabel>
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">Comanda #{session.id} · {session.tableName}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.customerName || "Sem nome"} · {session.guestCount} pessoa(s)
                      </p>
                    </div>
                    <Badge variant={session.status === "open" ? "default" : "secondary"}>{session.status}</Badge>
                  </div>
                  {session.notes ? <p className="text-xs text-muted-foreground">{session.notes}</p> : null}
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Itens lançados</p>
                      <p className="text-sm font-semibold">{session.itemCount ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Subtotal itens</p>
                      <p className="text-sm font-semibold">R$ {Number(session.itemsSubtotal ?? 0).toFixed(2).replace(".", ",")}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Pedidos vinculados</p>
                      <p className="text-sm font-semibold">{session.linkedOrderCount ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Total da comanda</p>
                      <p className="text-sm font-semibold">R$ {Number(session.computedTotal ?? session.total ?? 0).toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>

                  {session.status !== "closed" && session.status !== "cancelled" && (
                    <div className="rounded-xl border border-dashed p-3 space-y-3">
                      <p className="text-sm font-medium">Lançar consumo na mesa</p>
                      <div className="grid gap-3 lg:grid-cols-[1.5fr_0.6fr_1fr_auto]">
                        <div className="space-y-2">
                          <Label>Produto</Label>
                          <Select
                            value={getDraft(session.id).productId}
                            onValueChange={(value) => setDraftValue(session.id, { productId: value })}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                            <SelectContent>
                              {activeProducts.map((product) => (
                                <SelectItem key={product.id} value={String(product.id)}>
                                  {product.name} · R$ {Number(product.price).toFixed(2).replace(".", ",")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Qtd.</Label>
                          <Input
                            value={getDraft(session.id).quantity}
                            onChange={(e) => setDraftValue(session.id, { quantity: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Observação</Label>
                          <Input
                            value={getDraft(session.id).notes}
                            onChange={(e) => setDraftValue(session.id, { notes: e.target.value })}
                            placeholder="Sem cebola, meia porção..."
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            disabled={addItem.isPending || !getDraft(session.id).productId || !getDraft(session.id).quantity}
                            onClick={() =>
                              addItem.mutate({
                                tableSessionId: session.id,
                                productId: Number(getDraft(session.id).productId),
                                quantity: Number(getDraft(session.id).quantity || 1),
                                notes: getDraft(session.id).notes || undefined,
                              })
                            }
                          >
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Detalhamento do consumo</p>
                    {session.items.length === 0 && session.linkedOrders.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum consumo lançado nesta comanda ainda.</p>
                    ) : (
                      <>
                        {session.items.map((item: DiningSessionItem) => (
                          <div key={`item-${item.id}`} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{item.productName} · {item.quantity}x</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{new Date(item.requestedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                <span>Unitário R$ {Number(item.unitPrice).toFixed(2).replace(".", ",")}</span>
                                {item.notes ? <span>Obs: {item.notes}</span> : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-semibold">R$ {Number(item.lineTotal).toFixed(2).replace(".", ",")}</span>
                              {session.status !== "closed" && session.status !== "cancelled" && (
                                <Button size="icon" variant="ghost" onClick={() => removeItem.mutate({ id: item.id })}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {session.linkedOrders.map((order: DiningLinkedOrder) => (
                          <div key={`order-${order.orderId}`} className="rounded-lg border p-3 flex items-start justify-between gap-3 bg-muted/30">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">Pedido vinculado #{order.orderId}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                <span>{order.customerName || "Sem cliente"}</span>
                                <span>Status: {order.status}</span>
                              </div>
                            </div>
                            <span className="text-sm font-semibold shrink-0">R$ {Number(order.total).toFixed(2).replace(".", ",")}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {session.status !== "closed" && session.status !== "cancelled" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => closeSession.mutate({ id: session.id, status: "awaiting_closure" })}>
                        Marcar fechamento
                      </Button>
                      <Button size="sm" onClick={() => closeSession.mutate({ id: session.id, status: "closed" })}>
                        Fechar comanda
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {sessions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma comanda aberta agora.</p>}
            </div>
          </div>
        </AdminSurface>
      </div>
    </AdminPage>
  );
}
