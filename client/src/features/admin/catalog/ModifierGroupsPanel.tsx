import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ChevronDown,
  ChevronUp,
  Layers3,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type LogicalGroup = RouterOutputs["catalog"]["adminModifierGroups"][number];

type DraftOption = {
  key: string;
  name: string;
  description: string;
  price: string;
  maxQuantity: number;
  active: boolean;
};

type GroupDraft = {
  name: string;
  description: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  freeSelections: number;
  allowRepeatedOptions: boolean;
  active: boolean;
  options: DraftOption[];
  productIds: number[];
};

const createKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const emptyDraft = (): GroupDraft => ({
  name: "",
  description: "",
  required: false,
  minSelections: 0,
  maxSelections: 1,
  freeSelections: 0,
  allowRepeatedOptions: false,
  active: true,
  options: [{ key: createKey(), name: "", description: "", price: "0.00", maxQuantity: 1, active: true }],
  productIds: [],
});

function toDraft(group: LogicalGroup): GroupDraft {
  return {
    name: group.name,
    description: group.description ?? "",
    required: group.required,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
    freeSelections: group.freeSelections,
    allowRepeatedOptions: group.allowRepeatedOptions,
    active: group.active,
    options: group.options.map((option) => ({
      key: String(option.id),
      name: option.name,
      description: option.description ?? "",
      price: Number(option.price).toFixed(2),
      maxQuantity: option.maxQuantity,
      active: option.active,
    })),
    productIds: [...group.productIds],
  };
}

