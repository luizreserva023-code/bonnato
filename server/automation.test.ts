import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers.ts";
import type { TrpcContext } from "./_core/context.ts";

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
    const result = await caller.automations.listJourneys();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("trigger");
  });

  it("createJourney returns new journey id", async () => {
    const result = await caller.automations.createJourney({
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
      id: 1,
      steps: [{ id: "step-1", type: "send_whatsapp", label: "Msg 1", message: "Olá {nome}!" }],
    });
    expect(result).toEqual({ ok: true });
  });

  it("toggleJourney sets status to active", async () => {
    const result = await caller.automations.toggleJourney({
      id: 1,
      status: "active",
    });
    expect(result).toEqual({ ok: true });
  });

  it("toggleJourney sets status to paused", async () => {
    const result = await caller.automations.toggleJourney({
      id: 1,
      status: "paused",
    });
    expect(result).toEqual({ ok: true });
  });

  it("listExecutions returns array", async () => {
    const result = await caller.automations.listExecutions({ journeyId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("processExecutions returns ok", async () => {
    const result = await caller.automations.processExecutions();
    expect(result).toEqual({ ok: true });
  });

  it("deleteJourney returns ok", async () => {
    const result = await caller.automations.deleteJourney({ id: 1 });
    expect(result).toEqual({ ok: true });
  });

  it("duplicateJourney returns new id", async () => {
    const result = await caller.automations.duplicateJourney({ id: 1 });
    expect(result).toHaveProperty("id");
  });
});
