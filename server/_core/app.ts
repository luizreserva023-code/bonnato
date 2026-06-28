import express, { type Express } from "express";
import { type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { notifyOwnerAdapter } from "../adapters/pushNotifications.ts";
import { verifyAsaasWebhook } from "../asaas.ts";
import { handleAutomationWebhook } from "../automationWebhook.ts";
import { createTransaction, recordWebhookEventOnce, updateOrderPaymentStatus } from "../db.ts";
import { appRouter } from "../routers.ts";
import { handleStripeWebhook } from "../stripe.ts";
import { registerBootstrapRoute } from "./bootstrapRoute.ts";
import { createContext } from "./context.ts";
import { registerOAuthRoutes } from "./oauth.ts";
import { registerStorageProxy } from "./storageProxy.ts";

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisicoes. Tente novamente em alguns minutos." },
  skip: (req) => req.path.startsWith("/api/stripe/webhook"),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Muitas tentativas de autenticacao. Aguarde 15 minutos." },
});

const criticalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de operacoes atingido. Tente novamente em breve." },
});

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos uploads em pouco tempo. Aguarde alguns minutos." },
});

const messagingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas acoes de mensagens ou notificacoes. Tente novamente em instantes." },
});

const bootstrapLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite temporario atingido para bootstrap administrativo." },
});

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de autenticacao social. Aguarde alguns minutos." },
});

type FrontendMode = "vite" | "static" | "none";

export type ConfigureAppOptions = {
  frontendMode?: FrontendMode;
  server?: Server;
};

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function buildAllowedHosts(publicAppUrl: string, hostHeader: string | undefined): Set<string> {
  const allowedHosts = new Set<string>();

  if (publicAppUrl) {
    const hostname = hostnameOf(publicAppUrl);
    if (hostname) allowedHosts.add(hostname);
  }

  if (hostHeader) {
    allowedHosts.add(hostHeader.split(":")[0].toLowerCase());
  }

  return allowedHosts;
}

export async function configureApp(app: Express, options: ConfigureAppOptions = {}): Promise<Express> {
  const frontendMode = options.frontendMode ?? (process.env.NODE_ENV === "development" ? "vite" : "static");
  const publicAppUrl = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: { action: "sameorigin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      noSniff: true,
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
      xssFilter: true,
    })
  );

  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  app.post("/api/automations/webhook/:token", handleAutomationWebhook);
  app.post("/api/asaas/webhook", express.json({ limit: "256kb" }), async (req, res) => {
    try {
      const token = (req.headers["asaas-access-token"] as string) ?? "";
      if (!verifyAsaasWebhook(token)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const event = req.body as {
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

      console.log(`[Asaas Webhook] Event: ${event.event} | ID: ${event.id ?? "?"}`);

      if (event.id) {
        try {
          const first = await recordWebhookEventOnce("asaas", event.id, event.event);
          if (!first) {
            return res.json({ received: true, duplicate: true });
          }
        } catch (error) {
          console.error("[Asaas Webhook] idempotency ledger failed:", error);
        }
      }

      if ((event.event === "PAYMENT_RECEIVED" || event.event === "PAYMENT_CONFIRMED") && event.payment) {
        const orderId = event.payment.externalReference ? parseInt(event.payment.externalReference, 10) : null;
        if (orderId && !Number.isNaN(orderId)) {
          await updateOrderPaymentStatus(orderId, "paid", undefined, undefined, event.payment.id);
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
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("[Asaas Webhook] Error:", error);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.use("/api/trpc", (req, res, next) => {
    if (req.method !== "POST") {
      return next();
    }

    const origin = (req.headers.origin as string | undefined) ?? "";
    const referer = (req.headers.referer as string | undefined) ?? "";
    const allowedHosts = buildAllowedHosts(publicAppUrl, req.headers.host);
    const originHost = origin ? hostnameOf(origin) : null;
    const refererHost = referer ? hostnameOf(referer) : null;

    if (!origin && !referer) {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Origin obrigatorio" });
      }

      return next();
    }

    const checkHost = origin ? originHost : refererHost;
    if (!checkHost || !allowedHosts.has(checkHost)) {
      return res.status(403).json({ error: "Origin nao autorizado" });
    }

    return next();
  });

  app.use("/api/trpc", express.json({ limit: "6mb" }));
  app.use("/api/trpc", express.urlencoded({ limit: "6mb", extended: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));

  app.use("/api/bootstrap/access", bootstrapLimiter);
  app.use("/api/oauth", oauthLimiter);
  app.use("/api", globalLimiter);

  const authProcedures = new Set([
    "auth.loginEmail",
    "auth.registerEmail",
    "auth.forgotPassword",
    "auth.resetPassword",
  ]);
  const criticalProcedures = new Set([
    "orders.create",
    "coupons.validate",
    "payments.createIntent",
    "payments.createCheckoutSession",
    "payments.checkoutWithSavedCard",
    "club.subscribe",
    "asaas.createPix",
  ]);
  const uploadProcedures = new Set([
    "avatar.upload",
    "products.uploadImage",
    "menuSlides.uploadImage",
    "carousel.uploadImage",
  ]);
  const messagingProcedures = new Set([
    "chat.send",
    "push.subscribe",
    "push.unsubscribe",
    "drivers.savePushSubscription",
    "drivers.removePushSubscription",
  ]);

  const applyLimiter =
    (limiter: ReturnType<typeof rateLimit>, match: (proc: string) => boolean) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const raw = req.path.replace(/^\/+/, "");
      const procedures = raw.split(",").map((procedure) => procedure.trim()).filter(Boolean);

      if (procedures.some(match)) {
        return limiter(req, res, next);
      }

      return next();
    };

  app.use("/api/trpc", applyLimiter(authLimiter, (procedure) => authProcedures.has(procedure)));
  app.use("/api/trpc", applyLimiter(criticalLimiter, (procedure) => criticalProcedures.has(procedure)));
  app.use("/api/trpc", applyLimiter(uploadLimiter, (procedure) => uploadProcedures.has(procedure)));
  app.use("/api/trpc", applyLimiter(messagingLimiter, (procedure) => messagingProcedures.has(procedure)));

  registerBootstrapRoute(app);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (frontendMode === "vite") {
    if (!options.server) {
      throw new Error("configureApp requires an HTTP server when frontendMode is 'vite'");
    }

    const { setupVite } = await import("./vite.ts");
    await setupVite(app, options.server);
  } else if (frontendMode === "static") {
    const { serveStatic } = await import("./vite.ts");
    serveStatic(app);
  }

  return app;
}