export function ModifierGroupsPanel({
  storeId,
  onEditProduct,
}: {
  storeId: number;
  onEditProduct: (productId: number) => void;
}) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editing, setEditing] = useState<LogicalGroup | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [draft, setDraft] = useState<GroupDraft>(emptyDraft());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groupsQuery = trpc.catalog.adminModifierGroups.useQuery({ storeId, search: debouncedSearch || undefined });
  const productsQuery = trpc.products.listAll.useQuery({ storeId });

  const refresh = async () => {
    await Promise.all([
      utils.catalog.adminModifierGroups.invalidate(),
      utils.catalog.adminProductSummaries.invalidate(),
      utils.products.listAll.invalidate(),
    ]);
  };

  const createGroup = trpc.catalog.createLogicalModifierGroup.useMutation({
    onSuccess: async (result) => {
      await refresh();
      setDialogOpen(false);
      toast.success(`Grupo criado em ${result.created} produto(s).`);
    },
    onError: (error) => toast.error(error.message),
  });
  const updateGroup = trpc.catalog.updateLogicalModifierGroup.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const setActive = trpc.catalog.setLogicalModifierGroupActive.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const attachGroup = trpc.catalog.attachLogicalModifierGroup.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const removeLinks = trpc.catalog.removeModifierGroupLinks.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const busy = createGroup.isPending || updateGroup.isPending || attachGroup.isPending || removeLinks.isPending;

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setDialogOpen(true);
  };

  const openEdit = (group: LogicalGroup) => {
    setEditing(group);
    setDraft(toDraft(group));
    setDialogOpen(true);
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.options.length) return current;
      const options = [...current.options];
      [options[index], options[target]] = [options[target], options[index]];
      return { ...current, options };
    });
  };

  const validateDraft = () => {
    if (draft.name.trim().length < 1) return "Informe o nome do grupo.";
    if (!draft.productIds.length) return "Vincule o grupo a pelo menos um produto.";
    if (draft.minSelections > draft.maxSelections) return "A quantidade mínima não pode ser maior que a máxima.";
    if (draft.freeSelections > draft.maxSelections) return "A quantidade gratuita não pode ser maior que a máxima.";
    if (draft.required && draft.minSelections < 1) return "Grupo obrigatório precisa exigir pelo menos uma seleção.";
    if (!draft.options.length || draft.options.some((option) => !option.name.trim())) return "Todas as opções precisam de nome.";
    if (draft.options.some((option) => Number(option.price) < 0 || Number.isNaN(Number(option.price)))) return "O preço das opções precisa ser zero ou positivo.";
    return null;
  };

  const payloadGroup = () => ({
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    required: draft.required,
    minSelections: draft.required ? Math.max(1, draft.minSelections) : draft.minSelections,
    maxSelections: draft.maxSelections,
    freeSelections: draft.freeSelections,
    allowRepeatedOptions: draft.allowRepeatedOptions,
    active: draft.active,
    options: draft.options.map((option) => ({
      name: option.name.trim(),
      description: option.description.trim() || null,
      price: Number(option.price || 0).toFixed(2),
      maxQuantity: option.maxQuantity,
      active: option.active,
    })),
  });

  const save = async () => {
    const validation = validateDraft();
    if (validation) {
      toast.error(validation);
      return;
    }

    if (!editing) {
      await createGroup.mutateAsync({ storeId, targetProductIds: draft.productIds, group: payloadGroup() });
      return;
    }

    try {
      await updateGroup.mutateAsync({ storeId, groupIds: editing.groupIds, group: payloadGroup() });

      const previous = new Set(editing.productIds);
      const next = new Set(draft.productIds);
      const added = draft.productIds.filter((id) => !previous.has(id));
      const removedProducts = editing.products.filter((product) => !next.has(product.id));
      const removedGroupIds = removedProducts.map((product) => product.groupId);

      if (added.length > 0) {
        await attachGroup.mutateAsync({
          storeId,
          sourceGroupId: editing.groupIds[0],
          targetProductIds: added,
        });
      }
      if (removedGroupIds.length > 0) {
        await removeLinks.mutateAsync({ storeId, groupIds: removedGroupIds });
      }

      await refresh();
      setDialogOpen(false);
      toast.success("Grupo de complementos atualizado.");
    } catch {
      // mutations already display the error
    }
  };

  const productMap = useMemo(
    () => new Map((productsQuery.data ?? []).map((product) => [product.id, product])),
    [productsQuery.data],
  );

  return (
    <div className="space-y-5">
      <AdminSurface
        title="Grupos de complementos"
        subtitle="Configure tamanhos, adicionais, escolhas e personalizações e reutilize grupos entre produtos."
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Novo grupo</Button>}
      >
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--admin-text-muted)]" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar grupos de complementos..." className="pl-9" />
        </div>
      </AdminSurface>

      {groupsQuery.isLoading ? (
        <AdminSurface><div className="py-10 text-center text-sm text-[var(--admin-text-secondary)]">Carregando grupos...</div></AdminSurface>
      ) : !(groupsQuery.data?.length) ? (
        <AdminSurface>
          <AdminEmptyState
            icon={<Layers3 className="h-8 w-8" />}
            title="Nenhum grupo de complementos"
            description="Crie um grupo e vincule-o aos produtos que compartilham as mesmas escolhas."
            action={<Button onClick={openCreate}>Criar primeiro grupo</Button>}
          />
        </AdminSurface>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {groupsQuery.data.map((group) => {
            const isExpanded = expanded.has(group.key);
            return (
              <AdminSurface key={group.key} className="overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--admin-brand-50)] text-[var(--admin-brand-800)]">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[var(--admin-text-primary)]">{group.name}</h3>
                      <AdminPill tone={group.active ? "success" : "warning"}>{group.active ? "Ativo" : "Pausado"}</AdminPill>
                      {group.required && <AdminPill tone="brand">Obrigatório</AdminPill>}
                    </div>
                    <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
                      {group.productCount} produto(s) • {group.optionCount} opção(ões) • mín. {group.minSelections} / máx. {group.maxSelections}
                    </p>
                    {group.description && <p className="mt-2 text-xs leading-5 text-[var(--admin-text-secondary)]">{group.description}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(group)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                </div>

                <div className="mt-4 rounded-[12px] bg-[var(--admin-surface-alt)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">Disponível em</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--admin-text-secondary)]">
                    {group.products.slice(0, 4).map((product) => product.name).join(", ")}
                    {group.productCount > 4 ? ` +${group.productCount - 4}` : ""}
                  </p>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t border-[var(--admin-border)] pt-4">
                    {group.options.map((option) => (
                      <div key={option.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--admin-border)] px-3 py-2.5">
                        <div>
                          <p className="text-[13px] font-medium text-[var(--admin-text-primary)]">{option.name}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--admin-text-muted)]">Máx. {option.maxQuantity} por pedido</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!option.active && <AdminPill tone="neutral">Pausada</AdminPill>}
                          <span className="text-xs font-semibold text-[var(--admin-text-primary)]">+ {Number(option.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--admin-border)] pt-4">
                  <Button size="sm" variant="ghost" onClick={() => setExpanded((current) => {
                    const next = new Set(current);
                    next.has(group.key) ? next.delete(group.key) : next.add(group.key);
                    return next;
                  })}>
                    {isExpanded ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
                    {isExpanded ? "Recolher opções" : "Ver opções"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActive.mutate({ storeId, groupIds: group.groupIds, active: !group.active })}
                    disabled={setActive.isPending}
                  >
                    {group.active ? "Pausar grupo" : "Ativar grupo"}
                  </Button>
                </div>
              </AdminSurface>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!busy) setDialogOpen(open); }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar grupo de complementos" : "Novo grupo de complementos"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Escolha seus adicionais" />
            </div>
            <div className="space-y-2">
              <Label>Descrição opcional</Label>
              <Input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Orientação exibida para o cliente" />
            </div>
            <label className="flex items-center gap-3 rounded-[12px] border border-[var(--admin-border)] p-3">
              <Switch checked={draft.required} onCheckedChange={(checked) => setDraft((current) => ({ ...current, required: checked, minSelections: checked ? Math.max(1, current.minSelections) : current.minSelections }))} />
              <span className="text-sm font-medium">Seleção obrigatória</span>
            </label>
            <label className="flex items-center gap-3 rounded-[12px] border border-[var(--admin-border)] p-3">
              <Switch checked={draft.allowRepeatedOptions} onCheckedChange={(checked) => setDraft({ ...draft, allowRepeatedOptions: checked })} />
              <span className="text-sm font-medium">Permitir repetir item</span>
            </label>
            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <div className="space-y-2"><Label>Mínimo</Label><Input type="number" min={0} max={50} value={draft.minSelections} onChange={(event) => setDraft({ ...draft, minSelections: Number(event.target.value) })} /></div>
              <div className="space-y-2"><Label>Máximo</Label><Input type="number" min={1} max={50} value={draft.maxSelections} onChange={(event) => setDraft({ ...draft, maxSelections: Number(event.target.value) })} /></div>
              <div className="space-y-2"><Label>Gratuitos</Label><Input type="number" min={0} max={50} value={draft.freeSelections} onChange={(event) => setDraft({ ...draft, freeSelections: Number(event.target.value) })} /></div>
            </div>
          </div>

          <div className="border-t border-[var(--admin-border)] pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Opções</h4>
                <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">Preço adicional, ordem e limite por opção.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDraft((current) => ({
                ...current,
                options: [...current.options, { key: createKey(), name: "", description: "", price: "0.00", maxQuantity: 1, active: true }],
              }))}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar opção</Button>
            </div>

            <div className="space-y-2">
              {draft.options.map((option, index) => (
                <div key={option.key} className="grid gap-2 rounded-[12px] border border-[var(--admin-border)] p-3 md:grid-cols-[1fr_130px_110px_auto]">
                  <div className="space-y-2">
                    <Input value={option.name} onChange={(event) => setDraft((current) => ({
                      ...current,
                      options: current.options.map((item, currentIndex) => currentIndex === index ? { ...item, name: event.target.value } : item),
                    }))} placeholder="Nome da opção" />
                    <Input value={option.description} onChange={(event) => setDraft((current) => ({
                      ...current,
                      options: current.options.map((item, currentIndex) => currentIndex === index ? { ...item, description: event.target.value } : item),
                    }))} placeholder="Descrição opcional" />
                  </div>
                  <div><Label className="mb-1 block text-xs">Preço adicional</Label><Input type="number" min={0} step="0.01" value={option.price} onChange={(event) => setDraft((current) => ({
                    ...current,
                    options: current.options.map((item, currentIndex) => currentIndex === index ? { ...item, price: event.target.value } : item),
                  }))} /></div>
                  <div><Label className="mb-1 block text-xs">Máx. quantidade</Label><Input type="number" min={1} max={99} value={option.maxQuantity} onChange={(event) => setDraft((current) => ({
                    ...current,
                    options: current.options.map((item, currentIndex) => currentIndex === index ? { ...item, maxQuantity: Number(event.target.value) } : item),
                  }))} /></div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => moveOption(index, -1)} aria-label="Mover opção para cima"><ChevronUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" disabled={index === draft.options.length - 1} onClick={() => moveOption(index, 1)} aria-label="Mover opção para baixo"><ChevronDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" disabled={draft.options.length <= 1} onClick={() => setDraft((current) => ({
                      ...current,
                      options: current.options.filter((_, currentIndex) => currentIndex !== index),
                    }))} aria-label="Remover opção"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <label className="flex items-center gap-2 md:col-span-4">
                    <Checkbox checked={option.active} onCheckedChange={(checked) => setDraft((current) => ({
                      ...current,
                      options: current.options.map((item, currentIndex) => currentIndex === index ? { ...item, active: checked === true } : item),
                    }))} />
                    <span className="text-xs text-[var(--admin-text-secondary)]">Opção ativa</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--admin-border)] pt-5">
            <h4 className="text-sm font-semibold">Produtos vinculados</h4>
            <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">O mesmo grupo pode ser utilizado por vários produtos sem ser recriado manualmente.</p>
            <div className="mt-3 max-h-56 overflow-y-auto rounded-[12px] border border-[var(--admin-border)]">
              {(productsQuery.data ?? []).map((product) => (
                <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b border-[var(--admin-border)] px-3 py-2.5 last:border-0 hover:bg-[var(--admin-surface-alt)]">
                  <Checkbox checked={draft.productIds.includes(product.id)} onCheckedChange={(checked) => setDraft((current) => ({
                    ...current,
                    productIds: checked === true
                      ? Array.from(new Set([...current.productIds, product.id]))
                      : current.productIds.filter((id) => id !== product.id),
                  }))} />
                  <span className="min-w-0 flex-1 truncate text-sm">{product.name}</span>
                  <span className="text-xs text-[var(--admin-text-muted)]">{productMap.get(product.id)?.active ? "Ativo" : "Pausado"}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            {editing && (
              <Button
                variant="outline"
                className="mr-auto text-destructive"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`Remover o grupo "${editing.name}" de todos os ${editing.productCount} produto(s)?`)) return;
                  try {
                    await removeLinks.mutateAsync({ storeId, groupIds: editing.groupIds });
                    await refresh();
                    setDialogOpen(false);
                    toast.success("Grupo removido dos produtos.");
                  } catch {
                    // mutation displays error
                  }
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />Remover grupo
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar grupo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
