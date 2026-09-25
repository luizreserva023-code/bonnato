import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { handleAsaasWebhook } from "../asaasWebhook.ts";
import { handleAutomationWebhook } from "../automationWebhook.ts";
import { registerImageUploadRoute } from "../imageUpload.ts";
import { registerOrderRealtimeRoutes } from "../realtime/orderSse.ts";
import { registerPostalCodeRoute } from "../postalCode.ts";
import { appRouter } from "../routers.ts";
import { handleStripeWebhook } from "../stripe.ts";
import { registerBootstrapRoute } from "./bootstrapRoute.ts";
import { createContext } from "./context.ts";
import { registerOAuthRoutes } from "./oauth.ts";
import { registerStorageProxy } from "./storageProxy.ts";
import { registerHealthRoutes } from "./healthRoutes.ts";
import { requestContextMiddleware } from "./requestContext.ts";

function isAnalyticsOnlyRequest(rawUrl: string) {
  const path = rawUrl.split("?")[0] ?? "";
  const marker = "/api/trpc/";
  const markerIndex = path.indexOf(marker);
  if (markerIndex < 0) return false;

  const procedures = path
    .slice(markerIndex + marker.length)
    .split(",")
    .map((procedure) => procedure.trim())
    .filter(Boolean);

  return procedures.length > 0 && procedures.every((procedure) => procedure === "analytics.track");
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisicoes. Tente novamente em alguns minutos." },
  skip: (req) =>
    req.path.startsWith("/api/stripe/webhook")
    || isAnalyticsOnlyRequest(req.originalUrl || req.url),
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite temporario de telemetria atingido." },
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

const cepLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas consultas de CEP. Aguarde alguns minutos." },
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

  for (const configuredHost of (process.env.ALLOWED_ORIGIN_HOSTS ?? "").split(",")) {
    const value = configuredHost.trim().toLowerCase();
    if (!value) continue;
    const hostname = value.includes("://") ? hostnameOf(value) : value.split(":")[0];
    if (hostname) allowedHosts.add(hostname);
  }

  return allowedHosts;
}

export async function configureApiApp(app: Express): Promise<Express> {
  const publicAppUrl = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestContextMiddleware);

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

  registerHealthRoutes(app);

  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  app.post("/api/automations/webhook/:token", handleAutomationWebhook);
  app.post("/api/asaas/webhook", express.json({ limit: "256kb" }), handleAsaasWebhook);
  registerImageUploadRoute(app, uploadLimiter);
  registerOrderRealtimeRoutes(app);
  registerPostalCodeRoute(app, cepLimiter);

  app.use("/api/trpc", (req, res, next) => {
    if (req.method !== "POST" && req.method !== "GET") {
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

  app.use("/api/trpc", express.json({ limit: "8mb" }));
  app.use("/api/trpc", express.urlencoded({ limit: "8mb", extended: true }));
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
    "auth.verifyTwoFactor",
  ]);
  const criticalProcedures = new Set([
    "orders.create",
    "coupons.validate",
    "payments.createIntent",
    "payments.createCheckoutSession",
    "payments.checkoutWithSavedCard",
    "club.subscribe",
    "asaas.createPix",
    "auth.syncSocialAccount",
    "auth.disconnectSocialAccount",
    "auth.deleteAccount",
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

  app.use("/api/trpc", applyLimiter(analyticsLimiter, (procedure) => procedure === "analytics.track"));
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

  return app;
}
