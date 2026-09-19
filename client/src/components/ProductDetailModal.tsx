import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { useStore } from "@/contexts/StoreContext";
import { formatFlavorSelection, getPizzaFlavorConfig, PIZZA_SIZE_KEYS } from "@/lib/pizza-flavor-config";
import { trpc } from "@/lib/trpc";
import type { ConfiguredProductSelection } from "../../../shared/catalog";
import { Check, Clock3, Flame, Loader2, Minus, Plus, ShoppingBag, Star, X } from "lucide-react";
import { toast } from "sonner";

const LEGACY_SIZES: Record<string, { label: string; multiplier: number }[]> = {
  pizzas: [
    { label: "Pequena (4 fatias)", multiplier: 0.7 },
    { label: "Média (6 fatias)", multiplier: 1 },
    { label: "Grande (8 fatias)", multiplier: 1.3 },
    { label: "Família (12 fatias)", multiplier: 1.6 },
  ],
  calzones: [
    { label: "Individual", multiplier: 1 },
    { label: "Duplo", multiplier: 1.8 },
  ],
};

const LEGACY_EXTRAS = [
  { id: 1, name: "Borda recheada (catupiry)", price: 5 },
  { id: 2, name: "Borda recheada (cheddar)", price: 5 },
  { id: 3, name: "Borda de chocolate", price: 6 },
  { id: 4, name: "Queijo extra", price: 4 },
  { id: 5, name: "Molho extra", price: 2 },
  { id: 6, name: "Azeitona extra", price: 2 },
];

type FlavorCandidate = { id: number; name: string; price: string };

export type ProductDetailProduct = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  featured: boolean;
  categorySlug?: string;
  imageUrl?: string | null;
};

interface ProductDetailModalProps {
  product: ProductDetailProduct | null;
  open: boolean;
  onClose: () => void;
  fallbackImg: string;
}

type CartCatalogSelection = Omit<ConfiguredProductSelection, "quantity" | "channel" | "now">;

