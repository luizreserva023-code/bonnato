import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  type WebhookEventClaim,
} from "./db.ts";

export type WebhookProvider = "stripe" | "asaas";

export type WebhookLifecycleResult<T> =
  | { state: "processed"; value: T }
  | { state: Exclude<WebhookEventClaim, "claimed"> };

export async function executeWebhookEvent<T>(input: {
  provider: WebhookProvider;
  eventId: string;
  eventType?: string;
  execute: () => Promise<T>;
}): Promise<WebhookLifecycleResult<T>> {
  const claim = await claimWebhookEvent(
    input.provider,
    input.eventId,
    input.eventType,
  );

  if (claim !== "claimed") {
    return { state: claim };
  }
  try {
    const value = await input.execute();
    await completeWebhookEvent(input.provider, input.eventId);
    return { state: "processed", value };
  } catch (error) {
    try {
      await failWebhookEvent(input.provider, input.eventId, error);
    } catch (ledgerError) {
      console.error("[WebhookLifecycle] Failed to mark event as failed", {
        provider: input.provider,
        eventId: input.eventId,
        ledgerError,
      });
    }
    throw error;
  }
}
