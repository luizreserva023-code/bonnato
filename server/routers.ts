import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { journeys, journeyExecutions, orders } from "../drizzle/schema";
import { eq, gte, desc, inArray, and, lt, ne } from "drizzle-orm";
import { clubRouter } from "./routers/club";
import { storesRouter } from "./routers/stores";
import { z } from "zod";
import { savePushSubscription, removePushSubscription, sendPushToAdmins, sendPushToUser, sendPushToAllUsers, sendPushToDriver } from "./push";
import { sendWhatsApp, WhatsAppTemplates } from "./whatsapp";
import {
  getAllDeliveryZones,
  getDeliveryZoneByNeighborhood,
  searchDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  getMenuSlides,
  createMenuSlide,
  updateMenuSlide,
  deleteMenuSlide,
  seedMenuSlides,
  createScheduledNotification,
  listScheduledNotifications,
  cancelScheduledNotification,
  deleteScheduledNotification,
  getCarouselImages,
  createCarouselImage,
  updateCarouselImage,
  deleteCarouselImage,
} from "./db";
import { getTodayStartUtc, getTodayEndUtc, getBrasilTzOffset } from "../shared/timezone";
import {
  listJourneys,
  getJourneyById,
  createJourney,
  updateJourney,
  deleteJourney,
  listExecutions,
  cancelExecution,
  listAbandonedCarts,
  getAllCustomerTagsWithUsers,
  startJourneyExecution,
  refreshCustomerTags,
  registerAbandonedCart,
  duplicateJourney,
  processJourneyExecutions,
  fireJourneyTrigger,
  markConversions,
  processReactivation,
  type JourneyStep,
} from "./automation";
import {
  createCategory,
  createCoupon,
  createOrder,
  createPromotion,
  createRaffle,
  createTransaction,
  createUpsell,
  createUserCoupon,
  deleteCategory,
  deleteProduct,
  deletePromotion,
  deleteUpsell,
  drawRaffleWinner,
  enterRaffle,
  getActivePromotions,
  getActiveRaffles,
  getActiveUpsells,
  getAllCoupons,
  getAllOrders,
  getAllPromotions,
  getAllRaffles,
  getAllUpsells,
  getAllUsers,
  getCategories,
  getCategoryById,
  getCouponByCode,
  getCouponsByUser,
  getDailyRevenue,
  getOrderById,
  getOrderItems,
  getOrdersByPeriod,
  getOrdersByUser,
  getProductById,
  getProducts,
  getProductsByIds,
  getRaffleEntries,
  getSalesReport,
  getTopProducts,
  getTopCategories,
  getUserById,
  getUpsellsForCart,
  incrementCouponUsage,
  updateCategory,
  updateCoupon,
  updateOrderPaymentStatus,
  updateOrderStatus,
  setOrderAiPaused,
  updateProduct,
  updatePromotion,
  updateRaffle,
  updateUpsell,
  updateUserProfile,
  createProduct,
} from "./db";
import { COOKIE_NAME, DEFAULT_SESSION_MS } from "@shared/const";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router, staffProcedure } from "./_core/trpc";
import { resolveStoreId } from "./storeUtils";
import { notifyOwnerAdapter } from "./adapters/pushNotifications";
// Alias para compatibilidade retroativa — passa pelo adapter
const notifyOwner = (payload: { title: string; content: string }) =>
  notifyOwnerAdapter({ title: payload.title, body: payload.content });
import { createPaymentIntent, createCheckoutSession, getOrCreateStripeCustomer, createSetupIntent, listSavedCards, detachPaymentMethod, createCheckoutSessionWithSavedCard } from "./stripe";
import {
  cancelIfoodOrder,
  confirmIfoodOrder,
  dispatchIfoodOrder,
  listIfoodMerchants,
  startPreparationIfoodOrder,
  syncIfoodCatalog,
  syncIfoodPromotions,
} from "./ifood";
import { emitirNfce, cancelarNfce } from "./focusnfe";
import { getOrCreateAsaasCustomer, createPixCharge, getChargeStatus } from "./asaas";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./_core/mailer";
import {
  getUserByEmail,
  createEmailUser,
  updateUserPasswordHash,
  saveResetToken,
  getUserByResetToken,
  clearResetToken,
  getAllStoreSettings,
  setStoreSetting,
  getAllDrivers,
  getDriverByToken,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  assignDriverToOrder,
  upsertDriverLocation,
  getDriverLocation,
  getDriverLocationByOrder,
  getAllActiveDriverLocations,
  submitDeliveryRating,
  getRatingByOrder,
  getDriverRatings,
  getDriverAverageRating,
  getDriverDeliveryHistory,
  saveDriverPushSubscription,
  removeDriverPushSubscription,
  getDriverTodayStats,
  getDriverActiveOrderDetails,
  getDriverAssignedOrders,
  driverConfirmDelivery,
  getDriverTodayDeliveries,
  getUserAddresses,
  createUserAddress,
  updateUserAddress,
  deleteUserAddress,
  getUserFavorites,
  toggleFavorite,
  getClientNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  createClientNotification,
  addLoyaltyPoints,
  deductLoyaltyPoints,
  deductLoyaltyPointsAtomic,
  creditLoyaltyForOrderIdempotent,
  refundLoyaltyPointsForOrder,
  registerCouponRedemption,
  revertCouponRedemption,
  updateOrderStatusGuarded,
  getUserLoyaltyPoints,
  getLoyaltyHistory,
  updateUserAvatar,
  getUserSpendingHistory,
  getOrderMessages,
  getOrdersWithMessages,
  sendOrderMessage,
  markMessagesRead,
  getUnreadCountForOrder,
  getTotalUnreadForAdmin,
  getTotalUnreadForUser,
  getCrmCustomers,
  countCrmCustomers,
  getCrmCustomerDetail,
  getCrmCustomersByTag,
  assignTagToCustomer,
  removeTagFromCustomer,
  getTagsForCustomer,
  listCustomTags,
  createCustomTag,
  updateCustomTag,
  deleteCustomTag,
  assignCustomTagToCustomer,
  removeCustomTagFromCustomer,
  getCustomTagsForCustomer,
  getCustomersByCustomTagName,
  getJourneyExecutionsByUser,
  getAbandonedCartsByUser,
  getCrmStats,
  getTransactionsByUser,
  listNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  pickRandomTemplate,
  seedNotificationTemplates,
  getSalesOverview,
  getSalesTimeSeries,
  getRecentOrdersFeed,
  createClientAlert,
  listClientAlerts,
  dismissClientAlert,
  countUnreadClientAlerts,
} from "./db";

// Admin guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});

// --- SEED DATA ----------------------------------------------------------------
async function seedMenuData() {
  const cats = await getCategories(false);
  if (cats.length > 0) return; // already seeded

  const categoryData = [
    { name: "Promoções", slug: "promocoes", description: "Ofertas especiais da Bonatto", sortOrder: 1 },
    { name: "Pizzas", slug: "pizzas", description: "Nossas deliciosas pizzas artesanais", sortOrder: 2 },
    { name: "Calzones", slug: "calzones", description: "Duplonatto - nossa versão especial de calzone", sortOrder: 3 },
    { name: "Lasanhas", slug: "lasanhas", description: "Lasanhas caseiras com massa fresca", sortOrder: 4 },
    { name: "Empanados", slug: "empanados", description: "Empanados da Bonatto", sortOrder: 5 },
    { name: "Sorvetes", slug: "sorvetes", description: "Sorvetes artesanais", sortOrder: 6 },
    { name: "Bebidas", slug: "bebidas", description: "Refrigerantes e sucos", sortOrder: 7 },
    { name: "Extras", slug: "extras", description: "Molhos e acompanhamentos", sortOrder: 8 },
  ];

  for (const cat of categoryData) {
    await createCategory({ ...cat, active: true });
  }

  const allCats = await getCategories(false);
  const catMap: Record<string, number> = {};
  for (const c of allCats) catMap[c.slug] = c.id;

  const productData = [
    // Promoções
    { categoryId: catMap["promocoes"], name: "Duas Gigantes", description: "Segunda a quinta-feira! Duas pizzas gigantes com 8 fatias cada. Escolha dois sabores.", price: "89.90", featured: true },
    { categoryId: catMap["promocoes"], name: "Pizza GG + Kuat 2L", description: "1 Pizza Gigante + 1 Kuat 2L por apenas R$ 79,90! Escolha o sabor da sua pizza.", price: "79.90", featured: true },
    { categoryId: catMap["promocoes"], name: "Calzone & Coca", description: "Ao comprar um delicioso calzone, você ganha uma Coca-Cola de 350ml totalmente GRÁTIS!", price: "34.90", featured: true },
    // Pizzas
    { categoryId: catMap["pizzas"], name: "Pizza Gigante - 8 fatias", description: "Familiar: 8 fatias generosas, ideal para um banquete com todos que você ama. Inclui 4 sachês de maionese e ketchup Heinz.", price: "59.90" },
    { categoryId: catMap["pizzas"], name: "Pizza Grande - 6 fatias", description: "Grande: 6 fatias, perfeita para dividir com amigos e família. Inclui 4 sachês de maionese e ketchup Heinz.", price: "54.90" },
    { categoryId: catMap["pizzas"], name: "Pizza Pequena - 4 fatias", description: "Pequena: 4 fatias, ideal para um lanche rápido ou para compartilhar com alguém especial. Inclui 4 sachês de maionese e ketchup Heinz.", price: "48.90" },
    // Calzones
    { categoryId: catMap["calzones"], name: "Calzone de Frango Defumado", description: "Duplonatto! Molho artesanal de tomate, muçarela derretida e frango defumado. Sugestão: combinar com Cream Cheese. Aprox. 3 fatias.", price: "34.90" },
    { categoryId: catMap["calzones"], name: "Calzone de Costelinha", description: "Duplonatto! Molho artesanal, muçarela, costelinhas desfiadas e molho barbecue. Aprox. 3 fatias.", price: "34.90" },
    { categoryId: catMap["calzones"], name: "Calzone de Carne Seca", description: "Duplonatto! Molho artesanal, muçarela, carne seca suculenta e pimenta biquinho. Sugestão: combinar com Catupiry. Aprox. 3 fatias.", price: "34.90" },
    { categoryId: catMap["calzones"], name: "Calzone de Frango com Muçarela", description: "Duplonatto! Molho artesanal, muçarela e frango desfiado suculento. Personalize com ingredientes de sua preferência. Aprox. 3 fatias.", price: "32.90" },
    { categoryId: catMap["calzones"], name: "Calzone de Presunto e Muçarela", description: "Duplonatto! Molho artesanal, muçarela e presunto. Personalize com adicional de sua preferência. Aprox. 3 fatias.", price: "32.90" },
    // Lasanhas
    { categoryId: catMap["lasanhas"], name: "Lasanha à Bolonhesa", description: "Molho à bolonhesa caseiro, massa fresca e muçarela. Camadas de massa fresca intercaladas com nosso molho especial.", price: "42.90" },
    { categoryId: catMap["lasanhas"], name: "Lasanha de Frango com Catupiry", description: "Camadas de massa fresca recheadas com frango desfiado temperado, catupiry original e muçarela.", price: "42.90" },
    // Empanados
    { categoryId: catMap["empanados"], name: "Frango Americano", description: "Aproximadamente 950g de coxinha da asa frita acompanhada de nosso exclusivo molho artesanal.", price: "49.90" },
    // Sorvetes
    { categoryId: catMap["sorvetes"], name: "Raffaello", description: "Sorvete sabor creme com pedaços de chocolate branco e coco. Inspirado no famoso bombom.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Ninho com Nutella", description: "Sorvete sabor ninho mesclado com Nutella. Cremosidade do leite ninho com a indulgência da Nutella.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Jamaica Albino", description: "Sorvete de chocolate branco com pedaços de chocolate branco, amendoim e uvas passas.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Iogurte Grego com Frutas Vermelhas", description: "Sorvete de iogurte grego mesclado com polpa de frutas vermelhas.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Maracujá", description: "Sorvete sabor mousse de maracujá com polpa de maracujá. Refrescante e levemente ácido.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Kinder", description: "Sorvete sabor chocolate branco com pedaços de chocolate branco e chocolate ao leite.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Morango", description: "Sorvete artesanal de morango feito com frutas frescas e creme nobre.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Romeu e Julieta", description: "Sorvete que combina a suavidade cremosa do leite com a doçura da goiabada.", price: "18.90" },
    // Bebidas
    { categoryId: catMap["bebidas"], name: "Coca-Cola Lata 350ml", description: "Coca-Cola gelada em lata 350ml.", price: "5.25" },
    { categoryId: catMap["bebidas"], name: "Coca-Cola Sem Açúcar Lata 350ml", description: "Coca-Cola Zero Açúcar em lata 350ml.", price: "5.25" },
    { categoryId: catMap["bebidas"], name: "Mate Couro 1L", description: "Chá mate gelado 1L.", price: "6.45" },
    { categoryId: catMap["bebidas"], name: "Sprite Fresh Limão 1,5L", description: "Sprite sabor limão fresco 1,5L.", price: "9.95" },
    { categoryId: catMap["bebidas"], name: "Coca-Cola Sem Açúcar 1,5L", description: "Coca-Cola Zero Açúcar 1,5L.", price: "13.40" },
    { categoryId: catMap["bebidas"], name: "Coca-Cola 2L", description: "Coca-Cola garrafa 2L.", price: "15.20" },
    { categoryId: catMap["bebidas"], name: "Fanta Laranja 2L", description: "Fanta Laranja garrafa 2L.", price: "12.00" },
    { categoryId: catMap["bebidas"], name: "Guaraná Kuat 2L", description: "Guaraná Kuat garrafa 2L.", price: "9.90" },
    { categoryId: catMap["bebidas"], name: "Guaraná Antarctica 2L", description: "Guaraná Antarctica garrafa 2L.", price: "11.15" },
    { categoryId: catMap["bebidas"], name: "Del Valle Laranja 1L", description: "Suco Del Valle Frut sabor laranja 1L.", price: "7.60" },
    { categoryId: catMap["bebidas"], name: "Del Valle Uva 1L", description: "Suco Del Valle Frut sabor uva 1L.", price: "7.60" },
    // Extras
    { categoryId: catMap["extras"], name: "4 Sachês de Maionese Heinz", description: "4 sachês de maionese Heinz.", price: "1.00" },
    { categoryId: catMap["extras"], name: "4 Sachês de Ketchup Heinz", description: "4 sachês de ketchup Heinz.", price: "1.00" },
    { categoryId: catMap["extras"], name: "Molho Artesanal 100ml", description: "Molho especial artesanal 100ml.", price: "3.00" },
    { categoryId: catMap["extras"], name: "Molho Mexicano", description: "Molho artesanal levemente apimentado.", price: "3.00" },
    { categoryId: catMap["extras"], name: "Molho Barbecue Heinz 100ml", description: "Molho barbecue Heinz 100ml.", price: "3.50" },
  ];

  for (const prod of productData) {
    await createProduct({ ...prod, active: true, featured: (prod as any).featured ?? false, sortOrder: 0 });
  }
}

