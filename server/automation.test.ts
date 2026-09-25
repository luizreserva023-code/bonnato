import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers.ts";
import type { TrpcContext } from "./_core/context.ts";
// Estes testes isolam o Workflow Builder. O isolamento/autorização por loja
// possui suíte própria em storeUtils.test.ts.
vi.mock("./storeUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storeUtils.ts")>();
  return {
    ...actual,
    resolveStoreId: vi.fn(async (_user: unknown, requestedStoreId?: number) => requestedStoreId),
    resolveRequiredStoreId: vi.fn(async (_user: unknown, requestedStoreId?: number) => requestedStoreId ?? 1),
    assertStoreEntityAccess: vi.fn(async () => undefined),
  };
});


// ─── Mock DB calls ────────────────────────────────────────────────────────────
vi.mock("./automation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./automation.ts")>();
  return {
    ...actual,
    listJourneys: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "Teste",
        description: "",
        trigger: "checkout_abandoned",
        status: "draft",
        steps: "[]",
        webhookToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        execCount: 0,
        lastRunAt: null,
      },
    ]),
    createJourney: vi.fn().mockResolvedValue(99),
    updateJourney: vi.fn().mockResolvedValue(undefined),
    deleteJourney: vi.fn().mockResolvedValue(undefined),
    duplicateJourney: vi.fn().mockResolvedValue({ id: 100 }),
    listExecutions: vi.fn().mockResolvedValue([]),
    processJourneyExecutions: vi.fn().mockResolvedValue(undefined),
    getExecutionLogs: vi.fn().mockResolvedValue(null),
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
describe("automations router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createAdminCtx());
  });

  it("listJourneys returns journey list", async () => {
    const result = await caller.automations.listJourneys({ storeId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("trigger");
  });

  it("createJourney returns new journey id", async () => {
    const result = await caller.automations.createJourney({
      storeId: 1,
      name: "Nova Jornada",
      description: "",
      trigger: "checkout_abandoned",
      steps: [],
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number"); // router wraps the number in { id }
  });

  it("updateJourney accepts steps array", async () => {
    const result = await caller.automations.updateJourney({
      storeId: 1,
      id: 1,
      steps: [{ id: "step-1", type: "send_whatsapp", label: "Msg 1", message: "Olá {nome}!" }],
    });
    expect(result).toEqual({ ok: true });
  });

  it("toggleJourney sets status to active", async () => {
    const result = await caller.automations.toggleJourney({
      storeId: 1,
      id: 1,
      status: "active",
    });
    expect(result).toEqual({ ok: true });
  });

  it("toggleJourney sets status to paused", async () => {
    const result = await caller.automations.toggleJourney({
      storeId: 1,
      id: 1,
      status: "paused",
    });
    expect(result).toEqual({ ok: true });
  });

  it("listExecutions returns array", async () => {
    const result = await caller.automations.listExecutions({ storeId: 1, journeyId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("processExecutions returns ok", async () => {
    const result = await caller.automations.processExecutions({ storeId: 1 });
    expect(result).toEqual({ ok: true });
  });

  it("deleteJourney returns ok", async () => {
    const result = await caller.automations.deleteJourney({ storeId: 1, id: 1 });
    expect(result).toEqual({ ok: true });
  });

  it("duplicateJourney returns new id", async () => {
    const result = await caller.automations.duplicateJourney({ storeId: 1, id: 1 });
    expect(result).toHaveProperty("id");
  });
});
