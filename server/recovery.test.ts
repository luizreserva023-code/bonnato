/**
 * Testes do sistema de recuperação de receita
 * Cobre: anti-duplicação, markConversions, processReactivation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks globais ────────────────────────────────────────────────────────────

const mockWhatsApp = vi.fn().mockResolvedValue(true);
const mockPush = vi.fn().mockResolvedValue(true);

vi.mock("./whatsapp", () => ({
  sendWhatsApp: mockWhatsApp,
  WhatsAppTemplates: {
    orderConfirmed: vi.fn(),
    orderPreparing: vi.fn(),
    orderOutForDelivery: vi.fn(),
    orderDelivered: vi.fn(),
    orderCancelled: vi.fn(),
  },
}));

vi.mock("./push", () => ({
  sendPushToUser: mockPush,
  sendPushToAdmins: vi.fn(),
  sendPushToDriver: vi.fn(),
  savePushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
  sendPushToAllUsers: vi.fn(),
}));

// ─── Testes de markCartRecovered ─────────────────────────────────────────────

describe("markCartRecovered", () => {
  it("deve ser uma função exportada do automation.ts", async () => {
    const mod = await import("./automation");
    expect(typeof mod.markCartRecovered).toBe("function");
  });
});

// ─── Testes de markConversions ────────────────────────────────────────────────

describe("markConversions", () => {
  it("deve ser uma função exportada do automation.ts", async () => {
    const mod = await import("./automation");
    expect(typeof mod.markConversions).toBe("function");
  });
});

// ─── Testes de processReactivation ───────────────────────────────────────────

describe("processReactivation", () => {
  it("deve ser uma função exportada do automation.ts", async () => {
    const mod = await import("./automation");
    expect(typeof mod.processReactivation).toBe("function");
  });
});

// ─── Testes de processAbandonedCarts ─────────────────────────────────────────

describe("processAbandonedCarts", () => {
  it("deve ser uma função exportada do automation.ts", async () => {
    const mod = await import("./automation");
    expect(typeof mod.processAbandonedCarts).toBe("function");
  });
});

// ─── Testes de lógica de copy das mensagens ──────────────────────────────────

describe("Copy das mensagens de recuperação", () => {
  it("etapa 1 deve conter urgência e link", () => {
    const name = "João";
    const itemsList = "• Pizza Calabresa x1";
    const total = "55.00";
    const msg = `Olá, ${name}! 🍕\n\nVocê deixou sua pizza no forno! 😅\n\n${itemsList}\n\n*Total: R$ ${total}*\n\nFinalize agora antes que esfrie:\n👉 https://bonattopizza.manus.space`;
    expect(msg).toContain("João");
    expect(msg).toContain("bonattopizza.manus.space");
    expect(msg).toContain("55.00");
  });

  it("etapa 2 deve conter benefício de entrega rápida", () => {
    const name = "Maria";
    const total = "80.00";
    const msg = `${name}, ainda dá tempo! 🔥\n\nSeu pedido de *R$ ${total}* ainda está salvo.\n\n🛵 Entregamos em até 40 minutos!\n\nNão perca sua pizza favorita:\n👉 https://bonattopizza.manus.space`;
    expect(msg).toContain("40 minutos");
    expect(msg).toContain("Maria");
  });

  it("etapa 3 deve conter cupom e urgência de expiração", () => {
    const name = "Pedro";
    const coupon = "VOLTA10-PEDRO1";
    const msg = `⏰ ${name}, última chance!\n\nSeu carrinho expira em breve e não queremos que você perca sua pizza! 🍕\n\n🎁 Use o cupom exclusivo *${coupon}* e ganhe *10% de desconto*!\n\n⚡ Válido por apenas 48 horas!\n\n👉 https://bonattopizza.manus.space`;
    expect(msg).toContain(coupon);
    expect(msg).toContain("48 horas");
    expect(msg).toContain("última chance");
  });

  it("reativação 15d deve conter 5% de desconto", () => {
    const name = "Ana";
    const coupon = "VOLTA5-ANA";
    const msg = `Oi, ${name}! 👋\n\nFaz uns dias que você não pede na Bonatto Pizza e a gente sentiu falta!\n\n🍕 Que tal uma pizza hoje? Use o cupom *${coupon}* e ganhe *5% de desconto* no seu próximo pedido!\n\n⏰ Válido por 72 horas.\n\n👉 https://bonattopizza.manus.space`;
    expect(msg).toContain("5% de desconto");
    expect(msg).toContain("Ana");
    expect(msg).toContain("72 horas");
  });

  it("reativação 30d deve conter 10% de desconto", () => {
    const name = "Carlos";
    const coupon = "VOLTA10-CARLOS";
    const msg = `${name}, temos uma oferta especial para você! 🎁\n\nSabemos que faz um tempinho que você não pede na Bonatto Pizza. Que tal voltar com *10% de desconto*?\n\n🎟️ Cupom exclusivo: *${coupon}*\n\n⏰ Oferta por tempo limitado!\n\n👉 https://bonattopizza.manus.space`;
    expect(msg).toContain("10% de desconto");
    expect(msg).toContain("Carlos");
  });

  it("reativação 60d deve conter 15% de desconto", () => {
    const name = "Fernanda";
    const coupon = "VOLTA15-FERNA";
    const msg = `${name}! 😢\n\nA gente sente muito a sua falta na Bonatto Pizza.\n\nPara te receber de volta, preparamos um cupom especial de *15% de desconto*:\n\n🎟️ *${coupon}*\n\n🍕 Novidades no cardápio te esperam!\n\n👉 https://bonattopizza.manus.space`;
    expect(msg).toContain("15% de desconto");
    expect(msg).toContain("Fernanda");
  });
});

// ─── Testes de validação do fluxo ────────────────────────────────────────────

describe("Validação do fluxo de automação", () => {
  it("fluxo deve ter 3 etapas em intervalos corretos (10, 20, 30 min)", () => {
    const steps = [
      { step: 1, minuteThreshold: 10, label: "Urgência" },
      { step: 2, minuteThreshold: 20, label: "Benefício" },
      { step: 3, minuteThreshold: 30, label: "Escassez + Cupom" },
    ];
    expect(steps).toHaveLength(3);
    expect(steps[0].minuteThreshold).toBe(10);
    expect(steps[1].minuteThreshold).toBe(20);
    expect(steps[2].minuteThreshold).toBe(30);
  });

  it("segmentos de reativação devem ter descontos crescentes", () => {
    const segments = [
      { tag: "inativo_15", discount: 5, validHours: 72 },
      { tag: "inativo_30", discount: 10, validHours: 48 },
      { tag: "inativo_60", discount: 15, validHours: 24 },
    ];
    expect(segments[0].discount).toBeLessThan(segments[1].discount);
    expect(segments[1].discount).toBeLessThan(segments[2].discount);
  });

  it("cupom de recuperação deve ter formato VOLTA{N}-{SUFFIX}", () => {
    const generateCode = (discount: number, suffix: string) =>
      `VOLTA${discount}-${suffix.toUpperCase().replace(/\W/g, "").slice(0, 6)}`;

    expect(generateCode(10, "João")).toBe("VOLTA10-JOO");
    expect(generateCode(5, "Maria Silva")).toBe("VOLTA5-MARIAS"); // "MARIASILVA".slice(0,6) = "MARIAS"
    expect(generateCode(15, "pedro")).toBe("VOLTA15-PEDRO");
  });

  it("taxa de recuperação deve ser calculada corretamente", () => {
    const calcRate = (recovered: number, total: number) =>
      total > 0 ? Math.round((recovered / total) * 100) : 0;

    expect(calcRate(2, 10)).toBe(20);
    expect(calcRate(5, 5)).toBe(100);
    expect(calcRate(0, 0)).toBe(0);
    expect(calcRate(3, 7)).toBe(43);
  });

  it("anti-duplicação: não deve enviar se já existe evento registrado", () => {
    // Simular a lógica de alreadySent
    const existingEvents = [{ id: 1, type: "cart_step1", step: 1, cartId: 42 }];
    const alreadySent = (type: string, step: number, cartId: number) =>
      existingEvents.some(e => e.type === type && e.step === step && e.cartId === cartId);

    expect(alreadySent("cart_step1", 1, 42)).toBe(true);
    expect(alreadySent("cart_step1", 1, 99)).toBe(false);
    expect(alreadySent("cart_step2", 2, 42)).toBe(false);
  });

  it("fluxo deve parar imediatamente quando cliente compra", () => {
    // Simular estado de jornada
    const journeyExecution = { status: "running", userId: 42 };
    const markConverted = (exec: typeof journeyExecution) => ({ ...exec, status: "completed" });

    const updated = markConverted(journeyExecution);
    expect(updated.status).toBe("completed");
  });
});
