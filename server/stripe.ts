import Stripe from "stripe";
import { Request, Response } from "express";
import { updateOrderPaymentStatus, createTransaction, getOrderById, updateStripeCustomerId, recordWebhookEventOnce } from "./db.ts";
import { notifyOwnerAdapter } from "./adapters/pushNotifications.ts";
// Alias para compatibilidade retroativa — passa pelo adapter
const notifyOwner = (payload: { title: string; content: string }) =>
  notifyOwnerAdapter({ title: payload.title, body: payload.content });
import { sendPushToAdmins } from "./push.ts";

// Lazy-init: não crasha no boot se `STRIPE_SECRET_KEY` não estiver setado.
// Isso permite rodar testes e o app em dev sem a credencial. O erro só
// aparece quando uma função que realmente precisa da Stripe é chamada.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe não configurado: defina STRIPE_SECRET_KEY.");
  }
  _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return _stripe;
}

// Proxy exportado para manter compatibilidade com código que usava `stripe`
// como uma instância já pronta.
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getStripe() as any)[prop];
  },
});

/**
 * Create a Stripe Checkout Session supporting card and Pix.
 */
export async function createCheckoutSession(opts: {
  orderId: number;
  amountInReais: number;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  orderDescription?: string;
}) {
  const amountInCents = Math.round(opts.amountInReais * 100);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "pix"],
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: {
            name: opts.orderDescription ?? `Pedido #${opts.orderId} — Bonatto Pizza`,
            description: "Pizza artesanal entregue na sua porta 🍕",
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    customer_email: opts.customerEmail ?? undefined,
    client_reference_id: String(opts.orderId),
    metadata: {
      orderId: String(opts.orderId),
      ...opts.metadata,
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    // Desabilita cupons Stripe-only — cupons são gerenciados pelo app Bonatto
    // para manter consistência com regras de negócio (limites, validade, clube).
    allow_promotion_codes: false,
    payment_method_options: {
      pix: { expires_after_seconds: 1800 },
    },
  });
  return session;
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: "Missing signature or webhook secret" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err?.message ?? err);
    // Do not leak internal error messages to the caller.
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

  // Idempotency: refuse to process the same event twice (Stripe retries on failure).
  try {
    const first = await recordWebhookEventOnce("stripe", event.id, event.type);
    if (!first) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping.`);
      return res.json({ received: true, duplicate: true });
    }
  } catch (err) {
    console.error("[Stripe Webhook] Failed to record event idempotency, proceeding with caution:", err);
    // Fall through: if DB is unavailable we still attempt to process; Stripe
    // will retry on 5xx. Never block payments on ledger outage.
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.orderId ? parseInt(pi.metadata.orderId) : null;
        if (orderId) {
          await updateOrderPaymentStatus(orderId, "paid", pi.id);
          await createTransaction({
            orderId,
            stripePaymentIntentId: pi.id,
            amount: (pi.amount / 100).toFixed(2),
            currency: pi.currency,
            status: "succeeded",
            paymentMethod: "credit_card",
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.orderId ? parseInt(pi.metadata.orderId) : null;
        if (orderId) {
          await updateOrderPaymentStatus(orderId, "failed", pi.id);
          await createTransaction({
            orderId,
            stripePaymentIntentId: pi.id,
            amount: (pi.amount / 100).toFixed(2),
            currency: pi.currency,
            status: "failed",
            paymentMethod: "credit_card",
          });
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId ? parseInt(session.metadata.orderId) : null;
        if (orderId && session.payment_status === "paid") {
          const paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? undefined;
          const paymentMethodLabel = session.payment_method_types?.includes("pix") ? "pix" : "card";

          await updateOrderPaymentStatus(orderId, "paid", paymentIntentId, session.id);
          await createTransaction({
            orderId,
            stripePaymentIntentId: paymentIntentId ?? session.id,
            amount: ((session.amount_total ?? 0) / 100).toFixed(2),
            currency: session.currency ?? "brl",
            status: "succeeded",
            paymentMethod: paymentMethodLabel,
          });

          const order = await getOrderById(orderId);
          if (order) {
            await notifyOwner({
              title: `✅ Pagamento confirmado — Pedido #${orderId}`,
              content: `**Cliente:** ${order.customerName}\n**Valor:** R$ ${((session.amount_total ?? 0) / 100).toFixed(2)}\n**Método:** ${paymentMethodLabel === "pix" ? "PIX" : "Cartão"}\n\nO pedido foi automaticamente confirmado e está aguardando preparo.`,
            }).catch(console.error);
            sendPushToAdmins({
              title: `✅ Pagamento confirmado — Pedido #${orderId}`,
              body: `${order.customerName} pagou R$ ${((session.amount_total ?? 0) / 100).toFixed(2)} via ${paymentMethodLabel === "pix" ? "PIX" : "Cartão"}`,
              url: "/admin",
              tag: `payment-${orderId}`,
            }).catch(console.error);
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
    return res.status(500).json({ error: "Internal server error" });
  }

  return res.json({ received: true });
}

