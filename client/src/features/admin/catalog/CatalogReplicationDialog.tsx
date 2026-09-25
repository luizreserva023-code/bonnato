import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FolderTree,
  Loader2,
  Package,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StoreOption = {
  id: number;
  name: string;
  slug: string;
  city: string;
};

type CatalogReplicationDialogProps = {
  open: boolean;
  onClose: () => void;
  stores: StoreOption[];
  initialSourceStoreId?: number;
};

type Scope = "product" | "category" | "catalog";
type Mode = "merge" | "replace";

export function CatalogReplicationDialog({
  open,
  onClose,
  stores,
  initialSourceStoreId,
}: CatalogReplicationDialogProps) {
  const utils = trpc.useUtils();
  const [sourceStoreId, setSourceStoreId] = useState<number | undefined>(initialSourceStoreId);
  const [scope, setScope] = useState<Scope>("catalog");
  const [mode, setMode] = useState<Mode>("merge");
  const [productId, setProductId] = useState<number | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [targetStoreIds, setTargetStoreIds] = useState<Set<number>>(() => new Set());
  const [lastResult, setLastResult] = useState<{
    results: Array<{
      targetStoreId: number;
      categoriesCopied: number;
      productsCopied: number;
      productsUpdated: number;
      archivedProducts: number;
      warnings: string[];
    }>;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setSourceStoreId(initialSourceStoreId ?? stores[0]?.id);
    setTargetStoreIds(new Set());
    setProductId(undefined);
    setCategoryId(undefined);
    setScope("catalog");
    setMode("merge");
    setLastResult(null);
  }, [initialSourceStoreId, open, stores]);

  const sourceStore = stores.find((store) => store.id === sourceStoreId);
  const eligibleTargets = stores.filter((store) => store.id !== sourceStoreId);

  const categoriesQuery = trpc.categories.listAll.useQuery(
    { storeId: sourceStoreId },
    { enabled: open && Boolean(sourceStoreId), staleTime: 15_000 },
  );
  const productsQuery = trpc.products.listAll.useQuery(
    { storeId: sourceStoreId },
    { enabled: open && Boolean(sourceStoreId), staleTime: 15_000 },
  );

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const replicate = trpc.catalog.replicateAcrossStores.useMutation({
    onSuccess: async (data) => {
      setLastResult(data);
      await Promise.all([
        utils.categories.listAll.invalidate(),
        utils.categories.list.invalidate(),
        utils.products.listAll.invalidate(),
        utils.products.list.invalidate(),
        utils.catalog.adminProductSummaries.invalidate(),
        utils.catalog.adminModifierGroups.invalidate(),
      ]);

      const copied = data.results.reduce((sum, result) => sum + result.productsCopied, 0);
      const updated = data.results.reduce((sum, result) => sum + result.productsUpdated, 0);
      toast.success("Sincronização concluída", {
        description: `${copied} produto(s) copiado(s) e ${updated} atualizado(s).`,
      });
    },
    onError: (error) => {
      toast.error("Não foi possível sincronizar o cardápio", {
        description: error.message,
      });
    },
  });

  if (!open) return null;

  const toggleTarget = (storeId: number) => {
    setTargetStoreIds((current) => {
      const next = new Set(current);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
    setLastResult(null);
  };

  const submit = () => {
    if (!sourceStoreId) return toast.error("Selecione a loja de origem.");
    if (targetStoreIds.size === 0) return toast.error("Selecione pelo menos uma loja de destino.");
    if (scope === "product" && !productId) return toast.error("Selecione o item que será copiado.");
    if (scope === "category" && !categoryId) return toast.error("Selecione a categoria que será copiada.");

    if (scope === "catalog" && mode === "replace") {
      const names = eligibleTargets
        .filter((store) => targetStoreIds.has(store.id))
        .map((store) => store.name)
        .join(", ");
      const confirmed = window.confirm(
        `Substituir o cardápio de ${names}? Os itens atuais que não existirem na origem serão arquivados e deixarão de aparecer para o cliente. Pedidos históricos serão preservados.`,
      );
      if (!confirmed) return;
    }

    setLastResult(null);
    replicate.mutate({
      sourceStoreId,
      targetStoreIds: Array.from(targetStoreIds),
      scope,
      mode: scope === "catalog" ? mode : "merge",
      productId: scope === "product" ? productId : undefined,
      categoryId: scope === "category" ? categoryId : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--admin-border)] bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-brand-900)] px-5 py-5 text-white sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Catálogo entre unidades</p>
            <h2 className="mt-1 text-xl font-black">Sincronizar cardápio</h2>
            <p className="mt-1 max-w-xl text-sm text-white/65">
              Copie um item, uma categoria ou o cardápio completo preservando fotos, preços e configurações.
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} className="rounded-full text-white hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          <section>
            <StepTitle number={1} title="Loja de origem" />
            <Select
              value={sourceStoreId ? String(sourceStoreId) : ""}
              onValueChange={(value) => {
                setSourceStoreId(Number(value));
                setProductId(undefined);
                setCategoryId(undefined);
                setTargetStoreIds(new Set());
                setLastResult(null);
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={String(store.id)}>
                    {store.name} — {store.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourceStore && (
              <p className="mt-2 text-xs text-muted-foreground">
                Origem: <strong>{sourceStore.name}</strong>. {products.length} produto(s) e {categories.length} categoria(s).
              </p>
            )}
          </section>

          <section>
            <StepTitle number={2} title="O que deseja copiar?" />
            <div className="grid gap-3 sm:grid-cols-3">
              <ScopeCard
                active={scope === "product"}
                icon={<Package className="h-5 w-5" />}
                title="Um item"
                description="Escolha um produto específico."
                onClick={() => { setScope("product"); setMode("merge"); setLastResult(null); }}
              />
              <ScopeCard
                active={scope === "category"}
                icon={<FolderTree className="h-5 w-5" />}
                title="Uma categoria"
                description="Leva a categoria e todos os itens dela."
                onClick={() => { setScope("category"); setMode("merge"); setLastResult(null); }}
              />
              <ScopeCard
                active={scope === "catalog"}
                icon={<Copy className="h-5 w-5" />}
                title="Cardápio completo"
                description="Replica toda a estrutura comercial."
                onClick={() => { setScope("catalog"); setLastResult(null); }}
              />
            </div>

            {scope === "product" && (
              <div className="mt-3">
                <Select value={productId ? String(productId) : ""} onValueChange={(value) => setProductId(Number(value))}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.name} — {categoryNameById.get(product.categoryId) ?? "Sem categoria"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "category" && (
              <div className="mt-3">
                <Select value={categoryId ? String(categoryId) : ""} onValueChange={(value) => setCategoryId(Number(value))}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name} ({products.filter((product) => product.categoryId === category.id).length} itens)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>

          {scope === "catalog" && (
            <section>
              <StepTitle number={3} title="Como tratar o cardápio atual do destino?" />
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeCard
                  active={mode === "merge"}
                  title="Manter e sincronizar"
                  description="Mantém itens exclusivos do destino e atualiza/copia os equivalentes da origem."
                  onClick={() => setMode("merge")}
                />
                <ModeCard
                  active={mode === "replace"}
                  destructive
                  title="Substituir cardápio"
                  description="Arquiva itens antigos que não existirem na origem e deixa o destino espelhado."
                  onClick={() => setMode("replace")}
                />
              </div>
            </section>
          )}

          <section>
            <StepTitle number={scope === "catalog" ? 4 : 3} title="Lojas de destino" />
            <div className="grid gap-2 sm:grid-cols-2">
              {eligibleTargets.map((store) => {
                const selected = targetStoreIds.has(store.id);
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => toggleTarget(store.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                      selected
                        ? "border-[var(--admin-brand-700)] bg-[var(--admin-brand-50)]"
                        : "border-[var(--admin-border)] bg-white hover:border-[var(--admin-border-strong)]"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      selected ? "bg-[var(--admin-brand-800)] text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {selected ? <CheckCircle2 className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-foreground">{store.name}</strong>
                      <span className="block truncate text-xs text-muted-foreground">{store.city}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {scope === "catalog" && mode === "replace" && (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-bold">Substituição segura</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  Produtos antigos são arquivados, não apagados fisicamente. Assim pedidos e relatórios históricos continuam íntegros.
                </p>
              </div>
            </div>
          )}

          {lastResult && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-900">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-black">Sincronização concluída</p>
              </div>
              <div className="mt-3 space-y-2">
                {lastResult.results.map((result) => {
                  const target = stores.find((store) => store.id === result.targetStoreId);
                  return (
                    <div key={result.targetStoreId} className="rounded-xl bg-white/80 px-3 py-2 text-xs text-emerald-950">
                      <strong>{target?.name ?? `Loja #${result.targetStoreId}`}</strong>
                      <span className="ml-2">
                        {result.productsCopied} novo(s), {result.productsUpdated} atualizado(s)
                        {result.archivedProducts > 0 ? `, ${result.archivedProducts} antigo(s) arquivado(s)` : ""}.
                      </span>
                      {result.warnings.length > 0 && (
                        <p className="mt-1 text-amber-700">
                          {result.warnings.length} aviso(s): {result.warnings.slice(0, 2).join(" • ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--admin-border)] bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={replicate.isPending}>
            Fechar
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={replicate.isPending || !sourceStoreId || targetStoreIds.size === 0}
            className="bg-[var(--admin-brand-800)] hover:bg-[var(--admin-brand-700)]"
          >
            {replicate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            {replicate.isPending ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function StepTitle({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--admin-brand-800)] text-[11px] font-black text-white">
        {number}
      </span>
      <h3 className="text-sm font-black text-[var(--admin-text-primary)]">{title}</h3>
    </div>
  );
}

function ScopeCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-[var(--admin-brand-700)] bg-[var(--admin-brand-50)] shadow-sm"
          : "border-[var(--admin-border)] bg-white hover:border-[var(--admin-border-strong)]"
      }`}
    >
      <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${
        active ? "bg-[var(--admin-brand-800)] text-white" : "bg-muted text-muted-foreground"
      }`}>
        {icon}
      </span>
      <strong className="block text-sm text-foreground">{title}</strong>
      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}

function ModeCard({
  active,
  title,
  description,
  destructive = false,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? destructive
            ? "border-amber-400 bg-amber-50"
            : "border-[var(--admin-brand-700)] bg-[var(--admin-brand-50)]"
          : "border-[var(--admin-border)] bg-white hover:border-[var(--admin-border-strong)]"
      }`}
    >
      <strong className="block text-sm text-foreground">{title}</strong>
      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}