// Seed on startup — only in development to avoid duplicate data in production
if (process.env.NODE_ENV !== 'production') {
  seedMenuData().catch(console.error);
  // Seed default home-popup coupon (idempotent via unique code) for dev.
  (async () => {
    try {
      const existing = await getCouponByCode("BONATTO10");
      if (!existing) {
        await createCoupon({
          code: "BONATTO10",
          discountType: "percentage",
          discountValue: "10",
          minOrderValue: "0",
          maxUses: undefined,
          active: true,
          usedCount: 0,
        });
      }
    } catch (err) {
      console.error("[seed] BONATTO10 coupon seed failed:", err);
    }
  })();
}

// --- HELPERS ------------------------------------------------------------------
const DAY_NAMES_SERVER = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Converte o JSON de storeHours do banco em texto legível para o prompt da IA */
function buildHoursDescription(storeHoursJson?: string): string {
  if (!storeHoursJson) return 'Terça a domingo, 18h às 23h';
  try {
    const hours = JSON.parse(storeHoursJson) as Record<string, { open: string; close: string } | null>;
    const lines: string[] = [];
    for (let d = 0; d < 7; d++) {
      const s = hours[String(d)];
      if (s) lines.push(`${DAY_NAMES_SERVER[d]}: ${s.open} às ${s.close}`);
      else lines.push(`${DAY_NAMES_SERVER[d]}: fechado`);
    }
    return lines.join(', ');
  } catch {
    return 'Terça a domingo, 18h às 23h';
  }
}

