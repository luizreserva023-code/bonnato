import { useMemo, useState } from "react";
import { Archive, BarChart3, ChevronDown, ChevronUp, ChevronsUpDown, Copy, FolderInput, ImageOff, MoreHorizontal, Pause, Pencil, Play, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AdminEmptyState, AdminPill, AdminSkeleton, AdminSurface } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CategoryRow = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  sortOrder: number;
};

type ProductRow = {
  id: number;
  categoryId: number;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  price: string;
  active: boolean;
  sortOrder: number;
  editorialStatus?: string | null;
};

function money(value: string | number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function MenuStructurePanel({
  storeId,
  categories,
  products,
  onCreateCategory,
  onCreateProduct,
  onEditCategory,
  onEditProduct,
  onViewProductPerformance,
}: {
  storeId: number;
  categories: CategoryRow[];
  products: ProductRow[];
  onCreateCategory: () => void;
  onCreateProduct: (categoryId: number) => void;
  onEditCategory: (category: CategoryRow) => void;
  onEditProduct: (product: ProductRow) => void;
  onViewProductPerformance: (productId: number) => void;
}) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  const summaries = trpc.catalog.adminProductSummaries.useQuery(
    { storeId },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );
  const groupCount = useMemo(
    () => new Map((summaries.data ?? []).map((item) => [item.productId, item.modifierGroupCount])),
    [summaries.data],
  );

  const batchUpdate = trpc.products.batchUpdate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.products.listAll.invalidate(),
        utils.products.list.invalidate(),
        utils.catalog.adminProductSummaries.invalidate(),
        utils.catalog.adminModifierGroups.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const duplicateProduct = trpc.catalog.duplicateProduct.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.products.listAll.invalidate(),
        utils.products.list.invalidate(),
        utils.catalog.adminProductSummaries.invalidate(),
        utils.catalog.adminModifierGroups.invalidate(),
      ]);
      toast.success(`${result.name} criada como rascunho.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderProducts = trpc.products.reorder.useMutation({
    onSuccess: async () => {
      await utils.products.listAll.invalidate();
      toast.success("Ordem dos produtos atualizada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderCategories = trpc.categories.reorder.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.categories.listAll.invalidate(), utils.categories.list.invalidate()]);
      toast.success("Ordem das categorias atualizada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateCategory = trpc.categories.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.categories.listAll.invalidate(), utils.categories.list.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orderedCategories
      .filter((category) => !categoryFilter || category.id === categoryFilter)
      .map((category) => ({
        category,
        products: products
          .filter((product) => product.categoryId === category.id)
          .filter((product) => !term || product.name.toLowerCase().includes(term) || (product.description ?? "").toLowerCase().includes(term))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")),
      }))
      .filter((group) => !term || group.products.length > 0 || group.category.name.toLowerCase().includes(term));
  }, [categoryFilter, orderedCategories, products, search]);

  const moveCategory = (categoryId: number, direction: -1 | 1) => {
    const index = orderedCategories.findIndex((category) => category.id === categoryId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedCategories.length) return;
    const ids = orderedCategories.map((category) => category.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderCategories.mutate({ storeId, orderedCategoryIds: ids });
  };

  const moveProduct = (categoryId: number, productId: number, direction: -1 | 1) => {
    const current = products
      .filter((product) => product.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));
    const index = current.findIndex((product) => product.id === productId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    const ids = current.map((product) => product.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderProducts.mutate({ storeId, categoryId, orderedProductIds: ids });
  };

  const allCollapsed = orderedCategories.length > 0 && orderedCategories.every((category) => collapsed.has(category.id));
  const toggleAll = () => {
    setCollapsed(allCollapsed ? new Set() : new Set(orderedCategories.map((category) => category.id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--admin-border)] bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-[minmax(260px,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-text-muted)]" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto ou categoria..." className="pl-9" />
          </div>
          <select
            value={categoryFilter ?? ""}
            onChange={(event) => setCategoryFilter(event.target.value ? Number(event.target.value) : undefined)}
            className="h-10 rounded-[10px] border border-[var(--admin-input-border)] bg-white px-3 text-sm"
          >
            <option value="">Todas as categorias</option>
            {orderedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={toggleAll} className="gap-2">
            <ChevronsUpDown className="h-4 w-4" />
            {allCollapsed ? "Expandir categorias" : "Recolher categorias"}
          </Button>
          <Button onClick={onCreateCategory} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar categoria
          </Button>
        </div>
      </div>

      {summaries.isLoading && <AdminSkeleton className="h-3 w-40" />}

      {filteredCategories.length === 0 ? (
        <AdminSurface>
          <AdminEmptyState title="Nada encontrado" description="Ajuste a busca ou o filtro de categoria." />
        </AdminSurface>
      ) : (
        filteredCategories.map(({ category, products: categoryProducts }, categoryIndex) => {
          const isCollapsed = collapsed.has(category.id);
          return (
            <AdminSurface
              key={category.id}
              flush
              className={!category.active ? "opacity-75" : undefined}
            >
              <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-[var(--admin-text-primary)]">{category.name}</h3>
                    <AdminPill tone="neutral">{categoryProducts.length} item{categoryProducts.length === 1 ? "" : "s"}</AdminPill>
                    <AdminPill tone={category.active ? "success" : "warning"}>{category.active ? "Ativa" : "Pausada"}</AdminPill>
                  </div>
                  {category.description && <p className="mt-1 line-clamp-1 text-xs text-[var(--admin-text-secondary)]">{category.description}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="ghost" aria-label="Mover categoria para cima" disabled={categoryIndex === 0 || reorderCategories.isPending} onClick={() => moveCategory(category.id, -1)}><ChevronUp className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Mover categoria para baixo" disabled={categoryIndex === orderedCategories.length - 1 || reorderCategories.isPending} onClick={() => moveCategory(category.id, 1)}><ChevronDown className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onCreateProduct(category.id)}>
                    <Plus className="h-3.5 w-3.5" /> Produto
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onEditCategory(category)}>Editar</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateCategory.mutate({ id: category.id, storeId, active: !category.active })}
                  >
                    {category.active ? "Pausar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(category.id)) next.delete(category.id); else next.add(category.id);
                    return next;
                  })}>{isCollapsed ? "Expandir" : "Recolher"}</Button>
                </div>
              </div>

              {!isCollapsed && (
                categoryProducts.length === 0 ? (
                  <AdminEmptyState title="Categoria sem produtos" description="Adicione ou mova produtos para esta categoria." />
                ) : (
                  <div className="divide-y divide-[var(--admin-border)]">
                    {categoryProducts.map((product, productIndex) => (
                      <div key={product.id} className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(280px,1.4fr)_150px_120px_120px_auto] md:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-[10px] object-cover" />
                          ) : (
                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-[var(--admin-surface-alt)] text-[var(--admin-text-muted)]"><ImageOff className="h-4 w-4" /></div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[var(--admin-text-primary)]">{product.name}</p>
                            <p className="mt-1 line-clamp-1 text-[11px] text-[var(--admin-text-muted)]">{product.shortDescription || product.description || "Sem descrição resumida"}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">Complementos</p>
                          <p className="mt-1 text-[13px] font-medium">{groupCount.get(product.id) ?? 0} grupo(s)</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">Preço</p>
                          <p className="mt-1 text-[13px] font-semibold">{money(product.price)}</p>
                        </div>
                        <div>
                          <AdminPill tone={product.active ? "success" : "warning"}>{product.active ? "Ativo" : "Pausado"}</AdminPill>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button size="sm" variant="ghost" aria-label="Mover produto para cima" disabled={productIndex === 0 || reorderProducts.isPending} onClick={() => moveProduct(category.id, product.id, -1)}><ChevronUp className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" aria-label="Mover produto para baixo" disabled={productIndex === categoryProducts.length - 1 || reorderProducts.isPending} onClick={() => moveProduct(category.id, product.id, 1)}><ChevronDown className="h-4 w-4" /></Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={batchUpdate.isPending}
                            onClick={() => batchUpdate.mutate({
                              storeId,
                              productIds: [product.id],
                              action: product.active ? "pause" : "activate",
                            })}
                          >
                            {product.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            {product.active ? "Pausar" : "Ativar"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" aria-label={`Mais ações para ${product.name}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-52">
                              <DropdownMenuItem onSelect={() => onEditProduct(product)}>
                                <Pencil className="h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => onViewProductPerformance(product.id)}>
                                <BarChart3 className="h-4 w-4" /> Ver desempenho
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={duplicateProduct.isPending}
                                onSelect={() => duplicateProduct.mutate({ storeId, productId: product.id })}
                              >
                                <Copy className="h-4 w-4" /> Duplicar como rascunho
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <FolderInput className="h-4 w-4" /> Mover para categoria
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="min-w-52">
                                  {orderedCategories
                                    .filter((target) => target.id !== product.categoryId && target.active)
                                    .map((target) => (
                                      <DropdownMenuItem
                                        key={target.id}
                                        onSelect={() => batchUpdate.mutate({
                                          storeId,
                                          productIds: [product.id],
                                          action: "move_category",
                                          categoryId: target.id,
                                        })}
                                      >
                                        {target.name}
                                      </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  if (!window.confirm(`Arquivar "${product.name}"? O histórico dos pedidos será preservado.`)) return;
                                  batchUpdate.mutate({ storeId, productIds: [product.id], action: "archive" });
                                }}
                              >
                                <Archive className="h-4 w-4" /> Arquivar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </AdminSurface>
          );
        })
      )}
    </div>
  );
}
