import type {
  CatalogAvailabilityRule,
  ConfiguredCatalogProduct,
  ConfiguredProductSelection,
  OrderItemConfigurationSnapshot,
  PriceBreakdownItem,
  PriceCalculationResult,
} from "../../../shared/catalog.ts";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function parseMinutes(value?: string | null) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function matchesTimeWindow(rule: CatalogAvailabilityRule, now: Date) {
  const start = parseMinutes(rule.startTime);
  const end = parseMinutes(rule.endTime);
  if (start === null || end === null) return true;
  const current = now.getHours() * 60 + now.getMinutes();
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

export function isConfiguredProductAvailable(
  product: ConfiguredCatalogProduct,
  selection: Pick<ConfiguredProductSelection, "channel" | "now">,
) {
  if (!product.active) return false;
  const now = selection.now ?? new Date();
  const rules = product.availability.filter((rule) => rule.active);
  if (rules.length === 0) return true;

  return rules.some((rule) => {
    if (rule.channel !== "all" && rule.channel !== selection.channel) return false;
    if (rule.weekday != null && rule.weekday !== now.getDay()) return false;
    if (rule.startsAt && now < rule.startsAt) return false;
    if (rule.expiresAt && now > rule.expiresAt) return false;
    if (rule.pausedUntil && now < rule.pausedUntil) return false;
    if (rule.stockLimit != null && rule.stockLimit <= 0) return false;
    return matchesTimeWindow(rule, now);
  });
}

function activePromotionPrice(
  price: number,
  promotionalPrice: number | null | undefined,
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  now: Date,
) {
  if (promotionalPrice == null) return price;
  if (startsAt && now < startsAt) return price;
  if (endsAt && now > endsAt) return price;
  return promotionalPrice;
}

export function calculateConfiguredProductPrice(
  product: ConfiguredCatalogProduct,
  selection: ConfiguredProductSelection,
): PriceCalculationResult {
  const errors: string[] = [];
  const breakdown: PriceBreakdownItem[] = [];
  const now = selection.now ?? new Date();
  const quantity = Number.isInteger(selection.quantity) ? selection.quantity : 0;

  if (!product.active) errors.push("Produto inativo.");
  if (product.storeId <= 0) errors.push("Produto sem loja válida.");
  if (quantity < product.minQuantity || quantity > product.maxQuantity) {
    errors.push(`Quantidade deve ficar entre ${product.minQuantity} e ${product.maxQuantity}.`);
  }
  if (!isConfiguredProductAvailable(product, selection)) errors.push("Produto indisponível neste horário ou canal.");

  const safeBasePrice = Math.max(0, product.basePrice);
  if (product.basePrice < 0) errors.push("Preço-base inválido.");

  if (product.pricingEngine === "legacy_v1") {
    const total = roundMoney(safeBasePrice * Math.max(0, quantity));
    return {
      basePrice: safeBasePrice,
      sizePrice: 0,
      flavorsPrice: 0,
      modifiersPrice: 0,
      comboAdditionalPrice: 0,
      upsellsPrice: 0,
      discounts: 0,
      fees: 0,
      unitTotal: safeBasePrice,
      total,
      breakdown: [{ kind: "base", label: product.name, amount: safeBasePrice }],
      validationErrors: errors,
    };
  }

  let selectedSize = selection.sizeId == null ? null : product.sizes.find((size) => size.id === selection.sizeId);
  if (selection.sizeId != null && (!selectedSize || !selectedSize.active)) {
    errors.push("Tamanho inexistente ou inativo.");
    selectedSize = null;
  }
  if (product.sizes.some((size) => size.active) && !selectedSize) errors.push("Escolha um tamanho.");

  const resolvedSizePrice = selectedSize
    ? activePromotionPrice(selectedSize.price, selectedSize.promotionalPrice, selectedSize.promotionStartsAt, selectedSize.promotionEndsAt, now)
    : safeBasePrice;
  if (resolvedSizePrice < 0) errors.push("Preço do tamanho inválido.");

  const basePrice = safeBasePrice;
  // Size prices are absolute selling prices. The breakdown stores only the
  // adjustment so base + size always resolves to the selected size price.
  const sizePrice = roundMoney(resolvedSizePrice - safeBasePrice);
  breakdown.push({ kind: "base", label: product.name, amount: basePrice });
  if (selectedSize) breakdown.push({ kind: "size", label: selectedSize.name, amount: sizePrice });

  const rawFlavorIds = selection.flavorIds ?? [];
  const uniqueFlavorIds = Array.from(new Set(rawFlavorIds));
  const flavorSettings = product.flavorSettings;
  let flavorsPrice = 0;
  const selectedFlavors = uniqueFlavorIds
    .map((id) => product.flavors.find((flavor) => flavor.id === id))
    .filter((flavor): flavor is NonNullable<typeof flavor> => Boolean(flavor));

  if (flavorSettings?.enabled) {
    if (!flavorSettings.allowRepeatedFlavors && uniqueFlavorIds.length !== rawFlavorIds.length) errors.push("Sabores repetidos não são permitidos.");
    if (selectedFlavors.length !== uniqueFlavorIds.length || selectedFlavors.some((flavor) => !flavor.active)) errors.push("Um ou mais sabores estão indisponíveis.");
    const minimum = selectedSize?.minFlavors ?? 1;
    const maximum = selectedSize?.maxFlavors ?? 1;
    if (rawFlavorIds.length < minimum) errors.push(`Escolha pelo menos ${minimum} sabor(es).`);
    if (rawFlavorIds.length > maximum) errors.push(`Escolha no máximo ${maximum} sabor(es).`);

    const flavorTotals = selectedFlavors.map((flavor) => selectedSize ? flavor.pricesBySize[selectedSize.id] : undefined);
    if (flavorTotals.some((price) => price == null || price < 0)) errors.push("Um ou mais sabores não possuem preço para o tamanho escolhido.");
    const validPrices = flavorTotals.filter((price): price is number => typeof price === "number" && price >= 0);
    if (validPrices.length > 0) {
      const highest = Math.max(...validPrices);
      const average = validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length;
      const targetPrice = flavorSettings.pricingRule === "highest_price"
        ? highest
        : flavorSettings.pricingRule === "average_price" || flavorSettings.pricingRule === "proportional_price"
          ? average
          : flavorSettings.pricingRule === "base_plus_difference"
            ? resolvedSizePrice + Math.max(0, highest - resolvedSizePrice)
            : resolvedSizePrice;
      flavorsPrice = roundMoney(Math.max(0, targetPrice - resolvedSizePrice));
      if (flavorsPrice > 0) breakdown.push({ kind: "flavor", label: "Composição de sabores", amount: flavorsPrice });
    }
  } else if (rawFlavorIds.length > 0) {
    errors.push("Este produto não aceita múltiplos sabores.");
  }

  let modifiersPrice = 0;
  const requestedModifiers = selection.modifiers ?? [];
  for (const group of product.modifierGroups.filter((item) => item.active)) {
    const groupSelections = requestedModifiers.filter((item) => item.groupId === group.id);
    const selectedUnits = groupSelections.reduce((sum, item) => sum + item.quantity, 0);
    const minimum = group.required ? Math.max(1, group.minSelections) : group.minSelections;
    if (selectedUnits < minimum) errors.push(`${group.name}: escolha pelo menos ${minimum}.`);
    if (selectedUnits > group.maxSelections) errors.push(`${group.name}: escolha no máximo ${group.maxSelections}.`);

    const pricedUnits: Array<{ name: string; price: number }> = [];
    for (const requested of groupSelections) {
      const option = group.options.find((item) => item.id === requested.optionId);
      if (!option || !option.active || requested.quantity < 1) {
        errors.push(`${group.name}: opção inválida.`);
        continue;
      }
      if ((!group.allowRepeatedOptions || !option.allowRepeat) && requested.quantity > 1) errors.push(`${option.name}: repetição não permitida.`);
      const sizeRule = selectedSize ? option.sizeRules?.find((rule) => rule.sizeId === selectedSize.id) : undefined;
      if (sizeRule && !sizeRule.enabled) {
        errors.push(`${option.name}: indisponível para ${selectedSize?.name}.`);
        continue;
      }
      const maximum = sizeRule?.maxQuantityOverride ?? option.maxQuantity;
      if (requested.quantity > maximum) errors.push(`${option.name}: quantidade máxima ${maximum}.`);
      const unitPrice = sizeRule?.priceOverride ?? option.price;
      if (unitPrice < 0) {
        errors.push(`${option.name}: preço inválido.`);
        continue;
      }
      for (let index = 0; index < requested.quantity; index += 1) pricedUnits.push({ name: option.name, price: unitPrice });
    }

    pricedUnits.sort((left, right) => left.price - right.price);
    const chargeableUnits = pricedUnits.slice(Math.min(group.freeSelections, pricedUnits.length));
    for (const unit of chargeableUnits) {
      modifiersPrice = roundMoney(modifiersPrice + unit.price);
      breakdown.push({ kind: "modifier", label: `${group.name}: ${unit.name}`, amount: unit.price, quantity: 1 });
    }
  }
  if (requestedModifiers.some((item) => !product.modifierGroups.some((group) => group.id === item.groupId && group.active))) {
    errors.push("Foi enviado um grupo de adicionais inexistente.");
  }

  let comboAdditionalPrice = 0;
  const requestedCombos = selection.combos ?? [];
  for (const group of product.comboGroups.filter((item) => item.active)) {
    const groupSelections = requestedCombos.filter((item) => item.groupId === group.id);
    const selectedUnits = groupSelections.reduce((sum, item) => sum + item.quantity, 0);
    const minimum = group.required ? Math.max(1, group.minSelections) : group.minSelections;
    if (selectedUnits < minimum) errors.push(`${group.name}: combo incompleto.`);
    if (selectedUnits > group.maxSelections) errors.push(`${group.name}: limite do combo excedido.`);
    for (const requested of groupSelections) {
      const item = group.items.find((candidate) => candidate.id === requested.itemId);
      if (!item || !item.active || requested.quantity < 1) {
        errors.push(`${group.name}: item de combo inválido.`);
        continue;
      }
      comboAdditionalPrice = roundMoney(comboAdditionalPrice + item.price * requested.quantity);
      if (item.price > 0) breakdown.push({ kind: "combo", label: group.name, amount: item.price * requested.quantity, quantity: requested.quantity });
    }
  }

  let upsellsPrice = 0;
  for (const requested of selection.upsells ?? []) {
    const offer = product.upsellOffers.find((item) => item.productId === requested.productId && item.active);
    if (!offer || requested.quantity < 1) {
      errors.push("Upsell inexistente ou inativo.");
      continue;
    }
    upsellsPrice = roundMoney(upsellsPrice + offer.price * requested.quantity);
    breakdown.push({ kind: "upsell", label: offer.name, amount: offer.price * requested.quantity, quantity: requested.quantity });
  }

  const unitTotal = roundMoney(basePrice + sizePrice + flavorsPrice + modifiersPrice + comboAdditionalPrice + upsellsPrice);
  return {
    basePrice,
    sizePrice,
    flavorsPrice,
    modifiersPrice,
    comboAdditionalPrice,
    upsellsPrice,
    discounts: 0,
    fees: 0,
    unitTotal,
    total: roundMoney(unitTotal * Math.max(0, quantity)),
    breakdown,
    validationErrors: Array.from(new Set(errors)),
  };
}

export function createOrderItemConfigurationSnapshot(
  product: ConfiguredCatalogProduct,
  selection: ConfiguredProductSelection,
  pricing: PriceCalculationResult,
): OrderItemConfigurationSnapshot {
  const size = selection.sizeId == null ? null : product.sizes.find((item) => item.id === selection.sizeId) ?? null;
  return {
    version: 2,
    productId: product.id,
    productName: product.name,
    size: size ? { id: size.id, name: size.name, price: size.promotionalPrice ?? size.price } : null,
    flavors: (selection.flavorIds ?? []).flatMap((id) => {
      const flavor = product.flavors.find((item) => item.id === id);
      if (!flavor) return [];
      return [{ id: flavor.id, name: flavor.name, price: size ? flavor.pricesBySize[size.id] ?? 0 : 0 }];
    }),
    modifiers: (selection.modifiers ?? []).flatMap((selected) => {
      const group = product.modifierGroups.find((item) => item.id === selected.groupId);
      const option = group?.options.find((item) => item.id === selected.optionId);
      if (!group || !option) return [];
      const rule = size ? option.sizeRules?.find((item) => item.sizeId === size.id) : undefined;
      const unitPrice = rule?.priceOverride ?? option.price;
      return [{ groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, quantity: selected.quantity, unitPrice, totalPrice: roundMoney(unitPrice * selected.quantity) }];
    }),
    combos: (selection.combos ?? []).flatMap((selected) => {
      const group = product.comboGroups.find((item) => item.id === selected.groupId);
      const item = group?.items.find((candidate) => candidate.id === selected.itemId);
      if (!group || !item) return [];
      return [{ groupId: group.id, groupName: group.name, itemId: item.id, productId: item.productId, quantity: selected.quantity, unitPrice: item.price, totalPrice: roundMoney(item.price * selected.quantity) }];
    }),
    upsells: (selection.upsells ?? []).flatMap((selected) => {
      const offer = product.upsellOffers.find((item) => item.productId === selected.productId);
      if (!offer) return [];
      return [{ productId: offer.productId, name: offer.name, quantity: selected.quantity, unitPrice: offer.price, totalPrice: roundMoney(offer.price * selected.quantity) }];
    }),
    removedIngredients: selection.removedIngredients ?? [],
    pricing,
  };
}
