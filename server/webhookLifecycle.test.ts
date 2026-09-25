import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimWebhookEvent: vi.fn(),
  completeWebhookEvent: vi.fn(),
  failWebhookEvent: vi.fn(),
}));

vi.mock("./db.ts", () => mocks);

import { executeWebhookEvent } from "./webhookLifecycle.ts";

describe("webhook lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimWebhookEvent.mockResolvedValue("claimed");
    mocks.completeWebhookEvent.mockResolvedValue(undefined);
    mocks.failWebhookEvent.mockResolvedValue(undefined);
  });

  it("marks as processed only after handler succeeds", async () => {
    const execute = vi.fn().mockResolvedValue("ok");
    const result = await executeWebhookEvent({
      provider: "stripe",
      eventId: "evt_1",
      eventType: "payment_intent.succeeded",
      execute,
    });
    expect(result).toEqual({ state: "processed", value: "ok" });
    expect(execute).toHaveBeenCalledOnce();
    expect(mocks.completeWebhookEvent).toHaveBeenCalledWith("stripe", "evt_1");
    expect(mocks.failWebhookEvent).not.toHaveBeenCalled();
  });

  it("does not execute an already processed duplicate", async () => {
    mocks.claimWebhookEvent.mockResolvedValue("duplicate");
    const execute = vi.fn();

    const result = await executeWebhookEvent({
      provider: "asaas",
      eventId: "pay_1",
      execute,
    });

    expect(result).toEqual({ state: "duplicate" });
    expect(execute).not.toHaveBeenCalled();
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
  });
  it("marks the event failed when business processing throws", async () => {
    const error = new Error("database unavailable");
    const execute = vi.fn().mockRejectedValue(error);

    await expect(executeWebhookEvent({
      provider: "stripe",
      eventId: "evt_retry",
      execute,
    })).rejects.toThrow("database unavailable");

    expect(mocks.failWebhookEvent).toHaveBeenCalledWith(
      "stripe",
      "evt_retry",
      error,
    );
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
  });
});