// --- ROUTERS ------------------------------------------------------------------
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => {
      const u = opts.ctx.user;
      if (!u) return null;
      // Never expose sensitive fields to the client
      const { passwordHash: _ph, resetToken: _rt, resetTokenExpiresAt: _rte, ...safeUser } = u as typeof u & { passwordHash?: unknown; resetToken?: unknown; resetTokenExpiresAt?: unknown };
      return safeUser;
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    registerEmail: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("E-mail inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado" });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const openId = `email_${crypto.randomBytes(16).toString("hex")}`;
        await createEmailUser({ openId, name: input.name, email: input.email, passwordHash });
        // Send welcome email (non-blocking)
        sendWelcomeEmail(input.email, input.name).catch(console.error);
        // Create session
        const sessionToken = await sdk.createSessionToken(openId, { name: input.name, expiresInMs: DEFAULT_SESSION_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
        return { success: true };
      }),

    loginEmail: publicProcedure
      .input(z.object({
        email: z.string().email("E-mail inválido"),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
        }
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: DEFAULT_SESSION_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
        return { success: true };
      }),

    forgotPassword: publicProcedure
      .input(z.object({
        email: z.string().email("E-mail inválido"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        // Always return success to avoid email enumeration
        if (!user) return { success: true, emailSent: false };
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await saveResetToken(input.email, token, expiresAt);
        // Prefer configured PUBLIC_APP_URL (allowlisted) to avoid host-header injection
        // in the password-reset email. Fallback only when not running in production.
        const configured = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
        let origin = configured;
        if (!origin) {
          if (process.env.NODE_ENV === "production") {
            console.error("[forgotPassword] PUBLIC_APP_URL não configurado em produção.");
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Servidor não configurado para envio de e-mail." });
          }
          origin = `${ctx.req.protocol}://${ctx.req.get("host") ?? "localhost"}`;
        }
        const resetUrl = `${origin}/reset-password?token=${token}`;
        let emailSent = false;
        try {
          await sendPasswordResetEmail(input.email, user.name ?? "Cliente", resetUrl);
          emailSent = true;
        } catch (emailError) {
          console.error("[forgotPassword] Email send failed:", emailError);
        }
        // Never return the resetUrl/token in the response
        return { success: true, emailSent };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByResetToken(input.token);
        if (!user || !user.resetTokenExpiresAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido ou expirado" });
        }
        if (new Date() > user.resetTokenExpiresAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Token expirado. Solicite um novo link." });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        await updateUserPasswordHash(user.openId, passwordHash);
        await clearResetToken(user.openId);
        // Auto-login after reset
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: DEFAULT_SESSION_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
        return { success: true };
      }),
  }),

  // --- CATEGORIES -------------------------------------------------------------
  categories: router({
    list: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(({ input }) => getCategories(input?.activeOnly ?? true)),

    listAll: staffProcedure.query(() => getCategories(false)),

    create: staffProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          imageUrl: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(({ input }) => createCategory({ ...input, active: true })),

    update: staffProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          imageUrl: z.string().optional(),
          sortOrder: z.number().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateCategory(id, data);
      }),

    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCategory(input.id)),
  }),

  // --- PRODUCTS ---------------------------------------------------------------
  products: router({
    list: publicProcedure
      .input(z.object({ categoryId: z.number().optional() }).optional())
      .query(({ input }) => getProducts({ categoryId: input?.categoryId, activeOnly: true })),

    listAll: staffProcedure.query(() => getProducts({ activeOnly: false })),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getProductById(input.id)),

    create: staffProcedure
      .input(
        z.object({
          categoryId: z.number(),
          name: z.string().min(1).max(200),
          description: z.string().max(2000).optional(),
          price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido"),
          imageUrl: z.string().max(2048).optional(),
          featured: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        })
      )
      .mutation(({ input }) => createProduct({ ...input, active: true, featured: input.featured ?? false })),

    update: staffProcedure
      .input(
        z.object({
          id: z.number(),
          categoryId: z.number().optional(),
          name: z.string().min(1).max(200).optional(),
          description: z.string().max(2000).optional(),
          price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido").optional(),
          imageUrl: z.string().max(2048).optional(),
          featured: z.boolean().optional(),
          active: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateProduct(id, data);
      }),

    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteProduct(input.id)),

    uploadImage: staffProcedure
      .input(z.object({
        base64: z.string().max(10_000_000), // ~7.5MB base64 limit
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(255).optional(),
      }))
      .mutation(async ({ input }) => {
        const { storagePutAdapter: storagePut } = await import("./adapters/storage");
        const { compressToWebP } = await import("./imageUtils");
        const rawBuffer = Buffer.from(input.base64, "base64");
        const { buffer, mimeType, ext, reductionPct } = await compressToWebP(rawBuffer, 82, 1200);
        const key = `products/product-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        console.log(`[upload] produto comprimido ${reductionPct}% → WebP`);
        return { url };
      }),
  }),

  // --- COUPONS ----------------------------------------------------------------
  coupons: router({
    validate: publicProcedure
      .input(z.object({ code: z.string(), orderTotal: z.number() }))
      .mutation(async ({ input }) => {
        const coupon = await getCouponByCode(input.code);
        if (!coupon) throw new TRPCError({ code: "NOT_FOUND", message: "Cupom não encontrado" });
        if (!coupon.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Cupom inativo" });
        if (coupon.expiresAt && new Date() > coupon.expiresAt)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cupom expirado" });
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cupom esgotado" });
        const minOrder = parseFloat(coupon.minOrderValue ?? "0");
        if (input.orderTotal < minOrder)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Pedido mínimo de R$ ${minOrder.toFixed(2)} para este cupom`,
          });
        let discount = 0;
        if (coupon.discountType === "percentage") {
          discount = (input.orderTotal * parseFloat(coupon.discountValue)) / 100;
        } else {
          discount = parseFloat(coupon.discountValue);
        }
        return { valid: true, discount: Math.min(discount, input.orderTotal), coupon };
      }),

    list: staffProcedure.query(() => getAllCoupons()),

    // Public endpoint: returns only active global coupons (no userId) for display in customer panel
    listActive: protectedProcedure.query(() =>
      getAllCoupons().then((coupons) =>
        coupons.filter((c) => c.active && !c.userId && (!c.expiresAt || new Date() < c.expiresAt))
      )
    ),

    create: staffProcedure
      .input(
        z.object({
          code: z.string().min(1),
          discountType: z.enum(["percentage", "fixed"]),
          discountValue: z.string(),
          minOrderValue: z.string().optional(),
          maxUses: z.number().optional(),
          expiresAt: z.date().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await createCoupon({ ...input, active: true, usedCount: 0 });
        // Alerta automático para clientes
        const discountText = input.discountType === "percentage"
          ? `${input.discountValue}% de desconto`
          : `R$ ${parseFloat(input.discountValue).toFixed(2)} de desconto`;
        await createClientAlert({
          type: "coupon",
          title: `🎉 Novo cupom disponível!`,
          message: `Use o cupom **${input.code}** e ganhe ${discountText} no seu pedido.`,
          icon: "🎉",
          url: "/cardapio",
          expiresAt: input.expiresAt,
        });
        return result;
      }),

    update: staffProcedure
      .input(z.object({
        id: z.number(),
        active: z.boolean().optional(),
        maxUses: z.number().int().min(0).optional(),
        discountType: z.enum(["percentage", "fixed"]).optional(),
        discountValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido").optional(),
        minOrderValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido").optional(),
        expiresAt: z.date().nullable().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateCoupon(id, data);
      }),

    // Public: returns the home popup coupon only if it has been provisioned by an admin.
    // Nenhum side-effect aqui — cupons devem ser criados via seed/admin, não em leitura pública.
    getHomePopupCoupon: publicProcedure.query(async () => {
      const POPUP_CODE = "BONATTO10";
      const coupon = await getCouponByCode(POPUP_CODE);
      if (!coupon || !coupon.active) return null;
      if (coupon.expiresAt && new Date() > coupon.expiresAt) return null;
      return {
        code: POPUP_CODE,
        discountValue: coupon.discountValue,
        discountType: coupon.discountType,
        active: coupon.active,
      };
    }),
  }),

  // --- ORDERS -----------------------------------------------------------------
  orders: router({
    create: protectedProcedure
      .input(
        z.object({
          customerName: z.string().min(1).max(200),
          customerEmail: z.string().email().max(320).optional(),
          customerPhone: z
            .string()
            .trim()
            .max(30)
            // Aceita formatos comuns — "(37) 99999-0002", "+55 37 99999-0002" etc.
            // A verificação real conta apenas os dígitos.
            .refine((v) => {
              const digits = v.replace(/\D/g, "");
              return digits.length >= 10 && digits.length <= 15;
            }, { message: "Telefone inválido. Informe DDD + número (10 a 15 dígitos)." })
            .optional(),
          deliveryAddress: z.string().min(1).max(500),
          deliveryCity: z.string().max(100).optional(),
          deliveryCep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido").optional(),
          deliveryNeighborhood: z.string().max(100).optional(),
          deliveryComplement: z.string().max(200).optional(),
          paymentMethod: z.enum(["credit_card", "debit_card", "pix", "cash"]),
          couponCode: z.string().max(50).optional(),
          pointsToRedeem: z.number().int().min(0).max(5000).optional(),
          notes: z.string().max(1000).optional(),
          // deliveryFeeOverride foi removido: taxa sempre calculada server-side a partir
          // do CEP/bairro para evitar manipulação do valor pelo cliente.
          items: z
            .array(
              z.object({
                productId: z.number().int().positive(),
                productName: z.string().max(200),
                productPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido"),
                quantity: z.number().int().min(1).max(99),
                notes: z.string().max(500).optional(),
              })
            )
            .min(1, "O pedido precisa ter pelo menos 1 item.")
            .max(50, "Pedido excede o número máximo de itens."),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // -- Carregar configurações do banco --
        const dbSettings = await getAllStoreSettings();

        // -- Validação de horário de funcionamento (timezone: America/Sao_Paulo) --
        const now = new Date();
        // Convert to Brasília time to avoid UTC offset issues
        const brFormatter = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          weekday: 'narrow', hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const brParts = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(now);
        const brDayName = brParts.find(p => p.type === 'weekday')?.value ?? '';
        const brHour = parseInt(brParts.find(p => p.type === 'hour')?.value ?? '0', 10);
        const brMinute = parseInt(brParts.find(p => p.type === 'minute')?.value ?? '0', 10);
        // Map Portuguese weekday to JS day number (0=Sunday)
        const dayNameToNum: Record<string, number> = {
          'domingo': 0, 'segunda-feira': 1, 'terça-feira': 2, 'quarta-feira': 3,
          'quinta-feira': 4, 'sexta-feira': 5, 'sábado': 6,
        };
        const day = dayNameToNum[brDayName.toLowerCase()] ?? now.getDay();
        const defaultHours: Record<string, { open: string; close: string } | null> = {
          "0": null,
          "1": { open: "18:00", close: "23:00" },
          "2": { open: "18:00", close: "23:00" },
          "3": { open: "18:00", close: "23:00" },
          "4": { open: "18:00", close: "23:00" },
          "5": { open: "18:00", close: "23:30" },
          "6": { open: "18:00", close: "23:30" },
        };
        const storeHours = dbSettings.storeHours
          ? (JSON.parse(dbSettings.storeHours) as Record<string, { open: string; close: string } | null>)
          : defaultHours;
        const schedule = storeHours[String(day)];
        let storeOpen = false;
        if (schedule) {
          const [oh, om] = schedule.open.split(":").map(Number);
          const [ch, cm] = schedule.close.split(":").map(Number);
          const nowMin = brHour * 60 + brMinute;
          storeOpen = nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
        }
        if (!storeOpen) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "A pizzaria está fechada no momento. Tente novamente durante o horário de funcionamento.",
          });
        }

        // -- Validação de CEP (apenas para entrega) --
        if (input.deliveryCep) {
          const cleanCep = input.deliveryCep.replace(/\D/g, "");
          const defaultPrefixes = [
            "37500","37501","37502","37503","37504","37505","37506","37507","37508","37509",
            "37510","37511","37512","37513","37514","37515","37516","37517","37518","37519",
            "37520","37521","37522","37523","37524","37525","37526","37527","37528","37529",
          ];
          const deliveryPrefixes = dbSettings.deliveryCepPrefixes
            ? (JSON.parse(dbSettings.deliveryCepPrefixes) as string[])
            : defaultPrefixes;
          if (cleanCep.length === 8 && !deliveryPrefixes.includes(cleanCep.substring(0, 5))) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Infelizmente não entregamos nesse CEP ainda. Entre em contato pelo WhatsApp.",
            });
          }
        }

        // -- Validar preços server-side (crítico: nunca confiar no preço do cliente) --
        // Batch fetch: uma única query para todos os produtos do carrinho.
        const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
        const productsFromDb = await getProductsByIds(productIds);
        const productMap = new Map(productsFromDb.map((p) => [p.id, p]));
        const resolvedItems: Array<{ productId: number; productName: string; productPrice: string; quantity: number; notes: string | null }> = [];
        for (const item of input.items) {
          const product = productMap.get(item.productId);
          if (!product || !product.active) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Produto "${item.productName}" não encontrado ou indisponível.` });
          }
          resolvedItems.push({ productId: item.productId, productName: product.name, productPrice: product.price, quantity: item.quantity, notes: item.notes ?? null });
        }
        const subtotal = resolvedItems.reduce(
          (sum, item) => sum + parseFloat(item.productPrice) * item.quantity,
          0
        );

        let discountAmount = 0;
        // Cupom: valida regras (ativo, validade, userId, minOrderValue) **antes** de
        // incrementar uso. A aplicação do increment fica atrelada ao registro de
        // resgate (couponRedemptions) para permitir estorno em cancelamento.
        let couponToApply: Awaited<ReturnType<typeof getCouponByCode>> | undefined;
        if (input.couponCode) {
          couponToApply = await getCouponByCode(input.couponCode);
          if (!couponToApply) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Cupom inválido ou expirado." });
          }
          if (!couponToApply.active) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Cupom inativo." });
          }
          if (couponToApply.expiresAt && new Date() > couponToApply.expiresAt) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Cupom expirado." });
          }
          if (couponToApply.userId != null && couponToApply.userId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Este cupom é exclusivo de outro usuário." });
          }
          const minOrder = parseFloat(couponToApply.minOrderValue ?? "0");
          if (subtotal < minOrder) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Pedido mínimo de R$ ${minOrder.toFixed(2)} para este cupom.`,
            });
          }
          if (couponToApply.discountType === "percentage") {
            discountAmount = (subtotal * parseFloat(couponToApply.discountValue)) / 100;
          } else {
            discountAmount = parseFloat(couponToApply.discountValue);
          }
        }

        // Desconto do Clube do Bonatto
        let clubDiscountAmount = 0;
        let clubFreeDelivery = false;
        const userForClub = await getUserById(ctx.user.id);
        if (userForClub && userForClub.clubStatus === "active" && userForClub.clubPlan) {
          const discountPct = userForClub.clubPlan === "bonattao" ? 20 : 15;
          clubDiscountAmount = ((subtotal - discountAmount) * discountPct) / 100;
          clubFreeDelivery = userForClub.clubPlan === "bonattao";
        }
        discountAmount += clubDiscountAmount;
        // Desconto de pontos de fidelidade (1 ponto = R$ 0,10, mínimo 50 pontos).
        // O débito real dos pontos é feito *atomicamente* após a criação do pedido
        // (abaixo), garantindo consistência em caso de falha.
        const POINTS_TO_BRL = 0.10;
        let pointsDiscount = 0;
        let pointsUsed = 0;
        if (input.pointsToRedeem && input.pointsToRedeem >= 50) {
          const userBalance = await getUserLoyaltyPoints(ctx.user.id);
          const pts = Math.min(input.pointsToRedeem, userBalance);
          if (pts >= 50) {
            pointsDiscount = parseFloat((pts * POINTS_TO_BRL).toFixed(2));
            pointsUsed = pts;
            discountAmount += pointsDiscount;
          }
        }
        // Calcular taxa de entrega server-side. Preferir a zona por bairro
        // (tabela delivery_zones); se não houver, cai para a taxa global em
        // store_settings. Membros Bonattão têm entrega grátis.
        let rawDeliveryFee = 0;
        if (input.deliveryCep || input.deliveryNeighborhood) {
          if (input.deliveryNeighborhood) {
            const zone = await getDeliveryZoneByNeighborhood(input.deliveryNeighborhood);
            if (zone) rawDeliveryFee = parseFloat(zone.deliveryFee);
            else {
              const feeStr = dbSettings.deliveryFee;
              rawDeliveryFee = feeStr ? parseFloat(feeStr) : 0;
            }
          } else {
            const feeStr = dbSettings.deliveryFee;
            rawDeliveryFee = feeStr ? parseFloat(feeStr) : 0;
          }
        }
        const deliveryFee = clubFreeDelivery ? 0 : rawDeliveryFee;
        // Validar valor mínimo do pedido
        const minOrderValueStr = dbSettings.minOrderValue;
        const minOrderValue = minOrderValueStr ? parseFloat(minOrderValueStr) : 0;
        const totalBeforeCheck = Math.max(0, subtotal - discountAmount + deliveryFee);
        if (minOrderValue > 0 && (subtotal - discountAmount) < minOrderValue) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Valor mínimo do pedido é R$ ${minOrderValue.toFixed(2).replace('.', ',')}. Adicione mais itens ao carrinho.`,
          });
        }
        const total = totalBeforeCheck;

        const orderData = {
          userId: ctx.user.id,
          customerName: input.customerName,
          customerEmail: input.customerEmail ?? null,
          customerPhone: input.customerPhone ?? null,
          deliveryAddress: input.deliveryAddress,
          deliveryCity: input.deliveryCity ?? null,
          deliveryCep: input.deliveryCep ?? null,
          deliveryComplement: input.deliveryComplement ?? null,
          subtotal: subtotal.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          deliveryFee: deliveryFee.toFixed(2),
          total: total.toFixed(2),
          couponCode: input.couponCode ?? null,
          pointsDiscount: pointsDiscount.toFixed(2),
          pointsUsed,
          paymentMethod: input.paymentMethod,
          notes: input.notes ?? null,
        };
        const orderItemsData = resolvedItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productPrice: item.productPrice,
          quantity: item.quantity,
          notes: item.notes ?? null,
          subtotal: (parseFloat(item.productPrice) * item.quantity).toFixed(2),
        }));

        // 1) Criação do pedido. Fazemos primeiro para que o orderId seja
        //    conhecido e gravado no livro-razão de fidelidade/cupom.
        const orderId = await createOrder(orderData, orderItemsData);

        // 2) Débito atômico dos pontos — agora COM orderId, garantindo que
        //    `loyalty_transactions.orderId` nunca fique nulo. Em caso de
        //    falha/corrida, cancela o pedido recém-criado.
        if (pointsUsed > 0) {
          let debit: Awaited<ReturnType<typeof deductLoyaltyPointsAtomic>>;
          try {
            debit = await deductLoyaltyPointsAtomic(
              ctx.user.id,
              pointsUsed,
              orderId,
              `-${pointsUsed} pontos resgatados no pedido #${orderId}`
            );
          } catch (debitErr) {
            try {
              await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
            } catch (cancelErr) {
              console.error("[orders.create] failed to cancel order after debit error:", cancelErr);
            }
            console.error("[orders.create] debit points failed unexpectedly:", debitErr);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Falha ao processar pontos de fidelidade.",
            });
          }
          if (!debit.ok) {
            try {
              await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
            } catch (cancelErr) {
              console.error("[orders.create] failed to cancel order after debit race:", cancelErr);
            }
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Saldo de pontos insuficiente. Saldo atual: ${debit.newBalance}.`,
            });
          }
        }

        // 3) Cupom: incremento atômico + registro ligado ao pedido. Se a
        //    corrida contra maxUses disparar, cancela o pedido e estorna pontos.
        if (couponToApply) {
          const accepted = await incrementCouponUsage(couponToApply.code);
          if (!accepted) {
            try {
              await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
              if (pointsUsed > 0) {
                await addLoyaltyPoints(ctx.user.id, pointsUsed, orderId, `Estorno por falha ao aplicar cupom no pedido #${orderId}`);
              }
            } catch (cleanupErr) {
              console.error("[orders.create] cleanup after coupon race failed:", cleanupErr);
            }
            throw new TRPCError({ code: "BAD_REQUEST", message: "Este cupom atingiu o limite de usos." });
          }
          try {
            await registerCouponRedemption(couponToApply.id, couponToApply.code, orderId, ctx.user.id);
          } catch (redErr) {
            console.error("[orders.create] registerCouponRedemption failed:", redErr);
          }
        }

        // Notify owner — usa preços resolvidos do BD (não o preço enviado pelo cliente).
        const itemsList = resolvedItems
          .map((i) => `• ${i.productName} x${i.quantity} — R$ ${(parseFloat(i.productPrice) * i.quantity).toFixed(2)}`)
          .join("\n");
        await notifyOwner({
          title: `🍕 Novo Pedido #${orderId} - ${input.customerName}`,
          content: `**Cliente:** ${input.customerName}\n**Telefone:** ${input.customerPhone ?? "N/A"}\n**Endereço:** ${input.deliveryAddress}\n**Pagamento:** ${input.paymentMethod}\n\n**Itens:**\n${itemsList}\n\n**Total: R$ ${total.toFixed(2)}**`,
        }).catch(console.error);

        // Push para admins: novo pedido
        sendPushToAdmins({
          title: `🍕 Novo Pedido #${orderId}`,
          body: `${input.customerName} — R$ ${total.toFixed(2)}`,
          url: "/admin",
          tag: `new-order-${orderId}`,
        }).catch(console.error);

        // WhatsApp para o cliente: confirmação
        if (input.customerPhone) {
          sendWhatsApp(
            input.customerPhone,
            WhatsAppTemplates.orderConfirmed(input.customerName, orderId, total.toFixed(2))
          ).catch(console.error);
        }

        return { orderId, total };
      }),

    myOrders: protectedProcedure.query(({ ctx }) => getOrdersByUser(ctx.user.id)),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await getOrderById(input.id);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        // Only allow owner or admin to view order details
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        const items = await getOrderItems(input.id);
        return { ...order, items };
      }),

    // Admin
    list: staffProcedure
      .input(
        z.object({
          status: z.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]).optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
          storeId: z.number().optional(),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getAllOrders({ ...input, storeId });
      }),

    updateStatus: staffProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]),
        })
      )
      .mutation(async ({ input }) => {
        // Máquina de estados: só transições válidas são permitidas.
        const TRANSITIONS: Record<string, string[]> = {
          pending:          ["confirmed", "preparing", "cancelled"],
          confirmed:        ["preparing", "out_for_delivery", "cancelled"],
          preparing:        ["out_for_delivery", "cancelled"],
          out_for_delivery: ["delivered", "cancelled"],
          delivered:        [], // estado terminal
          cancelled:        [], // estado terminal
        };
        const allowedFrom = Object.entries(TRANSITIONS)
          .filter(([, nexts]) => nexts.includes(input.status))
          .map(([from]) => from) as Array<"pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled">;
        if (allowedFrom.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Transição inválida para ${input.status}.` });
        }
        const guard = await updateOrderStatusGuarded(input.id, input.status, allowedFrom);
        if (!guard.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: guard.previous
              ? `Não é possível ir de ${guard.previous} para ${input.status}.`
              : "Pedido não encontrado.",
          });
        }
        // Buscar pedido para notificar o cliente
        const order = await getOrderById(input.id);
        if (order) {
          // Marcar conversão de automação (carrinho abandonado / reativação)
          if ((input.status === 'confirmed' || input.status === 'preparing') && order.userId) {
            (async () => {
              try { await markConversions(order.userId!, input.id); } catch (e) { console.error("markConversions error:", e); }
            })();
          }
          // Se cancelado: estornar pontos e cupom de uso deste pedido
          if (input.status === 'cancelled') {
            (async () => {
              try { await refundLoyaltyPointsForOrder(input.id); } catch (e) { console.error("refund points error:", e); }
              try { await revertCouponRedemption(input.id); } catch (e) { console.error("revert coupon error:", e); }
            })();
          }
          // Creditar pontos automaticamente ao entregar (1 ponto por R$1 gasto)
          // Requisitos: pedido pago + idempotência por orderId (tabela loyalty_order_credits).
          if (input.status === 'delivered' && order.userId && order.total && order.paymentStatus === 'paid') {
            const pointsToAdd = Math.floor(Number(order.total));
            if (pointsToAdd > 0) {
              (async () => {
                try {
                  const credited = await creditLoyaltyForOrderIdempotent(
                    input.id,
                    order.userId!,
                    pointsToAdd,
                    `+${pointsToAdd} pontos pelo pedido #${input.id}`
                  );
                  if (credited) {
                    await sendPushToUser(order.userId!, {
                      title: "⭐ Pontos creditados!",
                      body: `+${pointsToAdd} pontos foram adicionados ao seu saldo Bonatto!`,
                      url: "/minha-conta",
                      tag: `loyalty-${input.id}`,
                    });
                  }
                } catch (e) { console.error("Loyalty points error:", e); }
              })();
            }
          }
          const customerName = order.customerName ?? "Cliente";
          const phone = order.customerPhone;
          // Mapear status -> event name para templates
          const statusToEvent: Record<string, string> = {
            confirmed:        "order_confirmed",
            preparing:        "order_preparing",
            out_for_delivery: "order_out_for_delivery",
            delivered:        "order_delivered",
            cancelled:        "order_cancelled",
          };
          const eventName = statusToEvent[input.status];

          // Função para interpolar variáveis no template
          const interpolate = (text: string) =>
            text
              .replace(/\{\{clientName\}\}/g, customerName)
              .replace(/\{\{orderId\}\}/g, String(input.id))
              .replace(/\{\{total\}\}/g, order.total ? `R$ ${Number(order.total).toFixed(2).replace('.', ',')}` : "");

          // Push para o cliente
          if (order.userId && eventName) {
            const pushFallbacks: Record<string, { title: string; body: string }> = {
              confirmed:         { title: "✅ Pedido Confirmado!",         body: `Seu pedido #${input.id} foi confirmado pela Bonatto Pizza.` },
              preparing:         { title: "👨‍🍳 Preparando seu pedido!",    body: `Seu pedido #${input.id} está sendo preparado com carinho.` },
              out_for_delivery:  { title: "🛵 Saiu para entrega!",          body: `Seu pedido #${input.id} está a caminho. Aguarde!` },
              delivered:         { title: "🎉 Pedido entregue!",            body: `Seu pedido #${input.id} foi entregue. Bom apetite!` },
              cancelled:         { title: "❌ Pedido cancelado",            body: `Seu pedido #${input.id} foi cancelado. Entre em contato conosco.` },
            };
            (async () => {
              try {
                const tpl = await pickRandomTemplate(eventName, "push");
                const payload = tpl
                  ? { title: interpolate(tpl.title), body: interpolate(tpl.body) }
                  : pushFallbacks[input.status];
                if (payload) {
                  await sendPushToUser(order.userId!, { ...payload, url: "/minha-conta", tag: `order-status-${input.id}` });
                }
              } catch (e) { console.error("Push error:", e); }
            })();
          }
          // WhatsApp para o cliente
          if (phone && eventName) {
            const waMsgFallbacks: Record<string, string> = {
              confirmed:        WhatsAppTemplates.orderConfirmed(customerName, input.id, order.total),
              preparing:        WhatsAppTemplates.orderPreparing(customerName, input.id),
              out_for_delivery: WhatsAppTemplates.orderOutForDelivery(customerName, input.id),
              delivered:        WhatsAppTemplates.orderDelivered(customerName, input.id),
              cancelled:        WhatsAppTemplates.orderCancelled(customerName, input.id),
            };
            (async () => {
              try {
                const tpl = await pickRandomTemplate(eventName, "whatsapp");
                const msg = tpl ? interpolate(tpl.body) : waMsgFallbacks[input.status];
                if (msg) await sendWhatsApp(phone!, msg);
              } catch (e) { console.error("WhatsApp error:", e); }
            })();
          }
          // ── Disparar triggers de automação por status ──────────────────────────
          if (order.userId) {
            const orderTriggerMap: Record<string, "order_delivered" | "order_cancelled" | undefined> = {
              delivered: "order_delivered",
              cancelled: "order_cancelled",
            };
            const journeyTrigger = orderTriggerMap[input.status];
            if (journeyTrigger) {
              fireJourneyTrigger(journeyTrigger, order.userId, order.customerPhone ?? undefined).catch(() => {});
            }
            // first_order_month: primeiro pedido do mês corrente
            if (input.status === "delivered") {
              (async () => {
                try {
                  const { getDb } = await import("./db");
                  const { orders: ordersTable } = await import("../drizzle/schema");
                  const { and: _and, eq: _eq, gte: _gte, lt: _lt, ne: _ne } = await import("drizzle-orm");
                  const db = await getDb();
                  if (!db) return;
                  const now = new Date();
                  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                  // Contar pedidos entregues deste mês EXCLUINDO o pedido atual
                  const prevDelivered = await db
                    .select({ id: ordersTable.id })
                    .from(ordersTable)
                    .where(_and(
                      _eq(ordersTable.userId, order.userId!),
                      _eq(ordersTable.status, "delivered"),
                      _gte(ordersTable.createdAt, monthStart),
                      _lt(ordersTable.createdAt, monthEnd),
                      _ne(ordersTable.id, input.id),
                    ))
                    .limit(1);
                  if (prevDelivered.length === 0) {
                    // É o primeiro pedido entregue do mês
                    fireJourneyTrigger("first_order_month", order.userId!, order.customerPhone ?? undefined).catch(() => {});
                  }
                } catch (e) { console.error("first_order_month trigger error:", e); }
              })();
            }
          }
        }
        return { ok: true };
      }),

    updatePaymentStatus: staffProcedure
      .input(
        z.object({
          id: z.number(),
          paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]),
          stripePaymentIntentId: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        updateOrderPaymentStatus(input.id, input.paymentStatus, input.stripePaymentIntentId)
      ),
   }),

  // --- IFOOD ------------------------------------------------------------------
  ifood: router({
    merchants: adminProcedure.query(async () => {
      return listIfoodMerchants();
    }),
    syncCatalog: adminProcedure
      .input(z.object({ merchantId: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        return syncIfoodCatalog(input?.merchantId);
      }),
    syncPromotions: adminProcedure
      .input(
        z.object({
          merchantId: z.string().optional(),
          aggregationIds: z.array(z.string().min(1)).optional(),
        }).optional()
      )
      .mutation(async ({ input }) => {
        return syncIfoodPromotions({
          merchantId: input?.merchantId,
          aggregationIds: input?.aggregationIds,
        });
      }),
    confirmOrder: adminProcedure
      .input(z.object({ ifoodOrderId: z.string() }))
      .mutation(async ({ input }) => {
        await confirmIfoodOrder(input.ifoodOrderId);
        return { success: true };
      }),
    startPreparation: adminProcedure
      .input(z.object({ ifoodOrderId: z.string() }))
      .mutation(async ({ input }) => {
        await startPreparationIfoodOrder(input.ifoodOrderId);
        return { success: true };
      }),
    dispatch: adminProcedure
      .input(z.object({ ifoodOrderId: z.string() }))
      .mutation(async ({ input }) => {
        await dispatchIfoodOrder(input.ifoodOrderId);
        return { success: true };
      }),
    cancelOrder: adminProcedure
      .input(z.object({ ifoodOrderId: z.string(), reason: z.string().default("Pedido cancelado pelo restaurante") }))
      .mutation(async ({ input }) => {
        await cancelIfoodOrder(input.ifoodOrderId, input.reason);
        return { success: true };
      }),
  }),

  // --- NFC-e (Focus NFe) -------------------------------------------------------
  nfce: router({
    emitir: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const result = await emitirNfce(input.orderId);
        if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao emitir NFC-e" });
        return result;
      }),
    cancelar: adminProcedure
      .input(z.object({ orderId: z.number(), justificativa: z.string().min(15) }))
      .mutation(async ({ input }) => {
        const result = await cancelarNfce(input.orderId, input.justificativa);
        if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao cancelar NFC-e" });
        return result;
      }),
  }),

  // --- PAYMENTS ---------------------------------------------------------------
  payments: router({
    createIntent: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Fetch real order from DB — never trust client-provided amount
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        const amountInReais = parseFloat(order.total ?? "0");
        if (amountInReais <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Valor do pedido inválido" });
        const paymentIntent = await createPaymentIntent(amountInReais, "brl", {
          orderId: String(input.orderId),
        });
        return { clientSecret: paymentIntent.client_secret };
      }),
    createCheckoutSession: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        origin: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        const amountInReais = parseFloat(order.total ?? "0");
        if (amountInReais < 0.5) throw new TRPCError({ code: "BAD_REQUEST", message: "Valor mínimo para pagamento online é R$ 0,50" });
        const session = await createCheckoutSession({
          orderId: input.orderId,
          amountInReais,
          customerEmail: ctx.user.email ?? undefined,
          successUrl: `${input.origin}/pagamento/sucesso?orderId=${input.orderId}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${input.origin}/pagamento/cancelado?orderId=${input.orderId}`,
          metadata: {
            userId: String(ctx.user.id),
            customerName: ctx.user.name ?? "",
          },
          orderDescription: `Pedido #${input.orderId} — Bonatto Pizza`,
        });
        return { checkoutUrl: session.url, sessionId: session.id };
      }),
     getMyTransactions: protectedProcedure.query(({ ctx }) => getTransactionsByUser(ctx.user.id)),

    // ─── Saved Cards ─────────────────────────────────────────────────────────────
    createSetupIntent: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const stripeCustomerId = await getOrCreateStripeCustomer({
          userId: ctx.user.id,
          stripeCustomerId: user.stripeCustomerId,
          email: user.email,
          name: user.name,
        });
        const setupIntent = await createSetupIntent(stripeCustomerId);
        return { clientSecret: setupIntent.client_secret, stripeCustomerId };
      }),

    listSavedCards: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user?.stripeCustomerId) return [];
      try {
        return await listSavedCards(user.stripeCustomerId);
      } catch {
        return [];
      }
    }),

    deleteCard: protectedProcedure
      .input(z.object({ paymentMethodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user?.stripeCustomerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum cart\u00e3o salvo" });
        const cards = await listSavedCards(user.stripeCustomerId);
        const card = cards.find((c) => c.id === input.paymentMethodId);
        if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Cart\u00e3o n\u00e3o encontrado" });
        await detachPaymentMethod(input.paymentMethodId);
        return { success: true };
      }),

    checkoutWithSavedCard: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        paymentMethodId: z.string(),
        origin: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido n\u00e3o encontrado" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const stripeCustomerId = await getOrCreateStripeCustomer({
          userId: ctx.user.id,
          stripeCustomerId: user.stripeCustomerId,
          email: user.email,
          name: user.name,
        });
        const amountInReais = parseFloat(order.total ?? "0");
        if (amountInReais < 0.5) throw new TRPCError({ code: "BAD_REQUEST", message: "Valor m\u00ednimo \u00e9 R$ 0,50" });
        const session = await createCheckoutSessionWithSavedCard({
          orderId: input.orderId,
          amountInReais,
          stripeCustomerId,
          paymentMethodId: input.paymentMethodId,
          successUrl: `${input.origin}/pagamento/sucesso?orderId=${input.orderId}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${input.origin}/pagamento/cancelado?orderId=${input.orderId}`,
          metadata: { userId: String(ctx.user.id), customerName: user.name ?? "" },
        });
        return { checkoutUrl: session.url, sessionId: session.id };
      }),
  }),
  // --- ASAAS PIX ---------------------------------------------------------------
  asaas: router({
    /** Gera cobrança PIX via Asaas e retorna QR Code */
    createPix: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!process.env.ASAAS_API_KEY) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Integração Asaas não configurada. Configure ASAAS_API_KEY nas variáveis de ambiente." });
        }
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (order.paymentStatus === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Pedido já pago" });
        // Se já tem cobrança Asaas, retornar o status atual
        if (order.asaasPaymentId) {
          const status = await getChargeStatus(order.asaasPaymentId);
          if (status === "RECEIVED" || status === "CONFIRMED") {
            await updateOrderPaymentStatus(input.orderId, "paid", undefined, undefined, order.asaasPaymentId);
            return { alreadyPaid: true, status, chargeId: order.asaasPaymentId, qrCodeImage: "", pixCopiaECola: "", expirationDate: "", value: 0 };
          }
        }
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const customerId = await getOrCreateAsaasCustomer({
          name: order.customerName,
          email: user.email ?? undefined,
          phone: order.customerPhone ?? undefined,
        });
        const charge = await createPixCharge({
          customerId,
          value: parseFloat(order.total ?? "0"),
          description: `Pedido #${order.id} — Bonatto Pizza`,
          externalReference: String(order.id),
        });
        // Salvar o ID da cobrança no pedido
        await updateOrderPaymentStatus(input.orderId, "pending", undefined, undefined, charge.id);
        return {
          alreadyPaid: false,
          chargeId: charge.id,
          qrCodeImage: charge.encodedImage,
          pixCopiaECola: charge.payload,
          expirationDate: charge.expirationDate,
          value: charge.value,
        };
      }),
    /** Consulta status de cobrança PIX */
    checkPixStatus: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (order.paymentStatus === "paid") return { status: "CONFIRMED" as const, paid: true };
        if (!order.asaasPaymentId) return { status: "PENDING" as const, paid: false };
        const status = await getChargeStatus(order.asaasPaymentId);
        const paid = status === "RECEIVED" || status === "CONFIRMED";
        if (paid) {
          await updateOrderPaymentStatus(input.orderId, "paid", undefined, undefined, order.asaasPaymentId);
        }
        return { status, paid };
      }),
  }),
  // --- USER PROFILE ---------------------------------------------------------------
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) return null;
      // Never expose sensitive fields (password hash, reset tokens) to the client
      const {
        passwordHash: _ph,
        resetToken: _rt,
        resetTokenExpiresAt: _rte,
        ...safeUser
      } = user as typeof user & {
        passwordHash?: unknown;
        resetToken?: unknown;
        resetTokenExpiresAt?: unknown;
      };
      return safeUser;
    }),
    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        savedAddress: z.string().optional(),
        savedCep: z.string().optional(),
        savedCity: z.string().optional(),
      }))
      .mutation(({ input, ctx }) => updateUserProfile(ctx.user.id, input)),
    myCoupons: protectedProcedure.query(({ ctx }) => getCouponsByUser(ctx.user.id)),
  }),

  // --- UP-SELLS ---------------------------------------------------------------
  upsells: router({
    forCart: publicProcedure
      .input(z.object({ productIds: z.array(z.number()), cartTotal: z.number() }))
      .query(({ input }) => getUpsellsForCart(input.productIds, input.cartTotal)),
    all: staffProcedure.query(() => getAllUpsells()),
    create: staffProcedure
      .input(z.object({
        suggestedProductId: z.number(),
        triggerProductId: z.number().optional(),
        triggerMinTotal: z.string().optional(),
        type: z.enum(["upsell", "downsell"]).default("upsell"),
        title: z.string().min(1),
        description: z.string().optional(),
        discountPercent: z.number().default(0),
        active: z.boolean().default(true),
        sortOrder: z.number().default(0),
      }))
      .mutation(({ input }) => createUpsell(input)),
    update: staffProcedure
      .input(z.object({ id: z.number(), data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        discountPercent: z.number().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }) }))
      .mutation(({ input }) => updateUpsell(input.id, input.data)),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteUpsell(input.id)),
  }),

  // --- PROMOTIONS ---------------------------------------------------------------
  promotions: router({
    // Only logged-in customers can see promotions that requiresLogin=true
    active: protectedProcedure.query(() => getActivePromotions()),
    // Public promotions (requiresLogin=false) visible to everyone
    publicActive: publicProcedure.query(() =>
      getActivePromotions().then((promos) => promos.filter((p) => !p.requiresLogin))
    ),
    all: staffProcedure.query(() => getAllPromotions()),
    create: staffProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        couponCode: z.string().optional(),
        active: z.boolean().default(true),
        requiresLogin: z.boolean().default(true),
        startsAt: z.date().optional(),
        endsAt: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await createPromotion(input);
        // Alerta automático para clientes
        await createClientAlert({
          type: "promotion",
          title: `🍽️ Nova promoção: ${input.title}`,
          message: input.description ?? "Confira a nova promoção disponível no cardápio!",
          icon: "🍽️",
          url: "/minha-conta",
          expiresAt: input.endsAt,
        });
        return result;
      }),
    update: staffProcedure
      .input(z.object({ id: z.number(), data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        couponCode: z.string().optional(),
        active: z.boolean().optional(),
        requiresLogin: z.boolean().optional(),
        endsAt: z.date().optional(),
      }) }))
      .mutation(({ input }) => updatePromotion(input.id, input.data)),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deletePromotion(input.id)),
  }),

  // --- RAFFLES ---------------------------------------------------------------
  raffles: router({
    active: publicProcedure.query(() => getActiveRaffles()),
    all: staffProcedure.query(() => getAllRaffles()),
    entries: staffProcedure
      .input(z.object({ raffleId: z.number() }))
      .query(({ input }) => getRaffleEntries(input.raffleId)),
    enter: protectedProcedure
      .input(z.object({ raffleId: z.number() }))
      .mutation(({ input, ctx }) => enterRaffle(input.raffleId, ctx.user.id, ctx.user.name ?? "Cliente")),
    draw: staffProcedure
      .input(z.object({ raffleId: z.number() }))
      .mutation(({ input }) => drawRaffleWinner(input.raffleId)),
    create: staffProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        prize: z.string().min(1),
        imageUrl: z.string().optional(),
        endsAt: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await createRaffle({ ...input, status: "active" });
        // Alerta automático para clientes
        await createClientAlert({
          type: "raffle",
          title: `🌟 Novo sorteio: ${input.title}`,
          message: `Prêmio: ${input.prize}. ${input.description ?? "Participe agora e concorra!"}`,
          icon: "🌟",
          url: "/minha-conta",
          expiresAt: input.endsAt,
        });
        return result;
      }),
    update: staffProcedure
      .input(z.object({ id: z.number(), data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        prize: z.string().optional(),
        status: z.enum(["active", "closed", "drawn"]).optional(),
        endsAt: z.date().optional(),
      }) }))
      .mutation(({ input }) => updateRaffle(input.id, input.data)),
  }),

  // --- ADMIN USERS ---------------------------------------------------------------
  adminUsers: router({
    list: staffProcedure.query(async () => {
      const users = await getAllUsers();
      // Strip sensitive fields before sending to admin panel
      return users.map(({ passwordHash: _ph, resetToken: _rt, resetTokenExpiresAt: _rte, ...safe }) => safe);
    }),
    sendCoupon: adminProcedure
      .input(z.object({
        userId: z.number(),
        code: z.string().min(1),
        discountType: z.enum(["percentage", "fixed"]),
        discountValue: z.string(),
        minOrderValue: z.string().optional(),
        maxUses: z.number().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(({ input }) => createUserCoupon(input)),
  }),

  reports: router({
    sales: staffProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return getSalesReport(input.startDate, input.endDate, storeId);
      }),
    topProducts: staffProcedure
      .input(z.object({ limit: z.number().optional(), storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getTopProducts(input?.limit, storeId);
      }),
    topCategories: staffProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return getTopCategories(input.startDate, input.endDate, storeId);
      }),
    ordersByPeriod: staffProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return getOrdersByPeriod(input.startDate, input.endDate, storeId);
      }),
    dailyRevenue: staffProcedure
      .input(z.object({ days: z.number().optional(), storeId: z.number().optional(), timezoneOffset: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getDailyRevenue(input?.days, storeId, input?.timezoneOffset);
      }),
    // Resumo de hoje calculado no servidor com suporte a timezone do cliente
    todaySummary: staffProcedure
      .input(z.object({ timezoneOffset: z.number().optional(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        // Sempre usa America/Sao_Paulo — ignora timezoneOffset do cliente
        const now = new Date();
        const todayStart = getTodayStartUtc(now);
        const todayEnd = getTodayEndUtc(now);
        // Ontem
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayEnd = new Date(todayStart.getTime() - 1);
        const [today, yesterday] = await Promise.all([
          getSalesReport(todayStart, todayEnd, storeId),
          getSalesReport(yesterdayStart, yesterdayEnd, storeId),
        ]);
        return { today, yesterday };
      }),
  }),
  // --- DRIVERS (MOTOBOYS) -----------------------------------------------------
  drivers: router({
    list: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getAllDrivers(false, storeId);
      }),
    create: staffProcedure
      .input(z.object({ name: z.string(), phone: z.string().optional() }))
      .mutation(async ({ input }) => {
        const token = crypto.randomBytes(32).toString("hex");
        const id = await createDriver({ name: input.name, phone: input.phone ?? null, accessToken: token, active: true });
        return { id, accessToken: token };
      }),
    update: staffProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), phone: z.string().optional(), active: z.boolean().optional() }))
      .mutation(({ input }) => updateDriver(input.id, { name: input.name, phone: input.phone, active: input.active })),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteDriver(input.id)),
    assignToOrder: staffProcedure
      .input(z.object({ orderId: z.number(), driverId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        // Capturar motoboy anterior antes de atualizar
        const prevOrder = await getOrderById(input.orderId);
        await assignDriverToOrder(input.orderId, input.driverId);
        const order = await getOrderById(input.orderId);
        // Notificar novo motoboy atribuído
        if (input.driverId) {
          await sendPushToDriver(input.driverId, {
            title: "🛵 Novo pedido atribuído!",
            body: `Pedido #${input.orderId} → ${order?.deliveryAddress ?? "endereço não informado"}`,
            url: "/motoboy",
            tag: `driver-order-${input.orderId}`,
          });
          // Se havia outro motoboy antes, notificar que foi removido
          if (prevOrder?.driverId && prevOrder.driverId !== input.driverId) {
            await sendPushToDriver(prevOrder.driverId, {
              title: "Pedido removido da sua fila",
              body: `O pedido #${input.orderId} foi reatribuído a outro entregador.`,
              url: "/motoboy",
              tag: `driver-unassigned-${input.orderId}`,
            });
          }
        } else if (prevOrder?.driverId) {
          // Motoboy foi desatribuído (driverId = null)
          await sendPushToDriver(prevOrder.driverId, {
            title: "Pedido removido da sua fila",
            body: `O pedido #${input.orderId} foi removido da sua fila de entregas.`,
            url: "/motoboy",
            tag: `driver-unassigned-${input.orderId}`,
          });
        }
      }),
    allLocations: staffProcedure.query(() => getAllActiveDriverLocations()),
    updateLocation: publicProcedure
      .input(z.object({ token: z.string(), lat: z.string(), lng: z.string(), orderId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        await upsertDriverLocation(driver.id, input.lat, input.lng, input.orderId);
        return { ok: true };
      }),
    myActiveOrder: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        const loc = await getDriverLocation(driver.id);
        return { driver: { id: driver.id, name: driver.name }, activeOrderId: loc?.orderId ?? null };
      }),
    locationByOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
        // Only the order's owner, an admin, or a manager can track the driver
        const isStaff = ctx.user.role === "admin" || ctx.user.role === "manager";
        if (order.userId !== ctx.user.id && !isStaff) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        if (!order.driverId) return null;
        const driverId: number = order.driverId;
        const loc = await getDriverLocation(driverId);
        if (!loc) return null;
        const driverInfo = await getDriverById(driverId);
        return { lat: loc.lat, lng: loc.lng, driverName: driverInfo?.name ?? "Motoboy", updatedAt: loc.updatedAt };
      }),

    // --- DRIVER APP: novas procedures ---

    // Dashboard do dia: entregas, ganhos, avaliação
    todayStats: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        return getDriverTodayStats(driver.id);
      }),

    // Detalhes do pedido ativo (endereço, itens, cliente) — mantido por compatibilidade
    activeOrderDetails: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        return getDriverActiveOrderDetails(driver.id);
      }),

    // Lista de TODOS os pedidos atribuídos ao motoboy (out_for_delivery)
    assignedOrders: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        return getDriverAssignedOrders(driver.id);
      }),

    // Histórico de entregas do dia
    todayDeliveries: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        return getDriverTodayDeliveries(driver.id);
      }),

    // Confirmar entrega: status → delivered + push para cliente
    confirmDelivery: publicProcedure
      .input(z.object({ token: z.string(), orderId: z.number() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        const result = await driverConfirmDelivery(driver.id, input.orderId);
        if (!result.success) throw new TRPCError({ code: "BAD_REQUEST", message: result.error ?? "Erro ao confirmar entrega" });
        // Notificar o cliente que o pedido foi entregue
        if (result.customerId) {
          // Push notification com link direto para avaliação
          await sendPushToUser(result.customerId, {
            title: "Pedido entregue! 🍕",
            body: `Seu pedido #${input.orderId} chegou. Que tal avaliar a entrega?`,
            url: `/meus-pedidos?avaliar=${input.orderId}`,
            tag: `delivery-confirmed-${input.orderId}`,
          });
          // Notificação persistente no banco (sino do app)
          await createClientNotification({
            userId: result.customerId,
            title: "Pedido entregue! 🍕",
            message: `Seu pedido #${input.orderId} foi entregue. Avalie a experiência!`,
            type: "order",
          });
        }
        // Notificar admins
        await sendPushToAdmins({
          title: "Entrega confirmada",
          body: `Pedido #${input.orderId} entregue por ${driver.name}`,
          url: "/admin",
          tag: `delivery-confirmed-${input.orderId}`,
        });
        return { success: true };
      }),

    // Salvar push subscription do motoboy
    savePushSubscription: publicProcedure
      .input(z.object({
        token: z.string(),
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
        userAgent: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        await saveDriverPushSubscription(driver.id, input.endpoint, input.p256dh, input.auth, input.userAgent);
        return { ok: true };
      }),

    // Remover push subscription do motoboy
    removePushSubscription: publicProcedure
      .input(z.object({ token: z.string(), endpoint: z.string() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        await removeDriverPushSubscription(driver.id, input.endpoint);
        return { ok: true };
      }),
  }),

  // --- STORE SETTINGS ---------------------------------------------------------
  storeSettings: router({
    // Qualquer um pode ler (para validar horário/CEP no frontend)
    get: publicProcedure.query(async () => {
      const settings = await getAllStoreSettings();
      // Strip sensitive fields from public endpoint
      const { pixKey: _pk, whatsappNumber: _wn, ...publicSettings } = settings;
      return publicSettings;
    }),
    // Staff endpoint with all settings including sensitive fields
    getAdmin: staffProcedure.query(() => getAllStoreSettings()),
    // Staff pode salvar configurações da loja
    save: staffProcedure
      .input(z.object({
        storeHours: z.record(z.string(), z.union([
          z.null(),
          z.object({ open: z.string(), close: z.string() }),
        ])),
        deliveryCepPrefixes: z.array(z.string()),
        pixKey: z.string().optional(),
        whatsappNumber: z.string().optional(),
        deliveryFee: z.string().optional(),
        minOrderValue: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await setStoreSetting("storeHours", JSON.stringify(input.storeHours));
        await setStoreSetting("deliveryCepPrefixes", JSON.stringify(input.deliveryCepPrefixes));
        if (input.pixKey !== undefined) await setStoreSetting("pixKey", input.pixKey);
        if (input.whatsappNumber !== undefined) await setStoreSetting("whatsappNumber", input.whatsappNumber);
        if (input.deliveryFee !== undefined) await setStoreSetting("deliveryFee", input.deliveryFee);
        if (input.minOrderValue !== undefined) await setStoreSetting("minOrderValue", input.minOrderValue);
        return { success: true };
      }),
  }),

  // --- DELIVERY RATINGS -----------------------------------------------------------
  ratings: router({
    // Cliente avalia a entrega após receber o pedido
    submit: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não encontrado' });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Pedido não pertence a você' });
        if (order.status !== 'delivered') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pedido ainda não foi entregue' });
        if (!order.driverId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pedido sem motoboy atribuído' });
        const existing = await getRatingByOrder(input.orderId);
        if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Pedido já foi avaliado' });
        await submitDeliveryRating({
          orderId: input.orderId,
          driverId: order.driverId,
          userId: ctx.user.id,
          rating: input.rating,
          comment: input.comment ?? null,
        });
        // Disparar trigger de automação: rating_submitted (sempre) e rating_negative (≤3)
        const userPhone = ctx.user.phone ?? undefined;
        fireJourneyTrigger("rating_submitted", ctx.user.id, userPhone).catch(() => {});
        if (input.rating <= 3) {
          fireJourneyTrigger("rating_negative", ctx.user.id, userPhone).catch(() => {});
        }
        return { success: true };
      }),

    // Verificar se um pedido já foi avaliado
    getByOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order || order.userId !== ctx.user.id) return null;
        return getRatingByOrder(input.orderId);
      }),

    // Perfil público do motoboy com avaliações e histórico
    driverProfile: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => {
        const driver = await getDriverById(input.driverId);
        if (!driver) throw new TRPCError({ code: 'NOT_FOUND', message: 'Motoboy não encontrado' });
        const [ratings, stats, history] = await Promise.all([
          getDriverRatings(input.driverId),
          getDriverAverageRating(input.driverId),
          getDriverDeliveryHistory(input.driverId),
        ]);
        // Strip sensitive fields: never expose accessToken or phone to public
        const { accessToken: _at, phone: _ph, ...safeDriver } = driver;
        // Strip userId from ratings to avoid exposing customer identities
        const safeRatings = ratings.map(({ userId: _uid, ...r }) => r);
        return { driver: safeDriver, ratings: safeRatings, stats, history };
      }),

    // Admin: ver todas as avaliações de um motoboy
    driverRatings: adminProcedure
      .input(z.object({ driverId: z.number() }))
      .query(({ input }) => getDriverRatings(input.driverId)),
  }),

  // --- ADDRESSES --------------------------------------------------------------
  addresses: router({
    list: protectedProcedure.query(({ ctx }) => getUserAddresses(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        label: z.string().min(1).max(50),
        address: z.string().min(1),
        cep: z.string().optional(),
        city: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) => createUserAddress({ ...input, userId: ctx.user.id, isDefault: input.isDefault ?? false })),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        label: z.string().min(1).max(50).optional(),
        address: z.string().min(1).optional(),
        cep: z.string().optional(),
        city: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) => { const { id, ...data } = input; return updateUserAddress(id, ctx.user.id, data); }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteUserAddress(input.id, ctx.user.id)),
  }),

  // --- FAVORITES --------------------------------------------------------------
  favorites: router({
    list: protectedProcedure.query(({ ctx }) => getUserFavorites(ctx.user.id)),
    toggle: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(({ ctx, input }) => toggleFavorite(ctx.user.id, input.productId)),
  }),

  // --- NOTIFICATIONS ----------------------------------------------------------
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => getClientNotifications(ctx.user.id)),
    unreadCount: protectedProcedure.query(({ ctx }) => getUnreadNotificationCount(ctx.user.id)),
    markRead: protectedProcedure.mutation(({ ctx }) => markNotificationsRead(ctx.user.id)),
    send: adminProcedure
      .input(z.object({
        userId: z.number(),
        title: z.string(),
        message: z.string(),
        type: z.enum(['order', 'promo', 'system']).optional(),
      }))
      .mutation(({ input }) => createClientNotification({ ...input, type: input.type ?? 'system' })),
    // --- Agendamento de notificações ---
    scheduleList: staffProcedure.query(() => listScheduledNotifications()),
    scheduleCreate: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        message: z.string().min(1),
        channel: z.enum(['push', 'whatsapp', 'both']).default('push'),
        targetAudience: z.enum(['all', 'active', 'inactive', 'club']).default('all'),
        scheduledAt: z.date(),
        recurrence: z.enum(['once', 'daily', 'weekly']).default('once'),
        neighborhoodFilter: z.array(z.string()).optional().nullable(),
      }))
      .mutation(({ ctx, input }) => createScheduledNotification({
        title: input.title,
        message: input.message,
        channel: input.channel,
        targetAudience: input.targetAudience,
        scheduledAt: input.scheduledAt,
        recurrence: input.recurrence,
        neighborhoodFilter: input.neighborhoodFilter && input.neighborhoodFilter.length > 0
          ? JSON.stringify(input.neighborhoodFilter)
          : null,
        status: 'pending',
        sentCount: 0,
        createdBy: ctx.user.id,
      })),
    scheduleCancel: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => cancelScheduledNotification(input.id)),
    scheduleDelete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteScheduledNotification(input.id)),
  }),

  // --- LOYALTY ----------------------------------------------------------------
  loyalty: router({
    points: protectedProcedure.query(({ ctx }) => getUserLoyaltyPoints(ctx.user.id)),
    spendingHistory: protectedProcedure.query(({ ctx }) => getUserSpendingHistory(ctx.user.id)),
    history: protectedProcedure.query(({ ctx }) => getLoyaltyHistory(ctx.user.id)),
    // Preview do desconto de pontos (sem debitar — o débito acontece no createOrder)
    preview: protectedProcedure
      .input(z.object({ points: z.number().int().min(50).max(5000) }))
      .query(async ({ ctx, input }) => {
        const POINTS_TO_BRL = 0.10;
        const balance = await getUserLoyaltyPoints(ctx.user.id);
        const pts = Math.min(input.points, balance);
        if (pts < 50) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pontos insuficientes para resgate.' });
        const discount = parseFloat((pts * POINTS_TO_BRL).toFixed(2));
        return { discount, pointsUsed: pts, balance };
      }),
    // Admin: adicionar pontos manualmente
    adminAdd: adminProcedure
      .input(z.object({ userId: z.number(), points: z.number().int().min(1), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        await addLoyaltyPoints(input.userId, input.points, undefined, input.description ?? `+${input.points} pontos (manual)`);
        return { ok: true };
      }),
  }),

  // --- AVATAR -----------------------------------------------------------------------------
  avatar: router({
    upload: protectedProcedure
      .input(z.object({
        base64: z.string().max(4_000_000), // ~3MB base64 limit for avatars
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePutAdapter: storagePut } = await import("./adapters/storage");
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.split("/")[1] ?? "jpg";
        const key = `avatars/user-${ctx.user.id}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await updateUserAvatar(ctx.user.id, url);
        return { url };
      }),
    update: protectedProcedure
      .input(z.object({ avatarUrl: z.string().url() }))
      .mutation(({ ctx, input }) => updateUserAvatar(ctx.user.id, input.avatarUrl)),
  }),
  // --- CHAT (mensagens do pedido) ---
  chat: router({
    messages: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
        if (order.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const msgs = await getOrderMessages(input.orderId);
        return { messages: msgs, aiPaused: (order as any).aiPaused ?? false };
      }),
    send: protectedProcedure
      .input(z.object({ orderId: z.number(), message: z.string().min(1).max(1000), senderRole: z.enum(['customer', 'admin']).optional() }))
      .mutation(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
        if (order.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        // Use explicit senderRole if provided (e.g. admin user testing as customer), otherwise derive from db role
        const senderRole = input.senderRole ?? (ctx.user.role === 'admin' ? 'admin' : 'customer');
        // Security: non-admin users cannot claim admin role
        if (senderRole === 'admin' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const msg = await sendOrderMessage({ orderId: input.orderId, userId: ctx.user.id, senderRole, message: input.message });
        // Notificar motoboy quando admin envia mensagem e o pedido tem motoboy atribuído
        if (senderRole === 'admin' && order.driverId) {
          await sendPushToDriver(order.driverId, {
            title: "💬 Mensagem do restaurante",
            body: input.message.length > 80 ? input.message.slice(0, 77) + '...' : input.message,
            url: "/motoboy",
            tag: `driver-msg-${input.orderId}`,
          });
        }
        return msg;
      }),
    markRead: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership before marking messages as read
        if (ctx.user.role !== 'admin') {
          const order = await getOrderById(input.orderId);
          if (!order || order.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const readerRole = ctx.user.role === 'admin' ? 'admin' : 'customer';
        await markMessagesRead(input.orderId, readerRole);
        return { ok: true };
      }),
    unreadCount: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify ownership before returning unread count
        if (ctx.user.role !== 'admin') {
          const order = await getOrderById(input.orderId);
          if (!order || order.userId !== ctx.user.id) return { count: 0 };
        }
        const readerRole = ctx.user.role === 'admin' ? 'admin' : 'customer';
        return { count: await getUnreadCountForOrder(input.orderId, readerRole) };
      }),
    totalUnread: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role === 'admin' || ctx.user.role === 'manager') {
          return { count: await getTotalUnreadForAdmin() };
        }
        return { count: await getTotalUnreadForUser(ctx.user.id) };
      }),
    // IA responde automaticamente quando o cliente envia uma mensagem
    aiReply: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
        if (order.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        // Busca itens do pedido e histórico de mensagens para contexto
        const [items, messages, products, dbSettings] = await Promise.all([
          getOrderItems(input.orderId),
          getOrderMessages(input.orderId),
          getProducts({ activeOnly: true }),
          getAllStoreSettings(),
        ]);
        const statusMap: Record<string, string> = {
          pending: 'Aguardando confirmação',
          confirmed: 'Confirmado',
          preparing: 'Em preparo',
          out_for_delivery: 'Saiu para entrega',
          delivered: 'Entregue',
          cancelled: 'Cancelado',
        };
        const itemsList = items.map(i => `${i.productName} x${i.quantity} (R$ ${(parseFloat(i.productPrice) * i.quantity).toFixed(2)})`).join(', ');
        const menuSummary = products.slice(0, 30).map(p => `${p.name} — R$ ${p.price}`).join('; ');
        const history = messages.slice(-10).map(m => `${m.senderRole === 'admin' ? 'Atendente' : 'Cliente'}: ${m.message}`).join('\n');
        const { callLLM } = await import('./adapters/llm');
        const { content } = await callLLM({
          messages: [
            {
              role: 'system',
              content: `Você é a assistente virtual da Bonatto Pizza, uma pizzaria artesanal em Mateus Leme/MG. Responda de forma simpática, direta e em português brasileiro. Máximo 3 frases curtas. Nunca invente informações — baseie-se apenas no contexto fornecido.\n\nPedido #${order.id}:\n- Cliente: ${order.customerName}\n- Status: ${statusMap[order.status] ?? order.status}\n- Itens: ${itemsList}\n- Endereço: ${order.deliveryAddress}\n- Pagamento: ${order.paymentMethod} (${order.paymentStatus === 'paid' ? 'pago' : 'pendente'})\n\nCardápio atual (resumo): ${menuSummary}\n\nHorário de funcionamento: ${buildHoursDescription(dbSettings.storeHours)}.\nTelefone/WhatsApp: ${dbSettings.whatsappNumber ?? '(37) 99999-0000'}`,
            },
            ...messages.slice(-6).map(m => ({
              role: (m.senderRole === 'admin' ? 'assistant' : 'user') as 'assistant' | 'user',
              content: m.message,
            })),
          ],
          temperature: 0.6,
          maxTokens: 200,
        });
        // Salva a resposta da IA como mensagem do admin
        // Não responde se a IA está pausada para este pedido
        if ((order as any).aiPaused) return { reply: '' };
        const adminUser = await getUserById(ctx.user.id);
        const adminId = adminUser?.id ?? ctx.user.id;
        await sendOrderMessage({ orderId: input.orderId, userId: adminId, senderRole: 'admin', message: content.trim() });
        return { reply: content.trim() };
      }),

    // Solicitar atendente humano — pausa a IA e notifica o admin
    requestHuman: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
        // Pausa a IA para este pedido
        await setOrderAiPaused(input.orderId, true);
        // Notifica o admin via push
        await sendPushToAdmins({
          title: '\uD83E\uDDD1 Atendimento Humano Solicitado',
          body: `Pedido #${input.orderId} \u2014 ${order.customerName} quer falar com um atendente.`,
          url: `/admin?tab=pedidos&order=${input.orderId}`,
        });
        // Envia mensagem automática informando o cliente
        const systemMsg = 'Entendido! Vou chamar um atendente para você. Aguarde um momento \u2014 normalmente respondemos em poucos minutos. \uD83D\uDE42';
        await sendOrderMessage({ orderId: input.orderId, userId: ctx.user.id, senderRole: 'admin', message: systemMsg });
        return { ok: true };
      }),

    // Retomar IA (admin pode reativar)
    resumeAI: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await setOrderAiPaused(input.orderId, false);
        return { ok: true };
      }),
    ordersWithMessages: staffProcedure
      .query(async ({ ctx }) => {
        const storeId = await resolveStoreId(ctx.user, undefined);
        return getOrdersWithMessages(storeId);
      }),
  }),

  // ─── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
  push: router({
    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string().url(),
        p256dh: z.string(),
        auth: z.string(),
        userAgent: z.string().max(512).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const safeUserAgent = input.userAgent?.substring(0, 512);
        await savePushSubscription(ctx.user.id, input.endpoint, input.p256dh, input.auth, safeUserAgent);
        return { ok: true };
      }),
    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await removePushSubscription(ctx.user.id, input.endpoint);
        return { ok: true };
      }),
    vapidPublicKey: publicProcedure.query(() => {
      return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
    }),
  }),
  // ─── MARKETING AUTOMATION ──────────────────────────────────────────────────
  automations: router({
    listJourneys: adminProcedure.query(async () => {
      const list = await listJourneys();
      return list.map(j => ({ ...j, steps: JSON.parse(j.steps) as JourneyStep[] }));
    }),
    getJourney: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const j = await getJourneyById(input.id);
        if (!j) throw new TRPCError({ code: 'NOT_FOUND' });
        return { ...j, steps: JSON.parse(j.steps) as JourneyStep[] };
      }),
    createJourney: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        trigger: z.enum(['checkout_abandoned', 'tag_inativo_15', 'tag_inativo_30', 'tag_inativo_60', 'tag_inativo_custom', 'first_order', 'new_user', 'club_subscriber', 'manual', 'order_delivered', 'order_cancelled', 'birthday', 'loyalty_milestone', 'rating_submitted', 'rating_negative', 'club_expiring', 'first_order_month']),
        steps: z.array(z.object({
          id: z.string(),
          type: z.enum(['wait', 'send_whatsapp', 'send_push', 'condition', 'add_tag', 'remove_tag', 'webhook', 'send_coupon', 'update_loyalty', 'send_alert', 'split_ab', 'pause_journey', 'notify_admin']),
          label: z.string(),
          delayMinutes: z.number().optional(),
          message: z.string().optional(),
          title: z.string().optional(),
          condition: z.enum(['purchased_since_start', 'has_tag', 'has_min_orders', 'has_min_points']).optional(),
          conditionTag: z.string().optional(),
          conditionValue: z.number().optional(),
          onTrue: z.enum(['continue', 'stop']).optional(),
          onFalse: z.enum(['continue', 'stop']).optional(),
          tag: z.string().optional(),
          couponDiscountType: z.enum(['percentage', 'fixed']).optional(),
          couponDiscountValue: z.number().optional(),
          couponExpiryDays: z.number().optional(),
          loyaltyPoints: z.number().optional(),
          loyaltyDescription: z.string().optional(),
          alertTitle: z.string().optional(),
          alertMessage: z.string().optional(),
          alertIcon: z.string().optional(),
          alertUrl: z.string().optional(),
          messageA: z.string().optional(),
          messageB: z.string().optional(),
          titleA: z.string().optional(),
          titleB: z.string().optional(),
          splitChannel: z.enum(['whatsapp', 'push']).optional(),
          webhookUrl: z.string().optional(),
          secret: z.string().optional(),
          pauseJourneyId: z.number().optional(),
          adminTaskTitle: z.string().optional(),
          adminTaskMessage: z.string().optional(),
          adminTaskPriority: z.enum(['low', 'normal', 'high']).optional(),
        })),
        daysInactive: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createJourney(input);
        return { id };
      }),
    updateJourney: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        trigger: z.enum(['checkout_abandoned', 'tag_inativo_15', 'tag_inativo_30', 'tag_inativo_60', 'tag_inativo_custom', 'first_order', 'new_user', 'club_subscriber', 'manual', 'order_delivered', 'order_cancelled', 'birthday', 'loyalty_milestone', 'rating_submitted', 'rating_negative', 'club_expiring', 'first_order_month']).optional(),
        status: z.enum(['active', 'paused', 'draft']).optional(),
        steps: z.array(z.object({
          id: z.string(),
          type: z.enum(['wait', 'send_whatsapp', 'send_push', 'condition', 'add_tag', 'remove_tag', 'webhook', 'send_coupon', 'update_loyalty', 'send_alert', 'split_ab', 'pause_journey', 'notify_admin']),
          label: z.string(),
          delayMinutes: z.number().optional(),
          message: z.string().optional(),
          title: z.string().optional(),
          condition: z.enum(['purchased_since_start', 'has_tag', 'has_min_orders', 'has_min_points']).optional(),
          conditionTag: z.string().optional(),
          conditionValue: z.number().optional(),
          onTrue: z.enum(['continue', 'stop']).optional(),
          onFalse: z.enum(['continue', 'stop']).optional(),
          tag: z.string().optional(),
          couponDiscountType: z.enum(['percentage', 'fixed']).optional(),
          couponDiscountValue: z.number().optional(),
          couponExpiryDays: z.number().optional(),
          loyaltyPoints: z.number().optional(),
          loyaltyDescription: z.string().optional(),
          alertTitle: z.string().optional(),
          alertMessage: z.string().optional(),
          alertIcon: z.string().optional(),
          alertUrl: z.string().optional(),
          messageA: z.string().optional(),
          messageB: z.string().optional(),
          titleA: z.string().optional(),
          titleB: z.string().optional(),
          splitChannel: z.enum(['whatsapp', 'push']).optional(),
          webhookUrl: z.string().optional(),
          secret: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateJourney(id, data as Parameters<typeof updateJourney>[1]);
        return { ok: true };
      }),
    deleteJourney: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteJourney(input.id);
        return { ok: true };
      }),
    duplicateJourney: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const newId = await duplicateJourney(input.id);
        if (newId === -1) throw new TRPCError({ code: 'NOT_FOUND', message: 'Jornada não encontrada' });
        return { id: newId };
      }),
    toggleJourney: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(['active', 'paused', 'draft']) }))
      .mutation(async ({ input }) => {
        await updateJourney(input.id, { status: input.status });
        return { ok: true };
      }),
    listExecutions: adminProcedure
      .input(z.object({ journeyId: z.number().optional() }))
      .query(async ({ input }) => listExecutions(input.journeyId)),
    cancelExecution: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await cancelExecution(input.id);
        return { ok: true };
      }),
    triggerJourney: adminProcedure
      .input(z.object({ journeyId: z.number(), userIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        let started = 0;
        for (const uid of input.userIds) {
          const r = await startJourneyExecution(input.journeyId, uid);
          if (r > 0) started++;
        }
        return { started };
      }),
    listCustomerTags: adminProcedure.query(async () => {
      const result = await getAllCustomerTagsWithUsers();
      return (result as unknown as [unknown[]])[0] as Array<{
        userId: number; tag: string; assignedAt: Date; name: string; email: string; phone: string;
      }>;
    }),
    refreshTags: adminProcedure.mutation(async () => {
      await refreshCustomerTags();
      return { ok: true };
    }),
    listAbandonedCarts: adminProcedure
      .input(z.object({ status: z.enum(['pending', 'recovered', 'expired']).optional() }))
      .query(async ({ input }) => listAbandonedCarts(input.status)),
    registerAbandonedCart: protectedProcedure
      .input(z.object({
        customerName: z.string(),
        customerPhone: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          quantity: z.number(),
          productPrice: z.string(),
        })),
        total: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await registerAbandonedCart({ userId: ctx.user.id, ...input });
        return { id };
      }),
    generateWebhookToken: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const token = crypto.randomBytes(32).toString('hex');
        await updateJourney(input.id, { webhookToken: token } as Parameters<typeof updateJourney>[1]);
        return { token };
      }),
    getWebhookToken: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const j = await getJourneyById(input.id);
        if (!j) throw new TRPCError({ code: 'NOT_FOUND' });
        return { token: (j as Record<string, unknown>).webhookToken as string | null };
      }),
    processExecutions: adminProcedure.mutation(async () => {
      await processJourneyExecutions();
      return { ok: true };
    }),
    getExecutionLogs: adminProcedure
      .input(z.object({ executionId: z.number() }))
      .query(async ({ input }) => {
        const execs = await listExecutions();
        const exec = execs.find(e => e.id === input.executionId);
        if (!exec) throw new TRPCError({ code: 'NOT_FOUND' });
        return {
          ...exec,
          logs: exec.logs ? JSON.parse(exec.logs) as Array<{ at: string; msg: string }> : [],
        };
      }),
    testTrigger: adminProcedure
      .input(z.object({
        journeyId: z.number(),
        trigger: z.enum(['checkout_abandoned', 'tag_inativo_15', 'tag_inativo_30', 'tag_inativo_60', 'tag_inativo_custom', 'first_order', 'new_user', 'club_subscriber', 'manual', 'order_delivered', 'order_cancelled', 'birthday', 'loyalty_milestone', 'rating_submitted', 'rating_negative', 'club_expiring', 'first_order_month']),
        userId: z.number().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const targetUserId = input.userId ?? ctx.user.id;
        await startJourneyExecution(input.journeyId, targetUserId, input.phone);
        return { ok: true, message: `Gatilho disparado para jornada #${input.journeyId} com usuário #${targetUserId}` };
      }),

    // ── Painel A/B: estatísticas de grupos A e B por jornada ─────────────────
    getAbStats: adminProcedure
      .input(z.object({ journeyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { groupA: 0, groupB: 0, conversionA: 0, conversionB: 0, revenueA: 0, revenueB: 0 };
        const execs = await db
          .select()
          .from(journeyExecutions)
          .where(eq(journeyExecutions.journeyId, input.journeyId));
        const groupA = execs.filter(e => e.abGroup === 'A');
        const groupB = execs.filter(e => e.abGroup === 'B');
        const convA = groupA.filter(e => e.convertedAt !== null).length;
        const convB = groupB.filter(e => e.convertedAt !== null).length;
        // Calcular receita atribuída (pedidos feitos durante a jornada)
        const convOrderIdsA = groupA.map(e => e.conversionOrderId).filter(Boolean) as number[];
        const convOrderIdsB = groupB.map(e => e.conversionOrderId).filter(Boolean) as number[];
        let revenueA = 0;
        let revenueB = 0;
        if (convOrderIdsA.length > 0) {
          const ordersA = await db.select({ total: orders.total }).from(orders).where(inArray(orders.id, convOrderIdsA));
          revenueA = ordersA.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
        }
        if (convOrderIdsB.length > 0) {
          const ordersB = await db.select({ total: orders.total }).from(orders).where(inArray(orders.id, convOrderIdsB));
          revenueB = ordersB.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
        }
        return {
          groupA: groupA.length,
          groupB: groupB.length,
          conversionA: convA,
          conversionB: convB,
          conversionRateA: groupA.length > 0 ? Math.round((convA / groupA.length) * 100) : 0,
          conversionRateB: groupB.length > 0 ? Math.round((convB / groupB.length) * 100) : 0,
          revenueA: Math.round(revenueA * 100) / 100,
          revenueB: Math.round(revenueB * 100) / 100,
        };
      }),

    // ── Métricas globais de automações ───────────────────────────────────────
    getGlobalMetrics: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { totalExecutions: 0, completedExecutions: 0, conversions: 0, conversionRate: 0, attributedRevenue: 0, activeJourneys: 0, topJourneys: [] };
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Execuções do mês
        const allExecs = await db
          .select()
          .from(journeyExecutions)
          .where(gte(journeyExecutions.startedAt, monthStart));
        const completed = allExecs.filter(e => e.status === 'completed').length;
        const conversions = allExecs.filter(e => e.convertedAt !== null).length;
        // Receita atribuída
        const convOrderIds = allExecs.map(e => e.conversionOrderId).filter(Boolean) as number[];
        let attributedRevenue = 0;
        if (convOrderIds.length > 0) {
          const convOrders = await db.select({ total: orders.total }).from(orders).where(inArray(orders.id, convOrderIds));
          attributedRevenue = convOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
        }
        // Jornadas ativas
        const activeJourneysList = await db.select({ id: journeys.id, name: journeys.name }).from(journeys).where(eq(journeys.status, 'active'));
        // Top 5 jornadas por execuções no mês
        const execsByJourney = allExecs.reduce((acc, e) => {
          acc[e.journeyId] = (acc[e.journeyId] ?? 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        const allJourneysList = await db.select({ id: journeys.id, name: journeys.name }).from(journeys);
        const topJourneys = Object.entries(execsByJourney)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([jId, count]) => ({
            id: Number(jId),
            name: allJourneysList.find(j => j.id === Number(jId))?.name ?? `Jornada #${jId}`,
            executions: count,
            conversions: allExecs.filter(e => e.journeyId === Number(jId) && e.convertedAt !== null).length,
          }));
        return {
          totalExecutions: allExecs.length,
          completedExecutions: completed,
          conversions,
          conversionRate: allExecs.length > 0 ? Math.round((conversions / allExecs.length) * 100) : 0,
          attributedRevenue: Math.round(attributedRevenue * 100) / 100,
          activeJourneys: activeJourneysList.length,
          topJourneys,
        };
      }),

    // ── Histórico de jornadas por cliente ────────────────────────────────────
    getCustomerJourneyHistory: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const execs = await db
          .select()
          .from(journeyExecutions)
          .where(eq(journeyExecutions.userId, input.userId))
          .orderBy(desc(journeyExecutions.startedAt))
          .limit(50);
        const journeyIds = Array.from(new Set(execs.map(e => e.journeyId)));
        const journeyList = journeyIds.length > 0
          ? await db.select({ id: journeys.id, name: journeys.name, trigger: journeys.trigger }).from(journeys).where(inArray(journeys.id, journeyIds))
          : [];
        return execs.map(e => ({
          ...e,
          journeyName: journeyList.find(j => j.id === e.journeyId)?.name ?? `Jornada #${e.journeyId}`,
          journeyTrigger: journeyList.find(j => j.id === e.journeyId)?.trigger ?? 'manual',
          logs: e.logs ? JSON.parse(e.logs) as Array<{ at: string; msg: string }> : [],
        }));
      }),
  }),

  // ─── CRM ───────────────────────────────────────────────────────────────────
  crm: router({
    listCustomers: staffProcedure
      .input(z.object({
        search: z.string().optional(),
        tag: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        storeId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        if (input.tag) {
          const customers = await getCrmCustomersByTag(input.tag);
          return { customers, total: customers.length };
        }
        const [customers, total] = await Promise.all([
          getCrmCustomers({ search: input.search, limit: input.limit, offset: input.offset, storeId }),
          countCrmCustomers(input.search, storeId),
        ]);
        return { customers, total };
      }),
    getCustomerDetail: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const detail = await getCrmCustomerDetail(input.userId);
        if (!detail) throw new TRPCError({ code: 'NOT_FOUND' });
        const [tags, executions, carts] = await Promise.all([
          getTagsForCustomer(input.userId),
          getJourneyExecutionsByUser(input.userId),
          getAbandonedCartsByUser(input.userId),
        ]);
        return { ...detail, tags, executions, carts };
      }),
    assignTag: adminProcedure
      .input(z.object({ userId: z.number(), tag: z.string() }))
      .mutation(async ({ input }) => {
        await assignTagToCustomer(input.userId, input.tag);
        return { ok: true };
      }),
    removeTag: adminProcedure
      .input(z.object({ userId: z.number(), tag: z.string() }))
      .mutation(async ({ input }) => {
        await removeTagFromCustomer(input.userId, input.tag);
        return { ok: true };
      }),
    getStats: adminProcedure.query(async () => {
      return getCrmStats();
    }),

    // ── Tags Personalizadas ──────────────────────────────────────────────
    listCustomTags: adminProcedure.query(async () => {
      return listCustomTags();
    }),
    createCustomTag: adminProcedure
      .input(z.object({ name: z.string().min(1).max(100), color: z.string().default("#6b7280"), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        const id = await createCustomTag(input);
        return { id };
      }),
    updateCustomTag: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), color: z.string().optional(), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateCustomTag(id, data);
        return { ok: true };
      }),
    deleteCustomTag: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomTag(input.id);
        return { ok: true };
      }),
    assignCustomTag: adminProcedure
      .input(z.object({ userId: z.number(), tagId: z.number() }))
      .mutation(async ({ input }) => {
        await assignCustomTagToCustomer(input.userId, input.tagId);
        return { ok: true };
      }),
    removeCustomTag: adminProcedure
      .input(z.object({ userId: z.number(), tagId: z.number() }))
      .mutation(async ({ input }) => {
        await removeCustomTagFromCustomer(input.userId, input.tagId);
        return { ok: true };
      }),
    getCustomTagsForCustomer: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getCustomTagsForCustomer(input.userId);
      }),
    getCustomersByCustomTag: adminProcedure
      .input(z.object({ tagName: z.string() }))
      .query(async ({ input }) => {
        return getCustomersByCustomTagName(input.tagName);
      }),
    triggerJourneyForTag: adminProcedure
      .input(z.object({ journeyId: z.number(), tag: z.string() }))
      .mutation(async ({ input }) => {
        const customers = await getCrmCustomersByTag(input.tag);
        let started = 0;
        for (const c of customers) {
          const r = await startJourneyExecution(input.journeyId, c.id, c.phone ?? undefined);
          if (r > 0) started++;
        }
        return { started, total: customers.length };
      }),
    triggerJourneyForCustomer: adminProcedure
      .input(z.object({ journeyId: z.number(), userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await import('./db');
        const detail = await db.getCrmCustomerDetail(input.userId);
        if (!detail) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        const r = await startJourneyExecution(input.journeyId, input.userId, detail.user.phone ?? undefined);
        return { started: r > 0 ? 1 : 0 };
      }),
  }),

  // ── Templates de Notificação ──────────────────────────────────────────────
  notificationTemplates: router({
    list: staffProcedure
      .input(z.object({ event: z.string().optional(), channel: z.string().optional() }).optional())
      .query(async ({ input }) => listNotificationTemplates(input ?? {})),

    seed: staffProcedure.mutation(async () => {
      await seedNotificationTemplates();
      return { ok: true };
    }),

     create: staffProcedure
      .input(z.object({
        event: z.enum(['order_confirmed', 'order_preparing', 'order_out_for_delivery', 'order_delivered', 'order_cancelled', 'cart_abandoned_step1', 'cart_abandoned_step2', 'cart_abandoned_step3', 'reactivation_15', 'reactivation_30', 'reactivation_60', 'custom']),
        channel: z.enum(['push', 'whatsapp', 'both']).default('both'),
        title: z.string().min(1).max(200),
        body: z.string().min(1),
        redirectUrl: z.string().max(500).optional(),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await createNotificationTemplate(input);
        return { id };
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        body: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
        channel: z.enum(['push', 'whatsapp', 'both']).optional(),
        redirectUrl: z.string().max(500).optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateNotificationTemplate(id, data);
        return { ok: true };
      }),

    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteNotificationTemplate(input.id);
        return { ok: true };
      }),

    // Disparo de notificação personalizada em massa
    sendCustom: staffProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        body: z.string().min(1),
        redirectUrl: z.string().optional(), // ex: "/cardapio", "/promocoes", URL completa
        tag: z.string().optional(),         // tag de cliente para segmentar (ex: "inativo_30")
        // se tag for undefined, envia para todos
      }))
      .mutation(async ({ input }) => {
        let userIds: number[] | undefined;

        // Se tiver tag, buscar apenas os usuários com aquela tag
        if (input.tag) {
          const { getDb } = await import('./db');
          const { customerTags } = await import('../drizzle/schema');
          const { eq } = await import('drizzle-orm');
          const db = await getDb();
          if (db) {
            const rows = await db
              .select({ userId: customerTags.userId })
              .from(customerTags)
              .where(eq(customerTags.tag as any, input.tag));
            userIds = rows.map((r: { userId: number }) => r.userId);
            if (userIds.length === 0) return { sent: 0 as number, failed: 0 as number, skipped: true as boolean };
          }
        }

        const result = await sendPushToAllUsers(
          {
            title: input.title,
            body: input.body,
            url: input.redirectUrl ?? "/",
            tag: input.tag ? `custom-${input.tag}` : "custom",
          },
          userIds
        );
        return result;
      }),
  }),
  // --- ZONAS DE ENTREGA POR BAIRRO ---
  deliveryZones: router({
    // Público: buscar zona por bairro (usado no checkout)
    search: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        return searchDeliveryZones(input.query);
      }),
    getByNeighborhood: publicProcedure
      .input(z.object({ neighborhood: z.string() }))
      .query(async ({ input }) => {
        return getDeliveryZoneByNeighborhood(input.neighborhood);
      }),
    // Staff: CRUD completo
    list: staffProcedure.query(async () => {
      return getAllDeliveryZones(false);
    }),
    create: staffProcedure
      .input(z.object({
        neighborhood: z.string().min(1).max(200),
        city: z.string().max(200).optional(),
        deliveryFee: z.string(),
        estimatedMinutes: z.number().int().min(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createDeliveryZone(input);
        return { id };
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        neighborhood: z.string().min(1).max(200).optional(),
        city: z.string().max(200).optional(),
        deliveryFee: z.string().optional(),
        estimatedMinutes: z.number().int().min(1).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateDeliveryZone(id, data);
        return { ok: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDeliveryZone(input.id);
        return { ok: true };
      }),
  }),
  // --- LOJAS (MULTI-TENANT) --------------------------------------------------
  stores: storesRouter,

  // --- CLUBE DO BONATTO -------------------------------------------------------
  club: clubRouter,

  // --- MENU SLIDES -----------------------------------------------------------
  analytics: router({
    salesOverview: staffProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        storeId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return getSalesOverview(input.startDate, input.endDate, storeId);
      }),
    salesTimeSeries: staffProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        storeId: z.number().optional(),
        timezoneOffset: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return getSalesTimeSeries(input.startDate, input.endDate, storeId, input.timezoneOffset);
      }),
    recentOrders: staffProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).optional(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return getRecentOrdersFeed(input.limit ?? 20, storeId);
      }),
  }),

  menuSlides: router({
    uploadImage: staffProcedure
      .input(z.object({
        base64: z.string().max(15_000_000), // ~11MB base64 limit for banners
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(255).optional(),
      }))
      .mutation(async ({ input }) => {
        const { storagePutAdapter: storagePut } = await import("./adapters/storage");
        const { compressToWebP } = await import("./imageUtils");
        const rawBuffer = Buffer.from(input.base64, "base64");
        const { buffer, mimeType, ext, reductionPct } = await compressToWebP(rawBuffer, 85, 1920);
        const key = `banners/slide-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        console.log(`[upload] banner comprimido ${reductionPct}% → WebP`);
        return { url };
      }),
    list: publicProcedure.query(() => getMenuSlides(true)),
    listAll: staffProcedure.query(() => getMenuSlides(false)),
    seed: staffProcedure.mutation(() => seedMenuSlides()),
    create: staffProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        subtitle: z.string().max(300).optional().nullable(),
        imageUrl: z.string().max(2000).optional().nullable(),
        videoUrl: z.string().max(2000).optional().nullable(),
        badgeText: z.string().max(80).optional().nullable(),
        ctaText: z.string().max(80).optional().nullable(),
        ctaLink: z.string().max(500).optional().nullable(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(({ input }) => createMenuSlide(input)),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        subtitle: z.string().max(300).optional().nullable(),
        imageUrl: z.string().max(2000).optional().nullable(),
        videoUrl: z.string().max(2000).optional().nullable(),
        badgeText: z.string().max(80).optional().nullable(),
        ctaText: z.string().max(80).optional().nullable(),
        ctaLink: z.string().max(500).optional().nullable(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateMenuSlide(id, data);
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteMenuSlide(input.id);
        return { ok: true };
      }),
  }),

  // --- CARROSSEL HERO --------------------------------------------------------
  carousel: router({
    list: publicProcedure.query(() => getCarouselImages(true)),
    listAll: staffProcedure.query(() => getCarouselImages(false)),
    uploadImage: staffProcedure
      .input(z.object({
        base64: z.string().max(15_000_000), // ~11MB base64 limit for carousel
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(255).optional(),
      }))
      .mutation(async ({ input }) => {
        const { storagePutAdapter: storagePut } = await import("./adapters/storage");
        const { compressToWebP } = await import("./imageUtils");
        const rawBuffer = Buffer.from(input.base64, "base64");
        const { buffer, mimeType, ext, reductionPct } = await compressToWebP(rawBuffer, 85, 1920);
        const key = `carousel/hero-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        console.log(`[upload] carrossel comprimido ${reductionPct}% → WebP`);
        return { url };
      }),
    create: staffProcedure
      .input(z.object({ imageUrl: z.string().min(1), title: z.string().optional().nullable(), sortOrder: z.number().optional() }))
      .mutation(({ input }) => createCarouselImage(input)),
    update: staffProcedure
      .input(z.object({ id: z.number(), imageUrl: z.string().optional(), title: z.string().optional().nullable(), sortOrder: z.number().optional(), active: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return updateCarouselImage(id, data); }),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await deleteCarouselImage(input.id); return { ok: true }; }),
  }),

  // ─── RECOVERY DASHBOARD ─────────────────────────────────────────────────────────────
  recovery: router({

    /** KPIs gerais de recuperação de receita */
    stats: adminProcedure
      .input(z.object({
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { sql } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const days = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Carrinhos abandonados
        const [cartStats] = await db.execute(sql`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'recovered' THEN 1 ELSE 0 END) AS recovered,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            ROUND(SUM(CASE WHEN status = 'recovered' THEN CAST(total AS DECIMAL(10,2)) ELSE 0 END), 2) AS recoveredRevenue
          FROM abandoned_carts
          WHERE createdAt >= ${since}
        `) as unknown as [Array<{ total: number; recovered: number; expired: number; pending: number; recoveredRevenue: string }>];

        // Clientes inativos reativados (por automationEvents)
        const [reactivationStats] = await db.execute(sql`
          SELECT
            COUNT(DISTINCT userId) AS totalInactive,
            SUM(CASE WHEN type = 'reactivation_15d' THEN 1 ELSE 0 END) AS sent15d,
            SUM(CASE WHEN type = 'reactivation_30d' THEN 1 ELSE 0 END) AS sent30d,
            SUM(CASE WHEN type = 'reactivation_60d' THEN 1 ELSE 0 END) AS sent60d
          FROM automation_events
          WHERE createdAt >= ${since} AND type LIKE 'reactivation_%' AND channel = 'whatsapp'
        `) as unknown as [Array<{ totalInactive: number; sent15d: number; sent30d: number; sent60d: number }>];

        // Conversões por automação
        const [conversionStats] = await db.execute(sql`
          SELECT
            COUNT(*) AS totalConversions,
            ROUND(SUM(o.total), 2) AS conversionRevenue
          FROM automation_events ae
          JOIN orders o ON o.id = ae.orderId
          WHERE ae.createdAt >= ${since} AND ae.type = 'conversion'
        `) as unknown as [Array<{ totalConversions: number; conversionRevenue: string }>];

        // Taxa por etapa do carrinho
        const [stepStats] = await db.execute(sql`
          SELECT
            step,
            COUNT(*) AS sent,
            SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted
          FROM automation_events
          WHERE createdAt >= ${since} AND type LIKE 'cart_step%'
          GROUP BY step
          ORDER BY step
        `) as unknown as [Array<{ step: number; sent: number; converted: number }>];

        const cart = (cartStats as unknown as typeof cartStats)[0] ?? { total: 0, recovered: 0, expired: 0, pending: 0, recoveredRevenue: "0" };
        const react = (reactivationStats as unknown as typeof reactivationStats)[0] ?? { totalInactive: 0, sent15d: 0, sent30d: 0, sent60d: 0 };
        const conv = (conversionStats as unknown as typeof conversionStats)[0] ?? { totalConversions: 0, conversionRevenue: "0" };
        const steps = (stepStats as unknown as typeof stepStats) as Array<{ step: number; sent: number; converted: number }>;

        const recoveryRate = Number(cart.total) > 0
          ? Math.round((Number(cart.recovered) / Number(cart.total)) * 100)
          : 0;

        return {
          period: input.period,
          carts: {
            total: Number(cart.total),
            recovered: Number(cart.recovered),
            expired: Number(cart.expired),
            pending: Number(cart.pending),
            recoveryRate,
            recoveredRevenue: Number(cart.recoveredRevenue),
          },
          reactivation: {
            sent15d: Number(react.sent15d),
            sent30d: Number(react.sent30d),
            sent60d: Number(react.sent60d),
            totalSent: Number(react.sent15d) + Number(react.sent30d) + Number(react.sent60d),
          },
          conversions: {
            total: Number(conv.totalConversions),
            revenue: Number(conv.conversionRevenue),
          },
          steps: steps.map(s => ({
            step: Number(s.step),
            sent: Number(s.sent),
            converted: Number(s.converted),
            conversionRate: Number(s.sent) > 0 ? Math.round((Number(s.converted) / Number(s.sent)) * 100) : 0,
          })),
        };
      }),

    /** Lista de carrinhos abandonados com filtro */
    abandonedCarts: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "recovered", "expired"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      }))
      .query(async ({ input }) => {
        const { getDb: getDb2 } = await import("./db");
        const db = await getDb2();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { abandonedCarts: acTable } = await import("../drizzle/schema");
        const { eq: eqFn, and: andFn } = await import("drizzle-orm");
        const conditions: ReturnType<typeof eqFn>[] = [];
        if (input.status) conditions.push(eqFn(acTable.status, input.status));
        const rows = await db
          .select()
          .from(acTable)
          .where(conditions.length > 0 ? andFn(...conditions) : undefined)
          .orderBy(acTable.createdAt)
          .limit(input.limit);
        return rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
      }),

    /** Lista de eventos de automação para auditoria */
    events: adminProcedure
      .input(z.object({
        type: z.string().optional(),
        limit: z.number().min(1).max(200).default(100),
      }))
      .query(async ({ input }) => {
        const { getDb: getDb3 } = await import("./db");
        const db = await getDb3();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { automationEvents: aeTable } = await import("../drizzle/schema");
        const { eq: eqFn, and: andFn } = await import("drizzle-orm");
        const conditions: ReturnType<typeof eqFn>[] = [];
        if (input.type) conditions.push(eqFn(aeTable.type, input.type));
        return db
          .select()
          .from(aeTable)
          .where(conditions.length > 0 ? andFn(...conditions) : undefined)
          .orderBy(aeTable.createdAt)
          .limit(input.limit);
      }),

    /** Disparo manual de reativação */
    triggerReactivation: adminProcedure
      .mutation(async () => {
        await processReactivation();
        return { ok: true };
      }),
  }),

  // --- CARRINHO ABANDONADO (CLIENTE) -----------------------------------------
  cart: router({
    /** Lista carrinhos pendentes do usuário logado */
    myAbandoned: protectedProcedure.query(async ({ ctx }) => {
      const { getDb: getDb4 } = await import("./db");
      const db = await getDb4();
      if (!db) return [];
      const { abandonedCarts: acTable } = await import("../drizzle/schema");
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(acTable)
        .where(andFn(eqFn(acTable.userId, ctx.user.id), eqFn(acTable.status, "pending")))
        .orderBy(acTable.createdAt);
      return rows.map(r => ({
        id: r.id,
        total: r.total,
        couponCode: r.couponCode,
        currentStep: r.currentStep,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        items: JSON.parse(r.items) as Array<{ productId: number; productName: string; quantity: number; productPrice: string }>,
      }));
    }),

    /** Descarta (marca como expirado) um carrinho abandonado do usuário */
    dismiss: protectedProcedure
      .input(z.object({ cartId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb: getDb4 } = await import("./db");
        const db = await getDb4();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { abandonedCarts: acTable } = await import("../drizzle/schema");
        const { eq: eqFn, and: andFn } = await import("drizzle-orm");
        // Só pode descartar o próprio carrinho
        await db
          .update(acTable)
          .set({ status: "expired" })
          .where(andFn(eqFn(acTable.id, input.cartId), eqFn(acTable.userId, ctx.user.id)));
        return { ok: true };
      }),

    /** Busca um carrinho pelo ID para restaurar no checkout */
    getById: protectedProcedure
      .input(z.object({ cartId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getDb: getDb4 } = await import("./db");
        const db = await getDb4();
        if (!db) return null;
        const { abandonedCarts: acTable } = await import("../drizzle/schema");
        const { eq: eqFn, and: andFn } = await import("drizzle-orm");
        const [row] = await db
          .select()
          .from(acTable)
          .where(andFn(eqFn(acTable.id, input.cartId), eqFn(acTable.userId, ctx.user.id)))
          .limit(1);
        if (!row) return null;
        return {
          id: row.id,
          total: row.total,
          couponCode: row.couponCode,
          items: JSON.parse(row.items) as Array<{ productId: number; productName: string; quantity: number; productPrice: string }>,
        };
      }),
  }),

  // --- CLIENT ALERTS ----------------------------------------------------------
  clientAlerts: router({
    // Lista alertas ativos não lidos pelo cliente logado
    list: protectedProcedure.query(({ ctx }) => listClientAlerts(ctx.user.id)),

    // Conta alertas não lidos (para badge no nav)
    unreadCount: protectedProcedure.query(({ ctx }) => countUnreadClientAlerts(ctx.user.id)),

    // Marca alerta como lido
    dismiss: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(({ input, ctx }) => dismissClientAlert(input.alertId, ctx.user.id)),

    // Admin: criar alerta manual (novidades do clube, comunicados etc.)
    createManual: staffProcedure
      .input(z.object({
        type: z.enum(["promotion", "raffle", "coupon", "club", "custom"]),
        title: z.string().min(1),
        message: z.string().min(1),
        icon: z.string().optional(),
        url: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(({ input }) => createClientAlert(input)),
  }),
});
export type AppRouter = typeof appRouter;
