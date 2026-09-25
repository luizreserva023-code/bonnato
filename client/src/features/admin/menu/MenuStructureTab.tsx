import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { AppRouter } from "../../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { AdminEmptyState, AdminPill, AdminSurface } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Product = RouterOutputs["products"]["listAll"][number];
type Category = RouterOutputs["categories"]["listAll"][number];

type Props = {
  storeId: number;
  onEditProduct: (product: Product) => void;
  onCreateProduct: (categoryId?: number) => void;
};

const slugify = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export function MenuStructureTab({ storeId, onEditProduct, onCreateProduct }: Props) {
  const utils = trpc.useUtils();
  const categoriesQuery = trpc.categories.listAll.useQuery({ storeId });
  const productsQuery = trpc.products.listAll.useQuery({ storeId });
  const summariesQuery = trpc.catalog.adminProductSummaries.useQuery({ storeId });

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", description: "", imageUrl: "" });
  const [moveDialogCategory, setMoveDialogCategory] = useState<Category | null>(null);
  const [existingProductIds, setExistingProductIds] = useState<number[]>([]);

  const refresh = async () => {
    await Promise.all([
      utils.categories.listAll.invalidate(),
      utils.categories.list.invalidate(),
      utils.products.listAll.invalidate(),
      utils.products.list.invalidate(),
      utils.catalog.adminProductSummaries.invalidate(),
    ]);
  };

  const createCategory = trpc.categories.create.useMutation({
    onSuccess: async () => {
      await refresh();
      setCategoryDialog(false);
      toast.success("Categoria criada.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateCategory = trpc.categories.update.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const deleteCategory = trpc.categories.delete.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Categoria removida.");
    },
    onError: (error) => toast.error(error.message),
  });
  const reorderCategories = trpc.categories.reorder.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const updateProduct = trpc.products.update.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const batchUpdate = trpc.products.batchUpdate.useMutation({
    onSuccess: async (result) => {
      await refresh();
      setMoveDialogCategory(null);
      setExistingProductIds([]);
      toast.success(`${result.count} produto(s) movido(s).`);
    },
    onError: (error) => toast.error(error.message),
  });
  const reorderProducts = trpc.products.reorder.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });

  const complementMap = useMemo(
    () => new Map((summariesQuery.data ?? []).map((row) => [row.productId, row.modifierGroupCount])),
    [summariesQuery.data],
  );

  const categories = useMemo(
    () => [...(categoriesQuery.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "pt-BR")),
    [categoriesQuery.data],
  );

  const productsByCategory = useMemo(() => {
    const map = new Map<number, Product[]>();
    for (const product of productsQuery.data ?? []) {
      const current = map.get(product.categoryId) ?? [];
      current.push(product);
      map.set(product.categoryId, current);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "pt-BR"));
    }
    return map;
  }, [productsQuery.data]);

  const visibleCategories = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-BR");
    return categories.filter((category) => {
      if (filterCategory !== "all" && category.id !== Number(filterCategory)) return false;
      if (!needle) return true;
      const productMatch = (productsByCategory.get(category.id) ?? []).some((product) =>
        [product.name, product.shortDescription ?? "", product.description ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(needle),
      );
      return category.name.toLocaleLowerCase("pt-BR").includes(needle) || productMatch;
    });
  }, [categories, filterCategory, productsByCategory, search]);

  const openCategoryCreate = () => {
    setEditingCategory(null);
    setCategoryDraft({ name: "", description: "", imageUrl: "" });
    setCategoryDialog(true);
  };

  const openCategoryEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryDraft({
      name: category.name,
      description: category.description ?? "",
      imageUrl: category.imageUrl ?? "",
    });
    setCategoryDialog(true);
  };

  const saveCategory = () => {
    if (!categoryDraft.name.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    if (editingCategory) {
      updateCategory.mutate({
        id: editingCategory.id,
        storeId,
        name: categoryDraft.name.trim(),
        description: categoryDraft.description.trim() || undefined,
        imageUrl: categoryDraft.imageUrl.trim() || undefined,
      });
      setCategoryDialog(false);
      return;
    }
    createCategory.mutate({
      storeId,
      name: categoryDraft.name.trim(),
      slug: slugify(categoryDraft.name),
      description: categoryDraft.description.trim() || undefined,
      imageUrl: categoryDraft.imageUrl.trim() || undefined,
      sortOrder: categories.length,
    });
  };

  const moveCategory = (categoryId: number, direction: -1 | 1) => {
    const index = categories.findIndex((category) => category.id === categoryId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const ordered = categories.map((category) => category.id);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    reorderCategories.mutate({ storeId, orderedCategoryIds: ordered });
  };

  const moveProduct = (categoryId: number, productId: number, direction: -1 | 1) => {
    const rows = productsByCategory.get(categoryId) ?? [];
    const index = rows.findIndex((product) => product.id === productId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const ordered = rows.map((product) => product.id);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    reorderProducts.mutate({ storeId, categoryId, orderedProductIds: ordered });
  };

  return (
    <div className="space-y-5">
      <AdminSurface
        title="Cardápio"
        subtitle="Estruture categorias e organize os produtos exibidos para os clientes desta unidade."
        actions={<Button onClick={openCategoryCreate}><Plus className="mr-1.5 h-4 w-4" />Criar categoria</Button>}
      >
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--admin-text-muted)]" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto ou categoria..." className="pl-9" />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="lg:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setCollapsed(new Set())}><ChevronsUpDown className="mr-1.5 h-4 w-4" />Expandir</Button>
          <Button variant="outline" onClick={() => setCollapsed(new Set(categories.map((category) => category.id)))}><ChevronsDownUp className="mr-1.5 h-4 w-4" />Recolher</Button>
        </div>
      </AdminSurface>

      {categoriesQuery.isLoading || productsQuery.isLoading ? (
        <AdminSurface><div className="py-12 text-center text-sm text-[var(--admin-text-secondary)]">Carregando cardápio...</div></AdminSurface>
      ) : visibleCategories.length === 0 ? (
        <AdminSurface>
          <AdminEmptyState title="Nenhuma categoria encontrada" description="Crie uma categoria ou ajuste os filtros para continuar." action={<Button onClick={openCategoryCreate}>Criar categoria</Button>} />
        </AdminSurface>
      ) : (
        <div className="space-y-4">
          {visibleCategories.map((category) => {
            const categoryProducts = (productsByCategory.get(category.id) ?? []).filter((product) => {
              const needle = search.trim().toLocaleLowerCase("pt-BR");
              if (!needle || category.name.toLocaleLowerCase("pt-BR").includes(needle)) return true;
              return [product.name, product.shortDescription ?? "", product.description ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(needle);
            });
            const isCollapsed = collapsed.has(category.id);

            return (
              <AdminSurface key={category.id} flush className="overflow-hidden">
                <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-[var(--admin-text-primary)]">{category.name}</h3>
                      <AdminPill tone={category.active ? "success" : "warning"}>{category.active ? "Ativa" : "Pausada"}</AdminPill>
                      <span className="text-xs text-[var(--admin-text-muted)]">{(productsByCategory.get(category.id) ?? []).length} item(ns)</span>
                    </div>
                    {category.description && <p className="mt-1 truncate text-xs text-[var(--admin-text-secondary)]">{category.description}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => onCreateProduct(category.id)}><Plus className="mr-1 h-3.5 w-3.5" />Produto</Button>
                    <Button size="sm" variant="outline" onClick={() => { setMoveDialogCategory(category); setExistingProductIds([]); }}>Adicionar existente</Button>
                    <Button size="icon" variant="ghost" onClick={() => moveCategory(category.id, -1)} disabled={categories[0]?.id === category.id} aria-label="Mover categoria para cima"><ChevronUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => moveCategory(category.id, 1)} disabled={categories[categories.length - 1]?.id === category.id} aria-label="Mover categoria para baixo"><ChevronDown className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => openCategoryEdit(category)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateCategory.mutate({ id: category.id, storeId, active: !category.active })}>{category.active ? "Pausar" : "Ativar"}</Button>
                    <Button size="icon" variant="ghost" onClick={() => setCollapsed((current) => {
                      const next = new Set(current);
                      next.has(category.id) ? next.delete(category.id) : next.add(category.id);
                      return next;
                    })} aria-label={isCollapsed ? "Expandir categoria" : "Recolher categoria"}>
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="border-t border-[var(--admin-border)]">
                    {categoryProducts.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[var(--admin-text-secondary)]">Nenhum produto nesta categoria.</div>
                    ) : (
                      <div className="divide-y divide-[var(--admin-border)]">
                        {categoryProducts.map((product, index) => (
                          <div key={product.id} className="grid items-center gap-3 px-5 py-3 md:grid-cols-[minmax(260px,1fr)_140px_110px_120px_auto]">
                            <div className="flex min-w-0 items-center gap-3">
                              {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-11 w-11 rounded-[9px] object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-[9px] bg-[var(--admin-surface-alt)]"><ImageOff className="h-4 w-4 text-[var(--admin-text-muted)]" /></div>}
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold">{product.name}</p>
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--admin-text-muted)]">{product.shortDescription || product.description || "Sem descrição"}</p>
                              </div>
                            </div>
                            <span className="text-xs text-[var(--admin-text-secondary)]">{complementMap.get(product.id) ?? 0} grupo(s)</span>
                            <span className="text-xs font-semibold">{Number(product.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                            <AdminPill tone={product.active ? "success" : "warning"}>{product.active ? "Ativo" : "Pausado"}</AdminPill>
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => moveProduct(category.id, product.id, -1)} disabled={index === 0} aria-label="Mover produto para cima"><ChevronUp className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => moveProduct(category.id, product.id, 1)} disabled={index === categoryProducts.length - 1} aria-label="Mover produto para baixo"><ChevronDown className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => onEditProduct(product)}>Editar</Button>
                              <Button size="sm" variant="ghost" onClick={() => updateProduct.mutate({ id: product.id, storeId, active: !product.active })}>{product.active ? "Pausar" : "Ativar"}</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </AdminSurface>
            );
          })}
        </div>
      )}

      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCategory ? "Editar categoria" : "Criar categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={categoryDraft.description} onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })} /></div>
            <div className="space-y-2"><Label>URL da imagem</Label><Input value={categoryDraft.imageUrl} onChange={(event) => setCategoryDraft({ ...categoryDraft, imageUrl: event.target.value })} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            {editingCategory && (
              <Button
                variant="outline"
                className="mr-auto text-destructive"
                onClick={() => {
                  if (!window.confirm(`Remover a categoria "${editingCategory.name}"? O backend impedirá a operação quando ela não for permitida.`)) return;
                  deleteCategory.mutate({ id: editingCategory.id, storeId });
                  setCategoryDialog(false);
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />Remover
              </Button>
            )}
            <Button variant="outline" onClick={() => setCategoryDialog(false)}>Cancelar</Button>
            <Button onClick={saveCategory}>{editingCategory ? "Salvar" : "Criar categoria"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(moveDialogCategory)} onOpenChange={(open) => !open && setMoveDialogCategory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Adicionar produto existente em {moveDialogCategory?.name}</DialogTitle></DialogHeader>
          <p className="text-xs text-[var(--admin-text-secondary)]">Os produtos selecionados serão movidos de sua categoria atual para esta categoria. Nenhum produto será duplicado.</p>
          <div className="max-h-[420px] overflow-y-auto rounded-[12px] border border-[var(--admin-border)]">
            {(productsQuery.data ?? []).filter((product) => product.categoryId !== moveDialogCategory?.id).map((product) => (
              <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b border-[var(--admin-border)] px-3 py-2.5 last:border-0 hover:bg-[var(--admin-surface-alt)]">
                <input
                  type="checkbox"
                  checked={existingProductIds.includes(product.id)}
                  onChange={(event) => setExistingProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{product.name}</span>
                <span className="text-xs text-[var(--admin-text-muted)]">{categories.find((category) => category.id === product.categoryId)?.name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogCategory(null)}>Cancelar</Button>
            <Button
              disabled={!existingProductIds.length || !moveDialogCategory}
              onClick={() => moveDialogCategory && batchUpdate.mutate({
                storeId,
                productIds: existingProductIds,
                action: "move_category",
                categoryId: moveDialogCategory.id,
              })}
            >
              Mover {existingProductIds.length || ""} produto(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