export function ProductDetailModal({ product, open, onClose, fallbackImg }: ProductDetailModalProps) {
  const { addItem, setIsOpen: setCartOpen } = useCart();
  const { selectedStore } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
  const [selectedFlavorIds, setSelectedFlavorIds] = useState<number[]>([]);
  const [optionQuantities, setOptionQuantities] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");

  const [legacySizeIndex, setLegacySizeIndex] = useState(1);
  const [legacyExtraIds, setLegacyExtraIds] = useState<number[]>([]);

  const configurationQuery = trpc.catalog.configuration.useQuery(
    { storeId: selectedStore?.id ?? 0, productId: product?.id ?? 0 },
    { enabled: open && Boolean(selectedStore?.id && product?.id), staleTime: 60_000, retry: 1 },
  );
  const calculatePrice = trpc.catalog.calculatePrice.useMutation();
  const storeSettingsQuery = trpc.storeSettings.get.useQuery(
    { storeId: selectedStore?.id },
    { enabled: open && Boolean(selectedStore?.id) },
  );
  const flavorProductsQuery = trpc.products.list.useQuery(
    product?.categoryId && selectedStore?.id ? { categoryId: product.categoryId, storeId: selectedStore.id } : undefined,
    { enabled: open && Boolean(product && selectedStore?.id) && (product?.categorySlug ?? "pizzas") === "pizzas" },
  );

  const configuration = configurationQuery.data;
  const isConfigured = configuration?.pricingEngine === "configured_v2";
  const activeSizes = useMemo(() => configuration?.sizes.filter((size) => size.active) ?? [], [configuration?.sizes]);
  const activeFlavors = useMemo(() => configuration?.flavors.filter((flavor) => flavor.active) ?? [], [configuration?.flavors]);
  const selectedSize = activeSizes.find((size) => size.id === selectedSizeId) ?? null;

  const catalogSelection = useMemo<CartCatalogSelection>(() => ({
    sizeId: selectedSizeId,
    flavorIds: selectedFlavorIds,
    modifiers: configuration?.modifierGroups.flatMap((group) =>
      group.options.flatMap((option) => {
        const selectedQuantity = optionQuantities[option.id] ?? 0;
        return selectedQuantity > 0 ? [{ groupId: group.id, optionId: option.id, quantity: selectedQuantity }] : [];
      }),
    ) ?? [],
  }), [configuration?.modifierGroups, optionQuantities, selectedFlavorIds, selectedSizeId]);

  useEffect(() => {
    if (!open || !product) return;
    setQuantity(1);
    setSelectedSizeId(null);
    setSelectedFlavorIds([]);
    setOptionQuantities({});
    setNotes("");
    setLegacySizeIndex(1);
    setLegacyExtraIds([]);
    calculatePrice.reset();
  }, [open, product?.id]);

  useEffect(() => {
    if (!open || !isConfigured) return;
    setSelectedSizeId((current) => current && activeSizes.some((size) => size.id === current) ? current : activeSizes[0]?.id ?? null);
  }, [activeSizes, isConfigured, open]);

  useEffect(() => {
    if (!open || !isConfigured || !selectedStore?.id || !product?.id) return;
    const timer = window.setTimeout(() => {
      calculatePrice.mutate({
        storeId: selectedStore.id,
        productId: product.id,
        selection: { ...catalogSelection, quantity, channel: "delivery" },
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [catalogSelection, isConfigured, open, product?.id, quantity, selectedStore?.id]);

  if (!product) return null;

  const categorySlug = product.categorySlug ?? "pizzas";
  const legacySizes = LEGACY_SIZES[categorySlug] ?? null;
  const pizzaFlavorConfig = getPizzaFlavorConfig(storeSettingsQuery.data?.pizzaFlavorConfig);
  const legacyMultiFlavor = !isConfigured && categorySlug === "pizzas" && pizzaFlavorConfig.enabled;
  const legacySizeKey = PIZZA_SIZE_KEYS[legacySizeIndex] ?? "medium";
  const legacyMaxFlavors = legacyMultiFlavor ? pizzaFlavorConfig.maxFlavorsBySize[legacySizeKey] ?? 1 : 1;
  const legacyFlavorCandidates: FlavorCandidate[] = (flavorProductsQuery.data?.length ? flavorProductsQuery.data : [product]).map((item: ProductDetailProduct) => ({
    id: item.id,
    name: item.name,
    price: item.price,
  }));
  const legacySelectedFlavors = (selectedFlavorIds.length ? selectedFlavorIds : [product.id])
    .map((id) => legacyFlavorCandidates.find((candidate) => candidate.id === id))
    .filter(Boolean) as FlavorCandidate[];
  const legacyBasePrice = legacyMultiFlavor && legacySelectedFlavors.length
    ? Math.max(...legacySelectedFlavors.map((item) => Number(item.price)))
    : Number(product.price);
  const legacyExtrasTotal = legacyExtraIds.reduce((total, id) => total + (LEGACY_EXTRAS.find((extra) => extra.id === id)?.price ?? 0), 0);
  const legacyUnitPrice = legacyBasePrice * (legacySizes?.[legacySizeIndex]?.multiplier ?? 1) + legacyExtrasTotal;
  const configuredUnitPrice = calculatePrice.data?.unitTotal ?? configuration?.basePrice ?? Number(product.price);
  const unitPrice = isConfigured ? configuredUnitPrice : legacyUnitPrice;
  const pricingErrors = isConfigured ? calculatePrice.data?.validationErrors ?? ["Carregando configuração..."] : [];
  const canAdd = isConfigured
    ? Boolean(calculatePrice.data && !calculatePrice.isPending && pricingErrors.length === 0)
    : !legacyMultiFlavor || legacySelectedFlavors.length > 0;

  const formatPrice = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  const toggleConfiguredFlavor = (flavorId: number) => {
    const maximum = selectedSize?.maxFlavors ?? 1;
    setSelectedFlavorIds((current) => current.includes(flavorId)
      ? current.filter((id) => id !== flavorId)
      : current.length < maximum ? [...current, flavorId] : current);
  };

  const toggleLegacyFlavor = (flavorId: number) => {
    setSelectedFlavorIds((current) => {
      if (current.includes(flavorId)) return current.length === 1 ? current : current.filter((id) => id !== flavorId);
      return current.length < legacyMaxFlavors ? [...current, flavorId] : current;
    });
  };

  const selectOption = (groupId: number, optionId: number, maximum: number, single: boolean) => {
    setOptionQuantities((current) => {
      const next = { ...current };
      if (single && configuration) {
        const group = configuration.modifierGroups.find((entry) => entry.id === groupId);
        group?.options.forEach((option) => { delete next[option.id]; });
        next[optionId] = 1;
        return next;
      }
      if (next[optionId]) delete next[optionId];
      else next[optionId] = Math.min(1, maximum);
      return next;
    });
  };

  const changeOptionQuantity = (optionId: number, delta: number, maximum: number) => {
    setOptionQuantities((current) => {
      const nextQuantity = Math.max(0, Math.min(maximum, (current[optionId] ?? 0) + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[optionId];
      else next[optionId] = nextQuantity;
      return next;
    });
  };

  const handleAdd = () => {
    if (!canAdd) return toast.error(pricingErrors[0] ?? "Complete as escolhas obrigatórias");

    if (isConfigured && configuration) {
      const flavorNames = selectedFlavorIds.map((id) => activeFlavors.find((flavor) => flavor.id === id)?.name).filter(Boolean);
      const optionNames = configuration.modifierGroups.flatMap((group) => group.options.flatMap((option) =>
        optionQuantities[option.id] ? [`${option.name}${optionQuantities[option.id] > 1 ? ` x${optionQuantities[option.id]}` : ""}`] : [],
      ));
      const detailLabel = [selectedSize?.name, flavorNames.join(" / "), optionNames.join(", ")].filter(Boolean).join(" · ");
      addItem({
        productId: product.id,
        productName: detailLabel ? `${product.name} (${detailLabel})` : product.name,
        productPrice: configuredUnitPrice.toFixed(2),
        quantity,
        notes: notes.trim() || undefined,
        imageUrl: product.imageUrl ?? fallbackImg,
        configKey: JSON.stringify(catalogSelection),
        catalogSelection,
      });
    } else {
      const sizeLabel = legacySizes?.[legacySizeIndex]?.label;
      const flavorLabel = legacyMultiFlavor ? formatFlavorSelection(legacySelectedFlavors.map((item) => item.name)) : "";
      const extraNames = legacyExtraIds.map((id) => LEGACY_EXTRAS.find((extra) => extra.id === id)?.name).filter(Boolean);
      const details = [sizeLabel, flavorLabel, extraNames.join(", ")].filter(Boolean).join(" · ");
      addItem({
        productId: legacySelectedFlavors[0]?.id ?? product.id,
        productName: details ? `${product.name} (${details})` : product.name,
        productPrice: legacyUnitPrice.toFixed(2),
        quantity,
        notes: notes.trim() || undefined,
        imageUrl: product.imageUrl ?? fallbackImg,
        configKey: `${legacySizeKey}:${selectedFlavorIds.slice().sort().join("-")}:${legacyExtraIds.slice().sort().join("-")}`,
      });
    }

    toast.success(`${product.name} foi para a sacola`, { action: { label: "Ver sacola", onClick: () => setCartOpen(true) } });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[min(94vw,680px)] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] border-0 bg-[#f7f1eb] p-0 shadow-[0_28px_90px_rgba(69,7,9,0.35)]">
        <DialogTitle className="sr-only">Monte {product.name}</DialogTitle>
        <DialogDescription className="sr-only">Escolha tamanhos, sabores e adicionais antes de colocar o produto na sacola.</DialogDescription>

        <header className="relative shrink-0 bg-[#DA1923] text-white">
          <div className="grid min-h-36 grid-cols-[1fr_145px] sm:min-h-44 sm:grid-cols-[1fr_220px]">
            <div className="flex min-w-0 flex-col justify-between p-5 sm:p-7">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/75"><Flame className="h-4 w-4" /> Monte do seu jeito</div>
              <div>
                <h2 className="line-clamp-2 text-2xl font-black uppercase leading-[0.92] sm:text-4xl">{product.name}</h2>
                <div className="mt-3 flex flex-wrap gap-2"><Badge className="border-0 bg-[#450709] text-white"><Clock3 className="mr-1 h-3 w-3" />40-50 min</Badge><Badge className="border-0 bg-white text-[#450709]"><Star className="mr-1 h-3 w-3 fill-[#f2b705] text-[#f2b705]" />4,8</Badge></div>
              </div>
            </div>
            <div className="relative overflow-hidden bg-[#450709]"><img src={product.imageUrl ?? fallbackImg} alt={product.name} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-[#450709]/10" /></div>
          </div>
          <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-[#450709] text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {product.description && <p className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-[#665557]">{product.description}</p>}

          {configurationQuery.isLoading && <div className="grid min-h-40 place-items-center rounded-3xl bg-white"><Loader2 className="h-7 w-7 animate-spin text-[#DA1923]" /></div>}

          {isConfigured && activeSizes.length > 0 && (
            <ChoiceSection number="01" title="Escolha o tamanho" hint="Obrigatório">
              <div className="grid gap-2 sm:grid-cols-2">
                {activeSizes.map((size) => {
                  const selected = selectedSizeId === size.id;
                  const displayPrice = size.promotionalPrice ?? size.price;
                  return <button key={size.id} type="button" onClick={() => { setSelectedSizeId(size.id); setSelectedFlavorIds([]); }} className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left transition ${selected ? "border-[#DA1923] bg-[#fff0ef]" : "border-[#eadeda] bg-white"}`}><span><strong className="block text-sm text-[#2b1718]">{size.name}</strong><small className="text-[#7d6669]">{size.maxFlavors && size.maxFlavors > 1 ? `Até ${size.maxFlavors} sabores` : "1 sabor"}</small></span><strong className="max-w-24 text-right text-xs text-[#DA1923] sm:text-sm">{displayPrice > 0 ? formatPrice(displayPrice) : configuration?.flavorSettings?.enabled ? "Conforme o sabor" : formatPrice(displayPrice)}</strong></button>;
                })}
              </div>
            </ChoiceSection>
          )}

          {isConfigured && configuration?.flavorSettings?.enabled && (
            <ChoiceSection number="02" title="Escolha os sabores" hint={`${selectedSize?.minFlavors ?? 1} a ${selectedSize?.maxFlavors ?? 1}`}>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeFlavors.map((flavor) => {
                  const selected = selectedFlavorIds.includes(flavor.id);
                  const maximum = selectedSize?.maxFlavors ?? 1;
                  const disabled = !selected && selectedFlavorIds.length >= maximum;
                  const price = selectedSize ? flavor.pricesBySize[selectedSize.id] : undefined;
                  return <button key={flavor.id} type="button" disabled={disabled} onClick={() => toggleConfiguredFlavor(flavor.id)} className={`flex min-h-16 items-center justify-between rounded-2xl border-2 p-3 text-left transition ${selected ? "border-[#DA1923] bg-[#fff0ef]" : "border-[#eadeda] bg-white"} ${disabled ? "opacity-45" : ""}`}><span><strong className="block text-sm text-[#2b1718]">{flavor.name}</strong>{price != null && <small className="text-[#7d6669]">{formatPrice(price)}</small>}</span><SelectionMark selected={selected} /></button>;
                })}
              </div>
            </ChoiceSection>
          )}

          {isConfigured && configuration?.modifierGroups.filter((group) => group.active).map((group, index) => {
            const selectedCount = group.options.reduce((total, option) => total + (optionQuantities[option.id] ?? 0), 0);
            return <ChoiceSection key={group.id} number={String(index + (configuration.flavorSettings?.enabled ? 3 : 2)).padStart(2, "0")} title={group.name} hint={`${group.required ? "Obrigatório" : "Opcional"} · ${selectedCount}/${group.maxSelections}`}>
              <div className="space-y-2">{group.options.filter((option) => option.active).map((option) => {
                const selectedQuantity = optionQuantities[option.id] ?? 0;
                const maximum = Math.min(option.maxQuantity, group.maxSelections);
                const single = group.maxSelections === 1;
                return <div key={option.id} className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 p-3 ${selectedQuantity ? "border-[#DA1923] bg-[#fff0ef]" : "border-[#eadeda] bg-white"}`}><button type="button" className="min-w-0 flex-1 text-left" onClick={() => selectOption(group.id, option.id, maximum, single)}><strong className="block truncate text-sm text-[#2b1718]">{option.name}</strong><small className="text-[#DA1923]">{option.price > 0 ? `+ ${formatPrice(option.price)}` : "Incluso"}</small></button>{!single && selectedQuantity > 0 ? <div className="flex items-center gap-2 rounded-xl bg-white p-1"><button type="button" className="grid h-7 w-7 place-items-center" onClick={() => changeOptionQuantity(option.id, -1, maximum)}><Minus className="h-3 w-3" /></button><strong className="w-4 text-center text-sm">{selectedQuantity}</strong><button type="button" className="grid h-7 w-7 place-items-center" onClick={() => changeOptionQuantity(option.id, 1, maximum)}><Plus className="h-3 w-3" /></button></div> : <SelectionMark selected={selectedQuantity > 0} />}</div>;
              })}</div>
            </ChoiceSection>;
          })}

          {!configurationQuery.isLoading && !isConfigured && legacySizes && (
            <ChoiceSection number="01" title="Escolha o tamanho" hint="Obrigatório">
              <div className="grid gap-2 sm:grid-cols-2">{legacySizes.map((size, index) => <button key={size.label} type="button" onClick={() => { setLegacySizeIndex(index); setSelectedFlavorIds([]); }} className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left ${legacySizeIndex === index ? "border-[#DA1923] bg-[#fff0ef]" : "border-[#eadeda] bg-white"}`}><strong className="text-sm text-[#2b1718]">{size.label}</strong><strong className="text-sm text-[#DA1923]">{formatPrice(legacyBasePrice * size.multiplier)}</strong></button>)}</div>
            </ChoiceSection>
          )}

          {!configurationQuery.isLoading && legacyMultiFlavor && (
            <ChoiceSection number="02" title="Escolha os sabores" hint={`Até ${legacyMaxFlavors}`}>
              <div className="grid gap-2 sm:grid-cols-2">{legacyFlavorCandidates.map((flavor) => { const selected = selectedFlavorIds.includes(flavor.id); return <button key={flavor.id} type="button" onClick={() => toggleLegacyFlavor(flavor.id)} className={`flex min-h-16 items-center justify-between rounded-2xl border-2 p-3 text-left ${selected ? "border-[#DA1923] bg-[#fff0ef]" : "border-[#eadeda] bg-white"}`}><span><strong className="block text-sm text-[#2b1718]">{flavor.name}</strong><small className="text-[#7d6669]">{formatPrice(Number(flavor.price))}</small></span><SelectionMark selected={selected} /></button>; })}</div>
            </ChoiceSection>
          )}

          {!configurationQuery.isLoading && !isConfigured && (categorySlug === "pizzas" || categorySlug === "calzones") && (
            <ChoiceSection number="03" title="Quer incrementar?" hint="Opcional">
              <div className="space-y-2">{LEGACY_EXTRAS.map((extra) => { const selected = legacyExtraIds.includes(extra.id); return <button key={extra.id} type="button" onClick={() => setLegacyExtraIds((current) => selected ? current.filter((id) => id !== extra.id) : [...current, extra.id])} className={`flex w-full items-center justify-between rounded-2xl border-2 p-3 text-left ${selected ? "border-[#DA1923] bg-[#fff0ef]" : "border-[#eadeda] bg-white"}`}><span className="text-sm font-bold text-[#2b1718]">{extra.name}</span><span className="flex items-center gap-3 text-sm font-black text-[#DA1923]">+ {formatPrice(extra.price)}<SelectionMark selected={selected} /></span></button>; })}</div>
            </ChoiceSection>
          )}

          <ChoiceSection number="+" title="Alguma observação?" hint="Opcional"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={3} placeholder="Ex.: sem cebola, molho à parte..." className="w-full resize-none rounded-2xl border-2 border-[#eadeda] bg-white p-4 text-sm outline-none focus:border-[#DA1923]" /></ChoiceSection>

          {isConfigured && pricingErrors.length > 0 && !calculatePrice.isPending && <div className="rounded-2xl border border-[#f3c0bc] bg-[#fff0ef] px-4 py-3 text-sm font-semibold text-[#8f1118]">{pricingErrors[0]}</div>}
        </div>

        <footer className="shrink-0 border-t border-[#e6d8d2] bg-white p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 shrink-0 items-center rounded-2xl border-2 border-[#eadeda] bg-[#faf7f4] p-1"><button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="grid h-9 w-9 place-items-center rounded-xl"><Minus className="h-4 w-4" /></button><strong className="w-7 text-center text-sm">{quantity}</strong><button type="button" onClick={() => setQuantity((current) => Math.min(configuration?.maxQuantity ?? 99, current + 1))} className="grid h-9 w-9 place-items-center rounded-xl"><Plus className="h-4 w-4" /></button></div>
            <Button type="button" onClick={handleAdd} disabled={!canAdd || calculatePrice.isPending} className="h-12 min-w-0 flex-1 rounded-2xl bg-[#DA1923] px-4 text-sm font-black uppercase tracking-wide text-white hover:bg-[#bd111b]">{calculatePrice.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}<span className="truncate">{canAdd ? `Adicionar · ${formatPrice(unitPrice * quantity)}` : "Complete as escolhas"}</span></Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceSection({ number, title, hint, children }: { number: string; title: string; hint: string; children: React.ReactNode }) {
  return <section className="rounded-3xl bg-white p-4 shadow-[0_6px_24px_rgba(69,7,9,0.05)] sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-8 min-w-8 place-items-center rounded-xl bg-[#450709] px-2 text-[10px] font-black text-white">{number}</span><h3 className="text-base font-black uppercase leading-tight text-[#2b1718]">{title}</h3></div><span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#9b8587]">{hint}</span></div>{children}</section>;
}

function SelectionMark({ selected }: { selected: boolean }) {
  return <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-[#DA1923] bg-[#DA1923] text-white" : "border-[#cdbfc0] bg-white"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>;
}