// ─── Stripe Customer & Saved Cards ───────────────────────────────────────────

/**
 * Get or create a Stripe Customer for a user.
 * Saves the stripeCustomerId in the database for future use.
 */
export async function getOrCreateStripeCustomer(opts: {
  userId: number;
  stripeCustomerId?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  if (opts.stripeCustomerId) {
    return opts.stripeCustomerId;
  }
  const customer = await stripe.customers.create({
    email: opts.email ?? undefined,
    name: opts.name ?? undefined,
    metadata: { userId: String(opts.userId) },
  });
  await updateStripeCustomerId(opts.userId, customer.id);
  return customer.id;
}

/**
 * Create a SetupIntent to allow the customer to save a card without charging.
 */
export async function createSetupIntent(stripeCustomerId: string) {
  return stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });
}

/**
 * List saved payment methods (cards) for a Stripe Customer.
 */
export async function listSavedCards(stripeCustomerId: string) {
  const pms = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
  });
  return pms.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "unknown",
    last4: pm.card?.last4 ?? "0000",
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
    funding: pm.card?.funding ?? "credit",
  }));
}

/**
 * Detach (remove) a saved payment method from a Stripe Customer.
 */
export async function detachPaymentMethod(paymentMethodId: string) {
  return stripe.paymentMethods.detach(paymentMethodId);
}

/**
 * Create a Checkout Session with a saved card (off_session payment).
 */
export async function createCheckoutSessionWithSavedCard(opts: {
  orderId: number;
  amountInReais: number;
  stripeCustomerId: string;
  paymentMethodId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const amountInCents = Math.round(opts.amountInReais * 100);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: opts.stripeCustomerId,
    payment_method_types: ["card"],
    payment_method_collection: "if_required",
    saved_payment_method_options: { payment_method_save: "disabled" },
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: {
            name: `Pedido #${opts.orderId} — Bonatto Pizza`,
            description: "Pizza artesanal entregue na sua porta 🍕",
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    client_reference_id: String(opts.orderId),
    metadata: {
      orderId: String(opts.orderId),
      ...opts.metadata,
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  return session;
}

/**
 * Create a Stripe PaymentIntent.
 * @param amountInReais - Amount in BRL reais (e.g. 50.00 for R$50)
 */
export async function createPaymentIntent(
  amountInReais: number,
  currency: string = "brl",
  metadata?: Record<string, string>
) {
  // Convert reais to centavos for Stripe (Stripe expects smallest currency unit)
  const amountInCents = Math.round(amountInReais * 100);
  return stripe.paymentIntents.create({
    amount: amountInCents,
    currency,
    metadata: metadata ?? {},
    automatic_payment_methods: { enabled: true },
  });
}
