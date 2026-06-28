/**
 * automation.v71.test.ts
 * Testes para as novas funcionalidades do Workflow Builder (v71):
 * - Novos triggers: rating_negative, first_order_month, tag_inativo_custom
 * - Novos step types: pause_journey, notify_admin
 * - Exit condition (exitOnOrder)
 * - daysInactive configurável
 * - getAbStats, getGlobalMetrics, getCustomerJourneyHistory
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers.ts";
import type { TrpcContext } from "./_core/context.ts";

// ─── Mock automation module ───────────────────────────────────────────────────
vi.mock("./automation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./automation.ts")>();
  return {
    ...actual,
    listJourneys: vi.fn().mockResolvedValue([]),
    createJourney: vi.fn().mockResolvedValue(42),
    updateJourney: vi.fn().mockResolvedValue(undefined),
    deleteJourney: vi.fn().mockResolvedValue(undefined),
    duplicateJourney: vi.fn().mockResolvedValue({ id: 43 }),
    listExecutions: vi.fn().mockResolvedValue([]),
    processJourneyExecutions: vi.fn().mockResolvedValue(undefined),
    getExecutionLogs: vi.fn().mockResolvedValue(null),
  };
});

// ─── Mock DB for stats/history queries ───────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db.ts")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null), // null = safe early return in procedures
  };
});

// ─── Admin context helper ─────────────────────────────────────────────────────
function createAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "owner-open-id",
      email: "admin@bonatto.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Workflow Builder v71 — novos triggers e steps", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createAdminCtx());
    vi.clearAllMocks();
  });

  // ── Novos triggers ──────────────────────────────────────────────────────────
  it("createJourney aceita trigger rating_negative", async () => {
    const result = await caller.automations.createJourney({
      name: "Avaliação Negativa",
      description: "",
      trigger: "rating_negative",
      steps: [],
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("createJourney aceita trigger first_order_month", async () => {
    const result = await caller.automations.createJourney({
      name: "Primeiro Pedido do Mês",
      description: "",
      trigger: "first_order_month",
      steps: [],
    });
    expect(result).toHaveProperty("id");
  });

  it("createJourney aceita trigger tag_inativo_custom com daysInactive", async () => {
    const result = await caller.automations.createJourney({
      name: "Inativo 20 dias",
      description: "",
      trigger: "tag_inativo_custom",
      steps: [],
      daysInactive: 20,
    });
    expect(result).toHaveProperty("id");
  });

  it("createJourney com daysInactive zero retorna id", async () => {
    // daysInactive é opcional (não há validação min no schema atual)
    const result = await caller.automations.createJourney({
      name: "Inativo Padrão",
      description: "",
      trigger: "tag_inativo_custom",
      steps: [],
      daysInactive: 0,
    });
    expect(result).toHaveProperty("id");
  });

  // ── Exit Condition ──────────────────────────────────────────────────────────
  it("createJourney aceita exitOnOrder true", async () => {
    const result = await caller.automations.createJourney({
      name: "Reativação com saída",
      description: "",
      trigger: "tag_inativo_30",
      steps: [],
      exitOnOrder: true,
    });
    expect(result).toHaveProperty("id");
  });

  // ── Novos step types ────────────────────────────────────────────────────────
  it("updateJourney aceita step pause_journey", async () => {
    const result = await caller.automations.updateJourney({
      id: 1,
      steps: [
        {
          id: "step-pause",
          type: "pause_journey",
          label: "Encerrar jornada",
        },
      ],
    });
    expect(result).toEqual({ ok: true });
  });

  it("updateJourney aceita step notify_admin com prioridade", async () => {
    const result = await caller.automations.updateJourney({
      id: 1,
      steps: [
        {
          id: "step-notify",
          type: "notify_admin",
          label: "Tarefa Admin",
          adminTaskTitle: "Ligar para cliente VIP",
          adminTaskPriority: "high",
        },
      ],
    });
    expect(result).toEqual({ ok: true });
  });

  it("updateJourney aceita step send_coupon com validade", async () => {
    const result = await caller.automations.updateJourney({
      id: 1,
      steps: [
        {
          id: "step-coupon",
          type: "send_coupon",
          label: "Enviar cupom",
          discountType: "percentage",
          discountValue: 15,
          couponExpiryDays: 7,
        },
      ],
    });
    expect(result).toEqual({ ok: true });
  });

  it("updateJourney aceita step update_loyalty com pontos negativos (remoção)", async () => {
    const result = await caller.automations.updateJourney({
      id: 1,
      steps: [
        {
          id: "step-loyalty",
          type: "update_loyalty",
          label: "Remover pontos",
          loyaltyPoints: -50,
          loyaltyDescription: "Penalidade por cancelamento",
        },
      ],
    });
    expect(result).toEqual({ ok: true });
  });

  it("updateJourney aceita step split_ab com canal push", async () => {
    const result = await caller.automations.updateJourney({
      id: 1,
      steps: [
        {
          id: "step-ab",
          type: "split_ab",
          label: "Teste A/B",
          messageA: "Olá {nome}, temos uma oferta!",
          messageB: "Ei {nome}, não perca essa promoção!",
          splitChannel: "push",
        },
      ],
    });
    expect(result).toEqual({ ok: true });
  });

  // ── Stats e histórico (retornam vazio com DB null) ──────────────────────────
  it("getAbStats retorna zeros quando DB indisponível", async () => {
    const result = await caller.automations.getAbStats({ journeyId: 1 });
    expect(result).toHaveProperty("groupA");
    expect(result).toHaveProperty("groupB");
    expect(result.groupA).toBe(0);
    expect(result.groupB).toBe(0);
  });

  it("getGlobalMetrics retorna estrutura válida quando DB indisponível", async () => {
    const result = await caller.automations.getGlobalMetrics();
    expect(result).toHaveProperty("totalExecutions");
    expect(result).toHaveProperty("completedExecutions");
    expect(result).toHaveProperty("conversionRate");
    expect(result).toHaveProperty("attributedRevenue");
    expect(result).toHaveProperty("activeJourneys");
    expect(result).toHaveProperty("topJourneys");
    expect(Array.isArray(result.topJourneys)).toBe(true);
    expect(result.totalExecutions).toBe(0);
  });

  it("getCustomerJourneyHistory retorna array vazio quando DB indisponível", async () => {
    const result = await caller.automations.getCustomerJourneyHistory({ userId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  // ── Validação Zod ───────────────────────────────────────────────────────────
  it("createJourney rejeita trigger inválido", async () => {
    await expect(
      caller.automations.createJourney({
        name: "Inválido",
        description: "",
        trigger: "trigger_inexistente" as never,
        steps: [],
      })
    ).rejects.toThrow();
  });

  it("updateJourney rejeita step type inválido", async () => {
    await expect(
      caller.automations.updateJourney({
        id: 1,
        steps: [{ id: "s1", type: "tipo_inexistente" as never, label: "Inválido" }],
      })
    ).rejects.toThrow();
  });
});
