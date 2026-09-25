import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  Archive,
  CheckCircle2,
  ImageOff,
  Layers3,
  Package,
  PauseCircle,
  Pencil,
  PlayCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import type { AppRouter } from "../../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { AdminDataTableShell, AdminEmptyState, AdminPill, AdminSurface } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Product = RouterOutputs["products"]["listAll"][number];

type Props = {
  storeId: number;
  onEdit: (product: Product) => void;
  onCreate: () => void;
};

type StockFilter = "all" | "controlled" | "out" | "unlimited";
type ImageFilter = "all" | "with" | "without";
type ComplementFilter = "all" | "with" | "without";
type StatusFilter = "all" | "active" | "paused" | "draft" | "archived";

const PAGE_SIZE = 20;

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  simple: "Produto simples",
  sizes: "Com tamanhos",
  variants: "Variantes",
  buildable: "Personalizável",
  multi_flavor: "Multi-sabor",
  combo: "Combo",
  weight: "Por peso",
  quantity: "Por quantidade",
  variable_price: "Preço variável",
};

export function ProductsManagementTab({ storeId, onEdit, onCreate }: Props) {
  const utils = trpc.useUtils();
  const productsQuery = trpc.products.listAll.useQuery({ storeId });
  const categoriesQuery = trpc.categories.listAll.useQuery({ storeId });
  const summariesQuery = trpc.catalog.adminProductSummaries.useQuery({ storeId });
  const availabilityQuery = trpc.catalog.adminProductAvailability.useQuery({ storeId });

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [image, setImage] = useState<ImageFilter>("all");
  const [complements, setComplements] = useState<ComplementFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [moveCategoryId, setMoveCategoryId] = useState("");
  const [page, setPage] = useState(1);

  const batchUpdate = trpc.products.batchUpdate.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.products.listAll.invalidate(),
        utils.products.list.invalidate(),
        utils.catalog.adminProductSummaries.invalidate(),
        utils.analytics.menu.invalidate(),
      ]);
      setSelected(new Set());
      toast.success(`${result.count} produto(s) atualizado(s).`);
    },
    onError: (error) => toast.error(error.message),
  });

  const categoryMap = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((category) => [category.id, category.name])),
    [categoriesQuery.data],
  );
  const complementCountMap = useMemo(
    () => new Map((summariesQuery.data ?? []).map((row) => [row.productId, row.modifierGroupCount])),
    [summariesQuery.data],
  );
  const availabilityMap = useMemo(() => {
    const map = new Map<number, NonNullable<typeof availabilityQuery.data>>();
    for (const rule of availabilityQuery.data ?? []) {
      const current = map.get(rule.productId) ?? [];
      current.push(rule);
      map.set(rule.productId, current);
    }
    return map;
  }, [availabilityQuery.data]);

  const stockState = (productId: number) => {
    const rules = availabilityMap.get(productId) ?? [];
    const controlled = rules.filter((rule) => rule.stockLimit != null);
    if (!controlled.length) return "unlimited" as const;
    return controlled.some((rule) => Number(rule.stockLimit) > 0) ? "controlled" as const : "out" as const;
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-BR");
    return (productsQuery.data ?? []).filter((product) => {
      const categoryName = categoryMap.get(product.categoryId) ?? "";
      if (needle) {
        const haystack = [product.name, product.sku ?? "", categoryName].join(" ").toLocaleLowerCase("pt-BR");
        if (!haystack.includes(needle)) return false;
      }
      if (categoryId !== "all" && product.categoryId !== Number(categoryId)) return false;
      if (type !== "all" && product.productType !== type) return false;
      if (status === "active" && (!product.active || product.editorialStatus === "archived")) return false;
      if (status === "paused" && (product.active || product.editorialStatus === "archived")) return false;
      if (status === "draft" && product.editorialStatus !== "draft") return false;
      if (status === "archived" && product.editorialStatus !== "archived") return false;
      if (image === "with" && !product.imageUrl) return false;
      if (image === "without" && product.imageUrl) return false;
      const groupCount = complementCountMap.get(product.id) ?? 0;
      if (complements === "with" && groupCount === 0) return false;
      if (complements === "without" && groupCount > 0) return false;
      const currentStock = stockState(product.id);
      if (stock !== "all" && currentStock !== stock) return false;
      return true;
    });
  }, [productsQuery.data, categoryMap, search, categoryId, type, status, image, complements, stock, complementCountMap, availabilityMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const visibleIds = visible.map((product) => product.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleAllVisible = (checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of visibleIds) checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const runBatch = (action: "activate" | "pause" | "archive" | "move_category") => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === "archive" && !window.confirm(`Arquivar ${ids.length} produto(s)? O histórico de pedidos será preservado.`)) return;
    if (action === "move_category" && !moveCategoryId) {
      toast.error("Escolha a categoria de destino.");
      return;
    }
    batchUpdate.mutate({
      storeId,
      productIds: ids,
      action,
      categoryId: action === "move_category" ? Number(moveCategoryId) : undefined,
    });
  };

  const statusPill = (product: Product) => {
    if (product.editorialStatus === "archived") return <AdminPill tone="neutral">Arquivado</AdminPill>;
    if (product.editorialStatus === "draft") return <AdminPill tone="info">Rascunho</AdminPill>;
    if (!product.active) return <AdminPill tone="warning">Pausado</AdminPill>;
    if (stockState(product.id) === "out") return <AdminPill tone="danger">Sem estoque</AdminPill>;
    return <AdminPill tone="success">Ativo</AdminPill>;
  };

  return (
    <div className="space-y-5">
      <AdminSurface
        title="Produtos"
        subtitle="Visão administrativa dos produtos desta unidade, com filtros e ações em massa."
        actions={<Button onClick={onCreate}>Novo produto</Button>}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,.45fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--admin-text-muted)]" />
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Buscar nome, SKU ou categoria..."
              className="pl-9"
            />
          </div>
          <Select value={categoryId} onValueChange={(value) => { setCategoryId(value); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {(categoriesQuery.data ?? []).map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="paused">Pausados</SelectItem>
              <SelectItem value="draft">Rascunhos</SelectItem>
              <SelectItem value="archived">Arquivados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(value) => { setType(value); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Array.from(new Set((productsQuery.data ?? []).map((product) => product.productType))).sort().map((value) => (
                <SelectItem key={value} value={value}>{PRODUCT_TYPE_LABELS[value] ?? value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <details className="mt-3 rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface-alt)] p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[var(--admin-text-secondary)]">
            <SlidersHorizontal className="h-4 w-4" /> Filtros avançados
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Select value={image} onValueChange={(value) => { setImage(value as ImageFilter); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Com ou sem imagem</SelectItem>
                <SelectItem value="with">Com imagem</SelectItem>
                <SelectItem value="without">Sem imagem</SelectItem>
              </SelectContent>
            </Select>
            <Select value={complements} onValueChange={(value) => { setComplements(value as ComplementFilter); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Com ou sem complementos</SelectItem>
                <SelectItem value="with">Com complementos</SelectItem>
                <SelectItem value="without">Sem complementos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stock} onValueChange={(value) => { setStock(value as StockFilter); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer estoque</SelectItem>
                <SelectItem value="controlled">Com estoque controlado</SelectItem>
                <SelectItem value="out">Sem estoque</SelectItem>
                <SelectItem value="unlimited">Sem controle de estoque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </details>
      </AdminSurface>

      {selected.size > 0 && (
        <div className="sticky top-3 z-20 flex flex-wrap items-center gap-2 rounded-[14px] border border-[var(--admin-brand-100)] bg-white p-3 shadow-[var(--admin-shadow-md)]">
          <span className="mr-2 text-sm font-semibold text-[var(--admin-text-primary)]">{selected.size} selecionado(s)</span>
          <Button size="sm" variant="outline" onClick={() => runBatch("activate")} disabled={batchUpdate.isPending}><PlayCircle className="mr-1.5 h-4 w-4" />Ativar</Button>
          <Button size="sm" variant="outline" onClick={() => runBatch("pause")} disabled={batchUpdate.isPending}><PauseCircle className="mr-1.5 h-4 w-4" />Pausar</Button>
          <div className="flex min-w-[260px] flex-1 gap-2">
            <Select value={moveCategoryId} onValueChange={setMoveCategoryId}>
              <SelectTrigger className="min-w-[180px]"><SelectValue placeholder="Mover para categoria..." /></SelectTrigger>
              <SelectContent>
                {(categoriesQuery.data ?? []).map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => runBatch("move_category")} disabled={batchUpdate.isPending || !moveCategoryId}>Mover</Button>
          </div>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => runBatch("archive")} disabled={batchUpdate.isPending}><Archive className="mr-1.5 h-4 w-4" />Arquivar</Button>
        </div>
      )}

      {productsQuery.isLoading ? (
        <AdminSurface><div className="py-10 text-center text-sm text-[var(--admin-text-secondary)]">Carregando produtos...</div></AdminSurface>
      ) : filtered.length === 0 ? (
        <AdminSurface>
          <AdminEmptyState
            icon={<Package className="h-8 w-8" />}
            title="Nenhum produto encontrado"
            description="Ajuste a busca ou os filtros para encontrar produtos desta unidade."
          />
        </AdminSurface>
      ) : (
        <AdminDataTableShell>
          <table className="admin-data-table min-w-[980px]">
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={(value) => toggleAllVisible(value === true)} aria-label="Selecionar produtos visíveis" />
                </th>
                <th>Produto</th>
                <th>Classificação</th>
                <th>Disponível em</th>
                <th>Complementos</th>
                <th>Estoque</th>
                <th className="text-right">Preço</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const groupCount = complementCountMap.get(product.id) ?? 0;
                const currentStock = stockState(product.id);
                return (
                  <tr key={product.id}>
                    <td>
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={(value) => setSelected((current) => {
                          const next = new Set(current);
                          value === true ? next.add(product.id) : next.delete(product.id);
                          return next;
                        })}
                        aria-label={`Selecionar ${product.name}`}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="h-11 w-11 rounded-[10px] object-cover" />
                        ) : (
                          <div className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--admin-surface-alt)] text-[var(--admin-text-muted)]"><ImageOff className="h-4 w-4" /></div>
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[280px] truncate font-semibold">{product.name}</p>
                          <p className="mt-0.5 max-w-[280px] truncate text-[11px] text-[var(--admin-text-muted)]">{product.sku || "Sem SKU"}</p>
                        </div>
                      </div>
                    </td>
                    <td>{PRODUCT_TYPE_LABELS[product.productType] ?? product.productType}</td>
                    <td>{categoryMap.get(product.categoryId) ?? "Sem categoria"}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--admin-text-secondary)]"><Layers3 className="h-3.5 w-3.5" />{groupCount}</span>
                    </td>
                    <td>
                      {currentStock === "out" ? <AdminPill tone="danger">Sem estoque</AdminPill>
                        : currentStock === "controlled" ? <AdminPill tone="success">Controlado</AdminPill>
                        : <AdminPill tone="neutral">Sem limite</AdminPill>}
                    </td>
                    <td className="text-right font-semibold">{Number(product.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td>{statusPill(product)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(product)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => batchUpdate.mutate({
                            storeId,
                            productIds: [product.id],
                            action: product.active ? "pause" : "activate",
                          })}
                        >
                          {product.active ? <PauseCircle className="mr-1 h-3.5 w-3.5" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                          {product.active ? "Pausar" : "Ativar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminDataTableShell>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-4 text-xs text-[var(--admin-text-secondary)]">
          <span>{filtered.length.toLocaleString("pt-BR")} produto(s) encontrados</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
            <span>Página {safePage} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
