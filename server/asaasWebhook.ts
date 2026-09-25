import type { Request, Response } from "express";

import { notifyOwnerAdapter } from "./adapters/pushNotifications.ts";
import { verifyAsaasWebhook } from "./asaas.ts";
import { createTransaction, updateOrderPaymentStatus } from "./db.ts";
import { executeWebhookEvent } from "./webhookLifecycle.ts";

type AsaasWebhookEvent = {
  id?: string;
  event: string;
  payment?: {
    id: string;
    externalReference?: string;
    value?: number;
    netValue?: number;
    status?: string;
  };
};

export async function handleAsaasWebhook(req: Request, res: Response) {
  const token = (req.headers["asaas-access-token"] as string) ?? "";
  if (!verifyAsaasWebhook(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const event = req.body as AsaasWebhookEvent;
  if (!event?.id || !event.event) {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  console.log(`[Asaas Webhook] Event: ${event.event} | ID: ${event.id}`);

  try {
    const lifecycle = await executeWebhookEvent({
      provider: "asaas",
      eventId: event.id,
      eventType: event.event,
      execute: async () => {
        if (
          (event.event === "PAYMENT_RECEIVED" || event.event === "PAYMENT_CONFIRMED")
          && event.payment
        ) {
          const orderId = event.payment.externalReference
            ? parseInt(event.payment.externalReference, 10)
            : null;
          if (!orderId || Number.isNaN(orderId)) return;

          await updateOrderPaymentStatus(
            orderId,
            "paid",
            undefined,
            undefined,
            event.payment.id,
          );
          await createTransaction({
            orderId,
            stripePaymentIntentId: event.payment.id,
            amount: String(event.payment.value ?? 0),
            currency: "brl",
            status: "succeeded",
            paymentMethod: "pix",
            metadata: JSON.stringify({
              asaasPaymentId: event.payment.id,
              netValue: event.payment.netValue,
            }),
          });

          notifyOwnerAdapter({
            title: `PIX confirmado - Pedido #${orderId}`,
            body: `Pagamento de R$ ${(event.payment.value ?? 0).toFixed(2)} recebido via Asaas.`,
          }).catch(console.error);
        }
      },
    });

    if (lifecycle.state === "duplicate") {
      return res.json({ received: true, duplicate: true });
    }
    if (lifecycle.state === "processing") {
      return res.status(503).json({ error: "Event already processing" });
    }
    return res.json({ received: true });
  } catch (error) {
    console.error("[Asaas Webhook] Error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}
