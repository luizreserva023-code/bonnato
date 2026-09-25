import { describe, expect, it } from "vitest";
import type { ConfiguredCatalogProduct, ConfiguredProductSelection } from "../shared/catalog.ts";
import { calculateConfiguredProductPrice, createOrderItemConfigurationSnapshot } from "./domains/catalog/pricing.ts";

const baseProduct = (overrides: Partial<ConfiguredCatalogProduct> = {}): ConfiguredCatalogProduct => ({
  id: 10,
  storeId: 1,
  name: "Pizza teste",
  basePrice: 40,
  productType: "simple",
  pricingEngine: "configured_v2",
  active: true,
  minQuantity: 1,
  maxQuantity: 10,
  sizes: [],
  modifierGroups: [],
  flavors: [],
  flavorSettings: null,
  comboGroups: [],
  upsellOffers: [],
  availability: [],
  ...overrides,
});

const selection = (overrides: Partial<ConfiguredProductSelection> = {}): ConfiguredProductSelection => ({
  quantity: 1,
  channel: "delivery",
  now: new Date("2026-08-03T19:00:00"),
  ...overrides,
});

describe("motor de precificação do catálogo", () => {
  it("preserva exatamente o preço de um produto legado", () => {
    const result = calculateConfiguredProductPrice(baseProduct({ pricingEngine: "legacy_v1", basePrice: 29.9 }), selection({ quantity: 2, sizeId: 999 }));
    expect(result.total).toBe(59.8);
    expect(result.validationErrors).toEqual([]);
  });

  it("calcula produto simples", () => {
    expect(calculateConfiguredProductPrice(baseProduct(), selection({ quantity: 2 })).total).toBe(80);
  });

  it("usa o preço do tamanho selecionado", () => {
    const product = baseProduct({ productType: "sizes", sizes: [{ id: 1, name: "Grande", price: 65, active: true }] });
    const result = calculateConfiguredProductPrice(product, selection({ sizeId: 1 }));
    expect(result.sizePrice).toBe(25);
    expect(result.total).toBe(65);
  });

  it("substitui o preco-base quando o tamanho custa menos", () => {
    const product = baseProduct({ productType: "sizes", sizes: [{ id: 1, name: "Individual", price: 25, active: true }] });
    const result = calculateConfiguredProductPrice(product, selection({ sizeId: 1 }));
    expect(result.sizePrice).toBe(-15);
    expect(result.total).toBe(25);
  });

  it("usa promoção de tamanho apenas dentro do período", () => {
    const product = baseProduct({ sizes: [{ id: 1, name: "Grande", price: 65, promotionalPrice: 55, promotionStartsAt: new Date("2026-08-01"), promotionEndsAt: new Date("2026-08-10"), active: true }] });
    expect(calculateConfiguredProductPrice(product, selection({ sizeId: 1 })).total).toBe(55);
    expect(calculateConfiguredProductPrice(product, selection({ sizeId: 1, now: new Date("2026-09-01") })).total).toBe(65);
  });

  it("bloqueia tamanho inativo", () => {
    const product = baseProduct({ sizes: [{ id: 1, name: "Grande", price: 65, active: false }] });
    expect(calculateConfiguredProductPrice(product, selection({ sizeId: 1 })).validationErrors).toContain("Tamanho inexistente ou inativo.");
  });

  it("valida grupo obrigatório e mínimo", () => {
    const product = baseProduct({ modifierGroups: [{ id: 1, name: "Proteína", required: true, minSelections: 2, maxSelections: 3, freeSelections: 0, allowRepeatedOptions: false, active: true, options: [] }] });
    expect(calculateConfiguredProductPrice(product, selection()).validationErrors).toContain("Proteína: escolha pelo menos 2.");
  });

  it("valida máximo do grupo", () => {
    const product = baseProduct({ modifierGroups: [{ id: 1, name: "Molhos", required: false, minSelections: 0, maxSelections: 1, freeSelections: 0, allowRepeatedOptions: true, active: true, options: [{ id: 1, name: "Molho", price: 2, active: true, maxQuantity: 3, allowRepeat: true }] }] });
    expect(calculateConfiguredProductPrice(product, selection({ modifiers: [{ groupId: 1, optionId: 1, quantity: 2 }] })).validationErrors).toContain("Molhos: escolha no máximo 1.");
  });

  it("cobra apenas escolhas além da franquia grátis", () => {
    const product = baseProduct({ modifierGroups: [{ id: 1, name: "Complementos", required: false, minSelections: 0, maxSelections: 3, freeSelections: 1, allowRepeatedOptions: false, active: true, options: [
      { id: 1, name: "Granola", price: 2, active: true, maxQuantity: 1, allowRepeat: false },
      { id: 2, name: "Morango", price: 4, active: true, maxQuantity: 1, allowRepeat: false },
    ] }] });
    const result = calculateConfiguredProductPrice(product, selection({ modifiers: [{ groupId: 1, optionId: 1, quantity: 1 }, { groupId: 1, optionId: 2, quantity: 1 }] }));
    expect(result.modifiersPrice).toBe(4);
    expect(result.total).toBe(44);
  });

  it("aplica preço e limite específicos por tamanho", () => {
    const product = baseProduct({
      sizes: [{ id: 1, name: "Grande", price: 60, active: true }],
      modifierGroups: [{ id: 1, name: "Borda", required: false, minSelections: 0, maxSelections: 1, freeSelections: 0, allowRepeatedOptions: false, active: true, options: [{ id: 1, name: "Catupiry", price: 5, active: true, maxQuantity: 1, allowRepeat: false, sizeRules: [{ sizeId: 1, enabled: true, priceOverride: 9, maxQuantityOverride: 1 }] }] }],
    });
    expect(calculateConfiguredProductPrice(product, selection({ sizeId: 1, modifiers: [{ groupId: 1, optionId: 1, quantity: 1 }] })).total).toBe(69);
  });

  it("bloqueia adicional incompatível com tamanho", () => {
    const product = baseProduct({
      sizes: [{ id: 1, name: "Individual", price: 30, active: true }],
      modifierGroups: [{ id: 1, name: "Borda", required: false, minSelections: 0, maxSelections: 1, freeSelections: 0, allowRepeatedOptions: false, active: true, options: [{ id: 1, name: "Catupiry", price: 5, active: true, maxQuantity: 1, allowRepeat: false, sizeRules: [{ sizeId: 1, enabled: false }] }] }],
    });
    expect(calculateConfiguredProductPrice(product, selection({ sizeId: 1, modifiers: [{ groupId: 1, optionId: 1, quantity: 1 }] })).validationErrors).toContain("Catupiry: indisponível para Individual.");
  });

  it("calcula pizza pelo sabor mais caro", () => {
    const product = baseProduct({
      productType: "multi_flavor",
      sizes: [{ id: 1, name: "Grande", price: 50, minFlavors: 1, maxFlavors: 2, active: true }],
      flavors: [{ id: 1, name: "Mussarela", active: true, pricesBySize: { 1: 50 } }, { id: 2, name: "Especial", active: true, pricesBySize: { 1: 68 } }],
      flavorSettings: { enabled: true, pricingRule: "highest_price", allowRepeatedFlavors: false },
    });
    expect(calculateConfiguredProductPrice(product, selection({ sizeId: 1, flavorIds: [1, 2] })).total).toBe(68);
  });

  it("calcula média dos sabores", () => {
    const product = baseProduct({
      sizes: [{ id: 1, name: "Grande", price: 50, minFlavors: 2, maxFlavors: 2, active: true }],
      flavors: [{ id: 1, name: "A", active: true, pricesBySize: { 1: 50 } }, { id: 2, name: "B", active: true, pricesBySize: { 1: 70 } }],
      flavorSettings: { enabled: true, pricingRule: "average_price", allowRepeatedFlavors: false },
    });
    expect(calculateConfiguredProductPrice(product, selection({ sizeId: 1, flavorIds: [1, 2] })).total).toBe(60);
  });

  it("impede sabores acima do limite", () => {
    const product = baseProduct({
      sizes: [{ id: 1, name: "Média", price: 50, minFlavors: 1, maxFlavors: 2, active: true }],
      flavors: [1, 2, 3].map((id) => ({ id, name: `S${id}`, active: true, pricesBySize: { 1: 50 } })),
      flavorSettings: { enabled: true, pricingRule: "highest_price", allowRepeatedFlavors: false },
    });
    expect(calculateConfiguredProductPrice(product, selection({ sizeId: 1, flavorIds: [1, 2, 3] })).validationErrors).toContain("Escolha no máximo 2 sabor(es).");
  });

  it("valida combo incompleto e calcula acréscimo quando completo", () => {
    const product = baseProduct({ comboGroups: [{ id: 1, name: "Escolha uma bebida", required: true, minSelections: 1, maxSelections: 1, active: true, items: [{ id: 5, productId: 20, price: 3, active: true }] }] });
    expect(calculateConfiguredProductPrice(product, selection()).validationErrors).toContain("Escolha uma bebida: combo incompleto.");
    expect(calculateConfiguredProductPrice(product, selection({ combos: [{ groupId: 1, itemId: 5, quantity: 1 }] })).total).toBe(43);
  });

  it("rejeita upsell não cadastrado e usa somente o preço confiável do catálogo", () => {
    const product = baseProduct({ upsellOffers: [{ productId: 50, name: "Refrigerante", price: 8, active: true }] });
    expect(calculateConfiguredProductPrice(product, selection({ upsells: [{ productId: 99, quantity: 1 }] })).validationErrors).toContain("Upsell inexistente ou inativo.");
    expect(calculateConfiguredProductPrice(product, selection({ upsells: [{ productId: 50, quantity: 2 }] })).total).toBe(56);
  });

  it("bloqueia produto fora do horário e aceita janela que cruza meia-noite", () => {
    const product = baseProduct({ availability: [{ weekday: 1, startTime: "18:00", endTime: "23:00", channel: "delivery", active: true }] });
    expect(calculateConfiguredProductPrice(product, selection({ now: new Date("2026-08-03T12:00:00") })).validationErrors).toContain("Produto indisponível neste horário ou canal.");
    const overnight = baseProduct({ availability: [{ weekday: 1, startTime: "18:00", endTime: "02:00", channel: "delivery", active: true }] });
    expect(calculateConfiguredProductPrice(overnight, selection({ now: new Date("2026-08-03T23:00:00") })).validationErrors).toEqual([]);
  });

  it("bloqueia quantidade fora do limite", () => {
    expect(calculateConfiguredProductPrice(baseProduct({ minQuantity: 2, maxQuantity: 4 }), selection({ quantity: 5 })).validationErrors).toContain("Quantidade deve ficar entre 2 e 4.");
  });

  it("gera snapshot imutável com escolhas e preço", () => {
    const product = baseProduct({ sizes: [{ id: 1, name: "Grande", price: 60, active: true }] });
    const selected = selection({ sizeId: 1 });
    const pricing = calculateConfiguredProductPrice(product, selected);
    const snapshot = createOrderItemConfigurationSnapshot(product, selected, pricing);
    expect(snapshot).toMatchObject({ version: 2, productId: 10, productName: "Pizza teste", size: { id: 1, name: "Grande" }, pricing: { total: 60 } });
  });
});
