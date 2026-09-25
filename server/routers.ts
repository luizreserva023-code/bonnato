import { TRPCError } from "@trpc/server";
import { getDb } from "./db.ts";
import {
  journeys,
  journeyExecutions,
  orders,
  orderAttributions,
  customerStoreAccounts,
  orderReviews,
  productReviews,
  users,
  products as productsTable,
  categories as categoriesTable,
  productAuditLogs,
  productOptionGroups,
  productOptions,
} from "../drizzle/schema.ts";
import { eq, gte, desc, inArray, and, lt, ne, isNotNull, lte, sql } from "drizzle-orm";
import { clubRouter } from "./routers/club.ts";
import { storesRouter } from "./routers/stores.ts";
import { operationsRouter } from "./routers/operations.ts";
import { siteStudioRouter } from "./routers/siteStudio.ts";
import { rewardsRouter } from "./routers/rewards.ts";
import { analyticsRouter } from "./routers/analytics.ts";
import { deliveryRouter } from "./routers/delivery.ts";
import { catalogOrderConfigurationSchema, catalogRouter } from "./routers/catalog.ts";
import { calculateConfiguredProductPrice, createOrderItemConfigurationSnapshot } from "./domains/catalog/pricing.ts";
import { getConfiguredCatalogProduct } from "./domains/catalog/repository.ts";
import { consumeRewardCoupon, validateRewardCoupon, type RewardBenefit } from "./services/rewards.ts";
import { awardReviewCashback, getReviewCashbackOffer } from "./services/reviewCashback.ts";
import { geocodeDeliveryAddress, quoteDelivery } from "./services/delivery.ts";
import { withLocalTtlCache } from "./services/localTtlCache.ts";
import { z } from "zod";
import { MAX_IMAGE_BASE64_CHARS, MAX_IMAGE_UPLOAD_BYTES } from "../shared/imageUpload.ts";
import { savePushSubscription, removePushSubscription, sendPushToAdmins, sendPushToUser, sendPushToAllUsers, sendPushToDriver } from "./push.ts";
import { sendWhatsApp, WhatsAppTemplates } from "./whatsapp.ts";
import {
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
} from "./db.ts";
import { getTodayStartUtc, getTodayEndUtc, getBrasilTzOffset } from "../shared/timezone.ts";
import { getClubPlanConfig } from "./lib/club-config.ts";
import {
  getPaymentAvailability,
  getPaymentRuntimeStatus,
  getPaymentSettingsAdmin,
  getPaymentSettingsPublic,
  paymentConfigSchema,
  savePaymentSettings,
} from "./lib/payment-config.ts";
import { generatePixCode, generatePixQrCodeUrl } from "./lib/pix.ts";
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
} from "./automation.ts";
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
  getAdminUsersPage,
  getAdminDashboardSnapshot,
  getCategories,
  getCategoryById,
  getCouponByCode,
  getCouponById,
  getCouponsByUser,
  getDailyRevenue,
  getOrderAlertFeed,
  getOrderById,
  getOrderItems,
  getOrdersByPeriod,
  getOrdersByUser,
  getIngredients,
  getInventoryMovements,
  getProductById,
  getProductRecipe,
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
  setOrderAiPaused,
  updateIngredient,
  updateProduct,
  updatePromotion,
  updateRaffle,
  updateStaffMember,
  updateDiningTable,
  updateTableSession,
  updateUpsell,
  updateUserProfile,
  createProduct,
  createIngredient,
  createOtpCode,
  createPhoneUser,
  createStaffMember,
  createDiningTable,
  adjustIngredientStock,
  setProductRecipe,
  getStaffMembers,
  getStaffMemberById,
  ensureStaffAccessToken,
  regenerateStaffAccessToken,
  getStaffMemberByAccessToken,
  deleteIngredient,
  deleteStaffMember,
  getDiningTables,
  getDiningTableById,
  getTableSessions,
  getTableSessionById,
  getTableSessionItemById,
  openTableSession,
  closeTableSession,
  deleteDiningTable,
  attachOrderToTableSession,
  attachOrderToTableSessionAndSync,
  addTableSessionItem,
  removeTableSessionItem,
  updateTableSessionItemStatus,
  closeTableSessionWithComputedTotals,
  getCustomerMetricsReport,
  getUserByPhone,
  linkCustomerAuthProvider,
  getCustomerAuthProviders,
  getCustomerAuthProvider,
  disconnectCustomerAuthProvider,
  recordAuthEvent,
  recordUserConsent,
  markUserLogin,
  anonymizeUserAccount,
  getLatestOtpCode,
  countRecentOtpRequests,
  incrementOtpAttempts,
  consumeOtpCode,
  consumeInventoryForOrder,
  reverseInventoryForOrder,
} from "./db.ts";
import { revokeSocialProvider, syncSocialProvider, type SocialOAuthProvider } from "./_core/oauth.ts";
import { COOKIE_NAME, DEFAULT_SESSION_MS } from "../shared/const.ts";
import { sdk } from "./_core/sdk.ts";
import {
  invalidateLegacySessions,
  listActiveAuthSessions,
  revokeAllAuthSessions,
  revokeAuthSession,
} from "./authSessions.ts";
import {
  beginTotpSetup,
  confirmTotpSetup,
  consumeTwoFactorChallenge,
  createTwoFactorChallenge,
  disableUserTotp,
  getTwoFactorStatus,
  resolveTwoFactorChallenge,
  verifyUserTotp,
} from "./twoFactor.ts";
import { getSessionCookieOptions } from "./_core/cookies.ts";
import { systemRouter } from "./_core/systemRouter.ts";
import { protectedProcedure, publicProcedure, router, mergeRouters, staffProcedure } from "./_core/trpc.ts";
import { assertStoreEntityAccess, resolveRequiredStoreId, resolveStoreId } from "./storeUtils.ts";
import { getBonattoRuntimeByStoreId } from "./bonattoRuntime.ts";
import { recordStoreAudit } from "./storeAudit.ts";
import { notifyOwnerAdapter } from "./adapters/pushNotifications.ts";
// Alias para compatibilidade retroativa — passa pelo adapter
const notifyOwner = (payload: { title: string; content: string }) =>
  notifyOwnerAdapter({ title: payload.title, body: payload.content });
import { createPaymentIntent, createCheckoutSession, getOrCreateStripeCustomer, createSetupIntent, listSavedCards, detachPaymentMethod, createCheckoutSessionWithSavedCard } from "./stripe.ts";
import {
  cancelIfoodOrder,
  confirmIfoodOrder,
  dispatchIfoodOrder,
  listIfoodMerchants,
  startPreparationIfoodOrder,
  syncIfoodCatalog,
  syncIfoodPromotions,
} from "./ifood.ts";
import {
  getMarketplaceOverview,
  marketplaceConfigSchema,
  marketplaceProviderIdSchema,
  pullMarketplaceOrders,
  runMarketplaceCatalogSync,
  runMarketplacePromotionsSync,
  saveMarketplaceConfig,
  testMarketplaceConnection,
} from "./marketplaces.ts";
import {
  getIfoodProvider,
  listIfoodIntegrationLogs,
  resolveIntegrationRestaurantId,
} from "./ifoodIntegration.ts";
import {
  createExpense,
  createExpenseSchema,
  createDistributionProduct,
  distributionProductSchema,
  createFinancialFee,
  createFinancialFeeSchema,
  createMonthlyClosingSchema,
  createSupplyOrder,
  createSupplyOrderSchema,
  getFinancialOverview,
  getSupplyOrderDetails,
  listDistributionProducts,
  listAuditLogs,
  listMonthlyClosings,
  listSupplyOrders,
  updateDistributionProduct,
  updateDistributionProductSchema,
  updateSupplyOrderStatus,
  updateSupplyOrderStatusSchema,
  upsertMonthlyClosing,
} from "./restaurantNetwork.ts";
import { emitirNfce, cancelarNfce } from "./focusnfe.ts";
import { getOrCreateAsaasCustomer, createPixCharge, getChargeStatus } from "./asaas.ts";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./_core/mailer.ts";
import { applyOrderStatusLifecycle, bootstrapOrderLifecycle } from "./orderLifecycle.ts";
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
  driverAcceptOrder,
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
  markNotificationRead,
  archiveClientNotification,
  createClientNotification,
  addLoyaltyPoints,
  deductLoyaltyPoints,
  deductLoyaltyPointsAtomic,
  creditLoyaltyForOrderIdempotent,
  refundLoyaltyPointsForOrder,
  registerCouponRedemption,
  revertCouponRedemption,
  updateOrderStatusGuarded,
  claimOrderRequest,
  attachOrderRequest,
  completeOrderRequest,
  failOrderRequest,
  getUserLoyaltyPoints,
  getCustomerStoreAccount,
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
} from "./db.ts";

// Admin guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});

const legacyImageBase64Schema = z.string().max(MAX_IMAGE_BASE64_CHARS);

function assertLegacyImageSize(buffer: Buffer) {
  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "A imagem deve ter no máximo 5 MB.",
    });
  }
}

type CheckoutPaymentMethod = "credit_card" | "debit_card" | "pix" | "cash";

async function assertPaymentMethodEnabled(paymentMethod: CheckoutPaymentMethod, storeId?: number) {
  const publicPaymentSettings = await getPaymentSettingsPublic(storeId);
  const orderConfig = publicPaymentSettings.config.orders;
  const tenant = storeId ? await getBonattoRuntimeByStoreId(storeId) : null;
  if (tenant && tenant.status !== "active") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Esta loja nao esta disponivel para pagamentos." });
  }
  if (tenant) {
    const tenantPayments = tenant.providers.payments;
    const providerEnabled = paymentMethod === "pix"
      ? tenantPayments.pix
      : paymentMethod === "cash"
        ? tenantPayments.cash
        : tenantPayments.card;
    if (!providerEnabled) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este metodo de pagamento nao esta habilitado para a loja." });
    }
  }

  if ((paymentMethod === "credit_card" || paymentMethod === "debit_card") && !orderConfig.cardEnabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Pagamentos por cartão estão desativados no momento.",
    });
  }

  if (paymentMethod === "pix" && !orderConfig.pixEnabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Pagamentos via PIX estão desativados no momento.",
    });
  }

  if (paymentMethod === "cash" && !orderConfig.cashEnabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Pagamentos em dinheiro estão desativados no momento.",
    });
  }

  return publicPaymentSettings;
}

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

// Seed on startup only in interactive development.
// Tests import this router without a database and must stay side-effect free.
if (process.env.NODE_ENV === "development") {
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

const TWO_FACTOR_FEATURE_ENABLED = process.env.TWO_FACTOR_FEATURE_ENABLED === "true";

function assertTwoFactorFeatureEnabled() {
  if (!TWO_FACTOR_FEATURE_ENABLED) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Autenticação em duas etapas ainda não está disponível." });
  }
}

function normalizePhone(raw: string) {
  return raw.replace(/\D+/g, "");
}

function hashOtpCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function getPizzaCategoryIds(categories: Array<{ id: number; slug: string; name: string }>) {
  return new Set(
    categories
      .filter((category) => {
        const haystack = `${category.slug} ${category.name}`.toLowerCase();
        return haystack.includes("pizza");
      })
      .map((category) => category.id),
  );
}

function getFreePizzaDiscountForCart(
  items: Array<{ productId: number; quantity: number }>,
  productMap: Map<number, { id: number; categoryId: number; name: string; price: string }>,
  pizzaCategoryIds: Set<number>,
) {
  let maxEligiblePrice = 0;

  for (const item of items) {
    if (item.quantity <= 0) continue;

    const product = productMap.get(item.productId);
    if (!product) continue;

    const isPizza =
      pizzaCategoryIds.has(product.categoryId) ||
      product.name.toLowerCase().includes("pizza");

    if (!isPizza) continue;

    const unitPrice = parseFloat(product.price);
    if (Number.isFinite(unitPrice) && unitPrice > maxEligiblePrice) {
      maxEligiblePrice = unitPrice;
    }
  }

  return parseFloat(maxEligiblePrice.toFixed(2));
}

type CarouselDestinationType = "none" | "product" | "category" | "internal" | "external";

async function validateCarouselDestination(
  storeId: number,
  destinationType: CarouselDestinationType,
  destinationValue?: string | null,
) {
  if (destinationType === "none") return null;

  const value = destinationValue?.trim();
  if (!value) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha para onde esta imagem deve levar." });
  }

  if (destinationType === "product") {
    const productId = Number(value);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Produto de destino inválido." });
    }
    const product = await getProductById(productId);
    if (!product || product.storeId !== storeId || !product.active) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "O produto de destino não pertence a esta loja ou está inativo." });
    }
    return String(productId);
  }

  if (destinationType === "category") {
    const categoryId = Number(value);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Categoria de destino inválida." });
    }
    const category = await getCategoryById(categoryId);
    if (!category || category.storeId !== storeId || !category.active) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A categoria de destino não pertence a esta loja ou está inativa." });
    }
    return String(categoryId);
  }

  if (destinationType === "internal") {
    if (!value.startsWith("/") || value.startsWith("//")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A página interna precisa começar com /." });
    }
    return value;
  }

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
    return url.toString();
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um link externo http:// ou https:// válido." });
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
      const {
        passwordHash: _ph,
        resetToken: _rt,
        resetTokenExpiresAt: _rte,
        sessionInvalidBefore: _sib,
        totpSecretEncrypted: _totp,
        totpPendingSecretEncrypted: _totpPending,
        ...safeUser
      } = u as typeof u & {
        passwordHash?: unknown;
        resetToken?: unknown;
        resetTokenExpiresAt?: unknown;
        sessionInvalidBefore?: unknown;
        totpSecretEncrypted?: unknown;
        totpPendingSecretEncrypted?: unknown;
      };
      return safeUser;
    }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const session = await sdk.getRequestSession(ctx.req);
      if (ctx.user && session?.sessionId) {
        await revokeAuthSession(ctx.user.id, session.sessionId, "logout");
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    sessions: protectedProcedure.query(async ({ ctx }) => {
      const current = await sdk.getRequestSession(ctx.req);
      const sessions = await listActiveAuthSessions(ctx.user.id);
      return sessions.map((session) => ({
        id: session.id,
        deviceLabel: session.deviceLabel ?? "Dispositivo desconhecido",
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        isCurrent: session.id === current?.sessionId,
      }));
    }),

    revokeSession: protectedProcedure
      .input(z.object({ sessionId: z.string().min(8).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const current = await sdk.getRequestSession(ctx.req);
        const revoked = await revokeAuthSession(ctx.user.id, input.sessionId, "user_revoked_device");
        if (current?.sessionId === input.sessionId) {
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        }
        return { success: revoked, currentSessionRevoked: current?.sessionId === input.sessionId };
      }),

    logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
      await Promise.all([
        revokeAllAuthSessions(ctx.user.id, undefined, "user_logout_all"),
        invalidateLegacySessions(ctx.user.id),
      ]);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    twoFactorStatus: protectedProcedure.query(async ({ ctx }) => {
      if (!TWO_FACTOR_FEATURE_ENABLED) {
        return {
          enabled: false,
          confirmedAt: null,
          hasPassword: Boolean(ctx.user.passwordHash),
          available: false,
        };
      }
      return { ...(await getTwoFactorStatus(ctx.user.id)), available: true };
    }),

    beginTwoFactorSetup: protectedProcedure.mutation(async ({ ctx }) => {
      assertTwoFactorFeatureEnabled();
      const label = ctx.user.email ?? ctx.user.name ?? `usuario-${ctx.user.id}`;
      return beginTotpSetup(ctx.user.id, label);
    }),

    confirmTwoFactorSetup: protectedProcedure
      .input(z.object({ code: z.string().regex(/^\d{6}$/, "Código inválido") }))
      .mutation(async ({ ctx, input }) => {
        assertTwoFactorFeatureEnabled();
        if (!(await confirmTotpSetup(ctx.user.id, input.code))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido. Confira o autenticador e tente novamente." });
        }
        const current = await sdk.getRequestSession(ctx.req);
        await Promise.all([
          revokeAllAuthSessions(ctx.user.id, current?.sessionId, "two_factor_enabled"),
          invalidateLegacySessions(ctx.user.id),
          recordAuthEvent({
            userId: ctx.user.id,
            event: "two_factor_enabled",
            ipAddress: ctx.req.ip ?? null,
            userAgent: ctx.req.get("user-agent") ?? null,
          }),
        ]);
        return { success: true };
      }),

    disableTwoFactor: protectedProcedure
      .input(z.object({
        code: z.string().regex(/^\d{6}$/, "Código inválido"),
        password: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertTwoFactorFeatureEnabled();
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (!(await verifyUserTotp(user.id, input.code))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Código de autenticação incorreto." });
        }
        if (user.passwordHash && (!input.password || !(await bcrypt.compare(input.password, user.passwordHash)))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Confirme sua senha para desativar o 2FA." });
        }
        await disableUserTotp(user.id);
        const current = await sdk.getRequestSession(ctx.req);
        await Promise.all([
          revokeAllAuthSessions(user.id, current?.sessionId, "two_factor_disabled"),
          invalidateLegacySessions(user.id),
          recordAuthEvent({
            userId: user.id,
            event: "two_factor_disabled",
            ipAddress: ctx.req.ip ?? null,
            userAgent: ctx.req.get("user-agent") ?? null,
          }),
        ]);
        return { success: true };
      }),

    registerEmail: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("E-mail inválido"),
        password: z.string()
          .min(8, "Senha deve ter pelo menos 8 caracteres")
          .regex(/[A-Z]/, "A senha deve ter pelo menos uma letra maiúscula")
          .regex(/[a-z]/, "A senha deve ter pelo menos uma letra minúscula")
          .regex(/\d/, "A senha deve ter pelo menos um número"),
        acceptTerms: z.literal(true, "Aceite os Termos de Uso e a Política de Privacidade"),
        consentVersion: z.string().min(1).max(32).default("2026-08-01"),
      }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const existing = await getUserByEmail(email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado" });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const openId = `email_${crypto.randomBytes(16).toString("hex")}`;
        const name = input.name.trim();
        await createEmailUser({ openId, name, email, passwordHash });
        const user = await getUserByEmail(email);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a conta" });
        await linkCustomerAuthProvider({
          userId: user.id,
          provider: "email",
          providerUserId: email,
          providerEmail: email,
          displayName: name,
          isPrimary: true,
          consentVersion: input.consentVersion,
          consentedAt: new Date(),
        });
        await Promise.all([
          recordUserConsent({ userId: user.id, kind: "terms", version: input.consentVersion, ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null }),
          recordUserConsent({ userId: user.id, kind: "privacy", version: input.consentVersion, ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null }),
          recordAuthEvent({ userId: user.id, provider: "email", event: "login_success", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null }),
        ]);
        // Send welcome email (non-blocking)
        sendWelcomeEmail(email, name).catch(console.error);
        // Create session
        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: DEFAULT_SESSION_MS,
          trackSession: true,
          ipAddress: ctx.req.ip ?? null,
          userAgent: ctx.req.get("user-agent") ?? null,
        });
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
        const email = input.email.trim().toLowerCase();
        const user = await getUserByEmail(email);
        if (!user || !user.passwordHash) {
          await recordAuthEvent({ provider: "email", event: "login_failure", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          await recordAuthEvent({ userId: user.id, provider: "email", event: "login_failure", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
        }
        if (TWO_FACTOR_FEATURE_ENABLED && user.totpEnabled) {
          const challengeToken = await createTwoFactorChallenge(user.id);
          await recordAuthEvent({
            userId: user.id,
            provider: "email",
            event: "two_factor_challenge",
            ipAddress: ctx.req.ip ?? null,
            userAgent: ctx.req.get("user-agent") ?? null,
          });
          return { success: true, requiresTwoFactor: true, challengeToken };
        }
        await Promise.all([
          markUserLogin(user.id, "email"),
          recordAuthEvent({ userId: user.id, provider: "email", event: "login_success", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null }),
        ]);
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? "",
          expiresInMs: DEFAULT_SESSION_MS,
          trackSession: true,
          ipAddress: ctx.req.ip ?? null,
          userAgent: ctx.req.get("user-agent") ?? null,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
        return { success: true, requiresTwoFactor: false as const, challengeToken: undefined };
      }),

    verifyTwoFactor: publicProcedure
      .input(z.object({
        challengeToken: z.string().min(32).max(256),
        code: z.string().regex(/^\d{6}$/, "Código inválido"),
      }))
      .mutation(async ({ input, ctx }) => {
        assertTwoFactorFeatureEnabled();
        const challenge = await resolveTwoFactorChallenge(input.challengeToken);
        if (!challenge) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Código expirado. Faça login novamente." });
        }
        if (!(await verifyUserTotp(challenge.userId, input.code))) {
          await recordAuthEvent({
            userId: challenge.userId,
            event: "two_factor_failure",
            ipAddress: ctx.req.ip ?? null,
            userAgent: ctx.req.get("user-agent") ?? null,
          });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Código de autenticação incorreto." });
        }
        if (!(await consumeTwoFactorChallenge(challenge.id))) {
          throw new TRPCError({ code: "CONFLICT", message: "Este código de acesso já foi utilizado." });
        }
        const user = await getUserById(challenge.userId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await Promise.all([
          markUserLogin(user.id, user.loginMethod ?? "email"),
          recordAuthEvent({
            userId: user.id,
            provider: user.loginMethod ?? "email",
            event: "login_success",
            ipAddress: ctx.req.ip ?? null,
            userAgent: ctx.req.get("user-agent") ?? null,
          }),
        ]);
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? "",
          expiresInMs: DEFAULT_SESSION_MS,
          trackSession: true,
          ipAddress: ctx.req.ip ?? null,
          userAgent: ctx.req.get("user-agent") ?? null,
        });
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
        if (!user) return { success: true };
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
        void emailSent;
        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        password: z.string()
          .min(8, "Senha deve ter pelo menos 8 caracteres")
          .regex(/[A-Z]/, "A senha deve ter pelo menos uma letra maiúscula")
          .regex(/[a-z]/, "A senha deve ter pelo menos uma letra minúscula")
          .regex(/\d/, "A senha deve ter pelo menos um número"),
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
        await Promise.all([
          revokeAllAuthSessions(user.id, undefined, "password_reset"),
          invalidateLegacySessions(user.id),
        ]);
        // Auto-login after reset
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? "",
          expiresInMs: DEFAULT_SESSION_MS,
          trackSession: true,
          ipAddress: ctx.req.ip ?? null,
          userAgent: ctx.req.get("user-agent") ?? null,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
        return { success: true };
      }),

    requestPhoneOtp: publicProcedure
      .input(z.object({
        phone: z.string().min(10, "Telefone inválido"),
        purpose: z.enum(["login", "verify_phone"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const phone = normalizePhone(input.phone);
        if (phone.length < 10) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Telefone inválido" });
        }
        const recentRequests = await countRecentOtpRequests(phone, 10);
        if (recentRequests >= 5) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos." });
        }

        const existingUser = await getUserByPhone(phone);
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const codeHash = hashOtpCode(code);
        await createOtpCode({
          userId: existingUser?.id ?? null,
          phone,
          purpose: input.purpose ?? "login",
          codeHash,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          requestIp: ctx.req.ip ?? null,
          userAgent: ctx.req.get("user-agent") ?? null,
        });

        let delivered = false;
        let provider: "whatsapp" | "debug" = "whatsapp";
        try {
          await sendWhatsApp(phone, `Bonatto Pizza: seu código é ${code}. Ele expira em 10 minutos.`);
          delivered = true;
        } catch (error) {
          console.error("[auth.requestPhoneOtp] whatsapp send failed:", error);
          provider = "debug";
        }

        return {
          success: true,
          delivered,
          provider,
          previewCode: process.env.NODE_ENV === "production" ? undefined : code,
        };
      }),

    verifyPhoneOtp: publicProcedure
      .input(z.object({
        phone: z.string().min(10, "Telefone inválido"),
        code: z.string().length(6, "Código inválido"),
        purpose: z.enum(["login", "verify_phone"]).optional(),
        name: z.string().min(2).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const phone = normalizePhone(input.phone);
        const otp = await getLatestOtpCode(phone, input.purpose ?? "login");
        if (!otp || otp.consumedAt || new Date(otp.expiresAt).getTime() < Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Código expirado ou inválido" });
        }
        if ((otp.attempts ?? 0) >= 5) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Código bloqueado por excesso de tentativas" });
        }
        if (otp.codeHash !== hashOtpCode(input.code)) {
          await incrementOtpAttempts(otp.id);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Código incorreto" });
        }

        await consumeOtpCode(otp.id);

        let user = await getUserByPhone(phone);
        if (!user) {
          user = await createPhoneUser({
            openId: `phone_${phone}_${crypto.randomBytes(8).toString("hex")}`,
            name: input.name ?? "Cliente Bonatto",
            phone,
          });
        }
        if (!user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar usuário por telefone" });
        }

        await linkCustomerAuthProvider({
          userId: user.id,
          provider: "phone",
          providerUserId: phone,
          providerPhone: phone,
          isPrimary: true,
        });

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? "Cliente Bonatto",
          expiresInMs: DEFAULT_SESSION_MS,
          trackSession: true,
          ipAddress: ctx.req.ip ?? null,
          userAgent: ctx.req.get("user-agent") ?? null,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
        return { success: true };
      }),

    socialAccounts: protectedProcedure.query(async ({ ctx }) => {
      const [accounts, user] = await Promise.all([
        getCustomerAuthProviders(ctx.user.id),
        getUserById(ctx.user.id),
      ]);
      const safeAccounts = accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerEmail: account.providerEmail,
        providerUsername: account.providerUsername,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        accountType: account.accountType,
        isPrimary: account.isPrimary,
        grantedScopes: account.grantedScopes ? JSON.parse(account.grantedScopes) as string[] : [],
        connectedAt: account.linkedAt,
        lastSyncedAt: account.lastSyncedAt,
      }));
      if (user?.passwordHash && !safeAccounts.some((account) => account.provider === "email")) {
        safeAccounts.unshift({
          id: 0,
          provider: "email" as const,
          providerEmail: user.email,
          providerUsername: null,
          displayName: user.name,
          avatarUrl: null,
          accountType: null,
          isPrimary: user.loginMethod === "email",
          grantedScopes: [],
          connectedAt: user.createdAt,
          lastSyncedAt: user.lastSignedIn,
        });
      }
      return safeAccounts;
    }),

    syncSocialAccount: protectedProcedure
      .input(z.object({ provider: z.enum(["google", "facebook", "apple", "instagram"]) }))
      .mutation(async ({ ctx, input }) => {
        try {
          await syncSocialProvider(ctx.user.id, input.provider as SocialOAuthProvider);
          return { success: true };
        } catch (error) {
          console.error("[auth.syncSocialAccount] failed", error);
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível sincronizar esta conta. Reconecte o provedor e tente novamente." });
        }
      }),

    disconnectSocialAccount: protectedProcedure
      .input(z.object({ provider: z.enum(["google", "facebook", "apple", "instagram"]) }))
      .mutation(async ({ ctx, input }) => {
        const [account, accounts, user] = await Promise.all([
          getCustomerAuthProvider(ctx.user.id, input.provider),
          getCustomerAuthProviders(ctx.user.id),
          getUserById(ctx.user.id),
        ]);
        if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Conexão social não encontrada" });
        const alternativeLoginMethods = accounts.filter((item) => item.provider !== input.provider && item.provider !== "instagram").length + (user?.passwordHash ? 1 : 0);
        if (input.provider !== "instagram" && alternativeLoginMethods === 0) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cadastre uma senha ou conecte outro provedor antes de remover seu único acesso." });
        }
        await revokeSocialProvider(input.provider, account.accessTokenEncrypted, account.refreshTokenEncrypted).catch((error) => {
          console.warn("[auth.disconnectSocialAccount] remote revoke failed", error);
        });
        await Promise.all([
          disconnectCustomerAuthProvider(ctx.user.id, input.provider),
          recordAuthEvent({ userId: ctx.user.id, provider: input.provider, event: "provider_disconnected", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null }),
        ]);
        return { success: true };
      }),

    deleteAccount: protectedProcedure
      .input(z.object({ confirmation: z.literal("EXCLUIR"), password: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (user.passwordHash) {
          if (!input.password || !(await bcrypt.compare(input.password, user.passwordHash))) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Confirme sua senha para excluir a conta." });
          }
        }
        const accounts = await getCustomerAuthProviders(user.id);
        await Promise.all(accounts
          .filter((account) => account.provider === "google" || account.provider === "facebook" || account.provider === "apple" || account.provider === "instagram")
          .map((account) => revokeSocialProvider(account.provider as SocialOAuthProvider, account.accessTokenEncrypted, account.refreshTokenEncrypted).catch(console.warn)));
        await recordAuthEvent({ userId: user.id, event: "account_deleted", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null });
        await revokeAllAuthSessions(user.id, undefined, "account_deleted");
        await invalidateLegacySessions(user.id);
        await anonymizeUserAccount(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true };
      }),
  }),

  // --- CATEGORIES -------------------------------------------------------------
  categories: router({
    list: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional(), storeId: z.number().optional() }).optional())
      .query(({ input }) => withLocalTtlCache(
        `public:categories:${input?.storeId ?? "all"}:${input?.activeOnly ?? true}`,
        15_000,
        () => getCategories({ activeOnly: input?.activeOnly ?? true, storeId: input?.storeId }),
      )),

    listAll: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getCategories({ activeOnly: false, storeId });
      }),

    create: staffProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          imageUrl: z.string().max(2048).optional(),
          icon: z.string().max(64).optional(),
          sortOrder: z.number().optional(),
          storeId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return createCategory({ ...input, storeId: storeId ?? 0, active: true });
      }),

    update: staffProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          imageUrl: z.string().max(2048).optional(),
          icon: z.string().max(64).optional(),
          sortOrder: z.number().optional(),
          active: z.boolean().optional(),
          storeId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const category = await getCategoryById(input.id);
        if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Categoria não encontrada." });
        await assertStoreEntityAccess(ctx.user, category.storeId, input.storeId);
        const { id, storeId: _storeId, ...data } = input;
        return updateCategory(id, data);
      }),

    uploadImage: staffProcedure
      .input(z.object({
        base64: legacyImageBase64Schema,
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(255).optional(),
      }))
      .mutation(async ({ input }) => {
        const { storagePutAdapter: storagePut } = await import("./adapters/storage.ts");
        const { compressToWebP } = await import("./imageUtils.ts");
        const rawBuffer = Buffer.from(input.base64, "base64");
      assertLegacyImageSize(rawBuffer);
        const { buffer, mimeType, ext, reductionPct } = await compressToWebP(rawBuffer, 82, 1400);
        const key = `categories/category-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        console.log(`[upload] categoria comprimida ${reductionPct}% -> WebP`);
        return { url };
      }),

    delete: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const category = await getCategoryById(input.id);
        if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Categoria não encontrada." });
        await assertStoreEntityAccess(ctx.user, category.storeId, input.storeId);
        return deleteCategory(input.id);
      }),

    reorder: staffProcedure
      .input(z.object({
        storeId: z.number().int().positive(),
        orderedCategoryIds: z.array(z.number().int().positive()).min(1).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const ids = Array.from(new Set(input.orderedCategoryIds));
        const rows = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(and(
          eq(categoriesTable.storeId, storeId),
          inArray(categoriesTable.id, ids),
        ));
        if (rows.length !== ids.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A ordenação contém categorias fora da unidade selecionada." });
        }

        await db.transaction(async (tx) => {
          for (const [index, id] of ids.entries()) {
            await tx.update(categoriesTable)
              .set({ sortOrder: index, updatedAt: new Date() })
              .where(and(eq(categoriesTable.id, id), eq(categoriesTable.storeId, storeId)));
          }
        });

        await recordStoreAudit({
          storeId,
          actorUserId: ctx.user.id,
          action: "categories.reorder",
          resourceType: "category_order",
          metadata: { orderedCategoryIds: ids },
        });
        return { success: true };
      }),
  }),

  // --- PRODUCTS ---------------------------------------------------------------
  products: router({
    list: publicProcedure
      .input(z.object({ categoryId: z.number().optional(), storeId: z.number().optional() }).optional())
      .query(({ input }) => withLocalTtlCache(
        `public:products:${input?.storeId ?? "all"}:${input?.categoryId ?? "all"}`,
        10_000,
        async () => {
          const rows = await getProducts({
            categoryId: input?.categoryId,
            storeId: input?.storeId,
            activeOnly: true,
          });
          if (rows.length === 0) return rows;

          const db = await getDb();
          if (!db) {
            return rows.map((product) => ({
              ...product,
              hasConfiguration: product.productType === "multi_flavor" || product.productType === "combo",
            }));
          }

          const modifierRows = await db
            .select({ productId: productOptionGroups.productId })
            .from(productOptionGroups)
            .where(and(
              inArray(productOptionGroups.productId, rows.map((product) => product.id)),
              eq(productOptionGroups.active, true),
            ));
          const productsWithModifiers = new Set(
            Array.isArray(modifierRows)
              ? modifierRows.map((row) => row.productId)
              : [],
          );

          return rows.map((product) => ({
            ...product,
            hasConfiguration:
              product.productType === "multi_flavor"
              || product.productType === "combo"
              || productsWithModifiers.has(product.id),
          }));
        },
      )),

    listAll: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getProducts({ activeOnly: false, storeId });
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getProductById(input.id)),

    byIds: publicProcedure
      .input(z.object({ ids: z.array(z.number()).max(100) }))
      .query(({ input }) => getProductsByIds(Array.from(new Set(input.ids)))),

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
          storeId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        return createProduct({ ...input, storeId, active: true, featured: input.featured ?? false });
      }),

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
          storeId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const product = await getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto nao encontrado." });
        await assertStoreEntityAccess(ctx.user, product.storeId, input.storeId);
        const { id, storeId: _storeId, ...data } = input;
        return updateProduct(id, data);
      }),

    delete: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const product = await getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto nao encontrado." });
        await assertStoreEntityAccess(ctx.user, product.storeId, input.storeId);
        return deleteProduct(input.id);
      }),

    batchUpdate: staffProcedure
      .input(z.object({
        storeId: z.number().int().positive(),
        productIds: z.array(z.number().int().positive()).min(1).max(200),
        action: z.enum(["activate", "pause", "move_category", "archive"]),
        categoryId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

        const ids = Array.from(new Set(input.productIds));
        const current = await db
          .select({
            id: productsTable.id,
            name: productsTable.name,
            active: productsTable.active,
            categoryId: productsTable.categoryId,
            editorialStatus: productsTable.editorialStatus,
          })
          .from(productsTable)
          .where(and(eq(productsTable.storeId, storeId), inArray(productsTable.id, ids)));

        if (current.length !== ids.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Há produtos fora da unidade selecionada." });
        }

        if (input.action === "move_category") {
          if (!input.categoryId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione a categoria de destino." });
          }
          const [target] = await db
            .select({ id: categoriesTable.id })
            .from(categoriesTable)
            .where(and(
              eq(categoriesTable.id, input.categoryId),
              eq(categoriesTable.storeId, storeId),
              eq(categoriesTable.active, true),
            ))
            .limit(1);
          if (!target) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Categoria de destino inválida para esta unidade." });
          }
        }

        await db.transaction(async (tx) => {
          const now = new Date();
          if (input.action === "activate") {
            await tx.update(productsTable)
              .set({ active: true, editorialStatus: "published", archivedAt: null, publishedAt: now, updatedAt: now })
              .where(and(eq(productsTable.storeId, storeId), inArray(productsTable.id, ids)));
          } else if (input.action === "pause") {
            await tx.update(productsTable)
              .set({ active: false, updatedAt: now })
              .where(and(eq(productsTable.storeId, storeId), inArray(productsTable.id, ids)));
          } else if (input.action === "move_category" && input.categoryId) {
            await tx.update(productsTable)
              .set({ categoryId: input.categoryId, updatedAt: now })
              .where(and(eq(productsTable.storeId, storeId), inArray(productsTable.id, ids)));
          } else if (input.action === "archive") {
            await tx.update(productsTable)
              .set({ active: false, editorialStatus: "archived", archivedAt: now, updatedAt: now })
              .where(and(eq(productsTable.storeId, storeId), inArray(productsTable.id, ids)));
          }

          const auditRows = current.map((product) => {
            const fieldName = input.action === "move_category" ? "categoryId" : input.action === "archive" ? "editorialStatus" : "active";
            const previousValue = fieldName === "categoryId"
              ? String(product.categoryId)
              : fieldName === "editorialStatus"
                ? String(product.editorialStatus)
                : String(product.active);
            const newValue = input.action === "move_category"
              ? String(input.categoryId)
              : input.action === "activate"
                ? "true"
                : input.action === "pause"
                  ? "false"
                  : "archived";
            return {
              storeId,
              productId: product.id,
              actorUserId: ctx.user.id,
              action: `batch.${input.action}`,
              fieldName,
              previousValue,
              newValue,
            };
          });
          if (auditRows.length) await tx.insert(productAuditLogs).values(auditRows);
        });

        await recordStoreAudit({
          storeId,
          actorUserId: ctx.user.id,
          action: `products.batch.${input.action}`,
          resourceType: "product_batch",
          resourceId: ids.join(","),
          metadata: { productIds: ids, categoryId: input.categoryId ?? null, count: ids.length },
        });

        return { success: true, count: ids.length };
      }),

    reorder: staffProcedure
      .input(z.object({
        storeId: z.number().int().positive(),
        categoryId: z.number().int().positive(),
        orderedProductIds: z.array(z.number().int().positive()).min(1).max(300),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const ids = Array.from(new Set(input.orderedProductIds));
        const rows = await db.select({ id: productsTable.id }).from(productsTable).where(and(
          eq(productsTable.storeId, storeId),
          eq(productsTable.categoryId, input.categoryId),
          inArray(productsTable.id, ids),
        ));
        if (rows.length !== ids.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A ordenação contém produtos inválidos para esta categoria." });
        }
        await db.transaction(async (tx) => {
          for (const [index, id] of ids.entries()) {
            await tx.update(productsTable)
              .set({ sortOrder: index, updatedAt: new Date() })
              .where(and(eq(productsTable.id, id), eq(productsTable.storeId, storeId)));
          }
        });
        await recordStoreAudit({
          storeId,
          actorUserId: ctx.user.id,
          action: "products.reorder",
          resourceType: "category",
          resourceId: input.categoryId,
          metadata: { orderedProductIds: ids },
        });
        return { success: true };
      }),

    uploadImage: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        base64: legacyImageBase64Schema, // keep below Vercel request-size limits
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(255).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const { storagePutAdapter: storagePut } = await import("./adapters/storage.ts");
        const { compressToWebP } = await import("./imageUtils.ts");
        const rawBuffer = Buffer.from(input.base64, "base64");
      assertLegacyImageSize(rawBuffer);
        const { buffer, mimeType, ext, reductionPct } = await compressToWebP(rawBuffer, 82, 1200);
        const key = `stores/${storeId}/products/product-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        console.log(`[upload] produto comprimido ${reductionPct}% → WebP`);
        return { url };
      }),
  }),

  // --- COUPONS ----------------------------------------------------------------
  coupons: router({
    validate: publicProcedure
      .input(z.object({
        code: z.string(),
        orderTotal: z.number(),
        storeId: z.number().optional(),
        items: z.array(z.object({
          productId: z.number().int().positive(),
          productPrice: z.union([z.string(), z.number()]),
          quantity: z.number().int().min(1).max(99),
        })).max(50).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const coupon = await getCouponByCode(input.code, input.storeId);
        if (!coupon && ctx.user && input.storeId) {
          const rewardBenefit = await validateRewardCoupon({
            storeId: input.storeId,
            userId: ctx.user.id,
            code: input.code,
            subtotal: input.orderTotal,
            items: input.items,
          });
          return {
            valid: true,
            discount: rewardBenefit.discount,
            coupon: { code: input.code.toUpperCase(), rewardCoupon: true },
            rewardBenefit,
          };
        }
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

    list: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getAllCoupons(storeId);
      }),

    // Public endpoint: returns only active global coupons (no userId) for display in customer panel
    listActive: protectedProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) =>
      getAllCoupons(input?.storeId).then((coupons) =>
        coupons.filter((c) => c.active && !c.userId && (!c.expiresAt || new Date() < c.expiresAt))
      )
    ),

    listPublic: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) =>
        getAllCoupons(input?.storeId).then((coupons) =>
          coupons.filter((coupon) =>
            coupon.active &&
            !coupon.userId &&
            (!coupon.expiresAt || new Date() < coupon.expiresAt) &&
            (!coupon.maxUses || coupon.usedCount < coupon.maxUses)
          )
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
          storeId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const result = await createCoupon({ ...input, storeId, active: true, usedCount: 0 });
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
          storeId,
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
        storeId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const coupon = await getCouponById(input.id);
        if (!coupon) throw new TRPCError({ code: "NOT_FOUND", message: "Cupom não encontrado." });
        await assertStoreEntityAccess(ctx.user, coupon.storeId, input.storeId);
        const { id, storeId: _storeId, ...data } = input;
        return updateCoupon(id, data);
      }),

    // Public: returns the home popup coupon only if it has been provisioned by an admin.
    // Nenhum side-effect aqui — cupons devem ser criados via seed/admin, não em leitura pública.
    getHomePopupCoupon: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input }) => {
      const POPUP_CODE = "BONATTO10";
      const coupon = await getCouponByCode(POPUP_CODE, input?.storeId);
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
          storeId: z.number().int().positive(),
          idempotencyKey: z.string().trim().min(16).max(96),
          attribution: z.object({
            visitorId: z.string().max(96).optional(),
            sessionId: z.string().max(96).optional(),
            utmSource: z.string().max(160).optional(),
            utmMedium: z.string().max(160).optional(),
            utmCampaign: z.string().max(200).optional(),
            utmContent: z.string().max(200).optional(),
            utmTerm: z.string().max(200).optional(),
            fbclid: z.string().max(255).optional(),
            gclid: z.string().max(255).optional(),
            ttclid: z.string().max(255).optional(),
            referrer: z.string().max(2000).optional(),
            landingPage: z.string().max(2000).optional(),
            firstTouchSource: z.string().max(160).optional(),
            firstTouchMedium: z.string().max(160).optional(),
            firstTouchCampaign: z.string().max(200).optional(),
            lastTouchSource: z.string().max(160).optional(),
            lastTouchMedium: z.string().max(160).optional(),
            lastTouchCampaign: z.string().max(200).optional(),
          }).optional(),
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
          serviceType: z.enum(["delivery", "pickup"]).default("delivery"),
          deliveryAddress: z.string().min(1).max(500),
          deliveryStreet: z.string().max(240).optional(),
          deliveryNumber: z.string().max(40).optional(),
          deliveryCity: z.string().max(100).optional(),
          deliveryState: z.string().length(2).optional(),
          deliveryCep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido").optional(),
          deliveryNeighborhood: z.string().max(100).optional(),
          deliveryComplement: z.string().max(200).optional(),
          paymentMethod: z.enum(["credit_card", "debit_card", "pix", "cash"]),
          couponCode: z.string().max(50).optional(),
          pointsToRedeem: z.number().int().min(0).max(5000).optional(),
          notes: z.string().max(1000).optional(),
          // deliveryFeeOverride foi removido: taxa sempre calculada server-side a partir
          // da rota/distância entre a unidade e o destino. Bairro é apenas parte do endereço.
          items: z
            .array(
              z.object({
                productId: z.number().int().positive(),
                productName: z.string().max(200),
                productPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido"),
                  quantity: z.number().int().min(1).max(99),
                  notes: z.string().max(500).optional(),
                  configuration: catalogOrderConfigurationSchema.optional(),
              })
            )
            .min(1, "O pedido precisa ter pelo menos 1 item.")
            .max(50, "Pedido excede o número máximo de itens."),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const tenantStore = await getBonattoRuntimeByStoreId(input.storeId);
        if (!tenantStore || tenantStore.status !== "active") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Esta loja não está disponível para pedidos." });
        }
        // -- Carregar configurações do banco --
        const clubFeatureEnabled = tenantStore?.features.club ?? true;
        const loyaltyFeatureEnabled = tenantStore?.features.loyalty ?? true;
        if ((input.pointsToRedeem ?? 0) > 0 && !loyaltyFeatureEnabled) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O programa de fidelidade nao esta disponivel nesta loja." });
        }
        const dbSettings = await getAllStoreSettings(input.storeId);
        await assertPaymentMethodEnabled(input.paymentMethod as CheckoutPaymentMethod, input.storeId);

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
        const manualStoreOpen = dbSettings.manualStoreOpen === "true";
        if (!manualStoreOpen && !storeOpen) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "A pizzaria está fechada no momento. Tente novamente durante o horário de funcionamento.",
          });
        }

        // Cobertura de entrega não é mais validada por CEP/bairro aqui.
        // A fonte da verdade é quoteDelivery(), executada novamente antes de criar o pedido.

        // -- Validar preços server-side (crítico: nunca confiar no preço do cliente) --
        // Batch fetch: uma única query para todos os produtos do carrinho.
        const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
        const productsFromDb = await getProductsByIds(productIds);
        const productMap = new Map(productsFromDb.map((p) => [p.id, p]));
        const resolvedItems: Array<{
          productId: number;
          productName: string;
          productPrice: string;
          quantity: number;
          notes: string | null;
          snapshotVersion: number;
          configurationSnapshot: string | null;
          pricingBreakdown: string | null;
        }> = [];
        for (const item of input.items) {
          const product = productMap.get(item.productId);
          if (!product || !product.active || (input.storeId !== undefined && product.storeId !== input.storeId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Produto "${item.productName}" não encontrado ou indisponível.` });
          }
          if (product.pricingEngine === "configured_v2" || item.configuration) {
            const configuredProduct = await getConfiguredCatalogProduct({ storeId: product.storeId, productId: product.id });
            const selection = {
              ...item.configuration,
              quantity: item.quantity,
              channel: input.deliveryCep ? "delivery" as const : "pickup" as const,
            };
            const pricing = calculateConfiguredProductPrice(configuredProduct, selection);
            if (pricing.validationErrors.length > 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `${product.name}: ${pricing.validationErrors.join(" ")}`,
              });
            }
            const snapshot = createOrderItemConfigurationSnapshot(configuredProduct, selection, pricing);
            resolvedItems.push({
              productId: item.productId,
              productName: product.name,
              productPrice: pricing.unitTotal.toFixed(2),
              quantity: item.quantity,
              notes: item.notes ?? null,
              snapshotVersion: 2,
              configurationSnapshot: JSON.stringify(snapshot),
              pricingBreakdown: JSON.stringify(pricing.breakdown),
            });
          } else {
            resolvedItems.push({
              productId: item.productId,
              productName: product.name,
              productPrice: product.price,
              quantity: item.quantity,
              notes: item.notes ?? null,
              snapshotVersion: 1,
              configurationSnapshot: null,
              pricingBreakdown: null,
            });
          }
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
        let rewardCouponBenefit: RewardBenefit | null = null;
        if (input.couponCode) {
          if (input.storeId) {
            try {
              rewardCouponBenefit = await validateRewardCoupon({
                storeId: input.storeId,
                userId: ctx.user.id,
                code: input.couponCode,
                subtotal,
                items: resolvedItems,
              });
            } catch (error) {
              if (!(error instanceof TRPCError) || error.code !== "NOT_FOUND") throw error;
            }
          }
          if (rewardCouponBenefit) {
            discountAmount = rewardCouponBenefit.discount;
          } else {
            couponToApply = await getCouponByCode(input.couponCode, input.storeId);
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
        }

        // Benefícios do Clube do Bonatto
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
        }

        const requestFingerprint = crypto
          .createHash("sha256")
          .update(JSON.stringify({
            userId: ctx.user.id,
            storeId: input.storeId,
            customerName: input.customerName,
            customerEmail: input.customerEmail ?? null,
            customerPhone: input.customerPhone ?? null,
            serviceType: input.serviceType,
            deliveryAddress: input.deliveryAddress,
            deliveryStreet: input.deliveryStreet ?? null,
            deliveryNumber: input.deliveryNumber ?? null,
            deliveryNeighborhood: input.deliveryNeighborhood ?? null,
            deliveryCity: input.deliveryCity ?? null,
            deliveryState: input.deliveryState ?? null,
            deliveryCep: input.deliveryCep ?? null,
            deliveryComplement: input.deliveryComplement ?? null,
            paymentMethod: input.paymentMethod,
            couponCode: input.couponCode ?? null,
            pointsToRedeem: input.pointsToRedeem ?? 0,
            notes: input.notes ?? null,
            items: input.items,
          }))
          .digest("hex");

        const requestClaim = await claimOrderRequest({
          idempotencyKey: input.idempotencyKey,
          requestFingerprint,
          userId: ctx.user.id,
          storeId: input.storeId,
        });

        if (requestClaim.state === "conflict") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esta chave de pedido foi reutilizada com dados diferentes.",
          });
        }

        if (requestClaim.state === "processing") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Seu pedido já está sendo processado. Aguarde alguns segundos.",
          });
        }

        if (requestClaim.state === "completed") {
          const completedOrder = await getOrderById(requestClaim.orderId);
          if (!completedOrder) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pedido concluído não encontrado." });
          }
          return {
            orderId: completedOrder.id,
            orderNumber: completedOrder.orderNumber,
            total: Number(completedOrder.total),
            idempotentReplay: true,
          };
        }

        if (requestClaim.state === "failed") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: requestClaim.orderId
              ? "A tentativa anterior criou um pedido, mas não concluiu todas as etapas. Atualize seus pedidos antes de tentar novamente."
              : "A tentativa anterior falhou. Revise os dados e tente novamente.",
          });
        }

        let createdOrderId: number | null = null;
        try {
        let clubDiscountAmount = 0;
        let clubFreeDelivery = false;
        let clubFreePizzaDiscount = 0;
        let reservedFreePizza = false;
        const userForClub = clubFeatureEnabled ? await getCustomerStoreAccount(ctx.user.id, input.storeId) : null;
        const reserveFreePizzaBenefit = async () => {
          if (!userForClub) return false;
          const updated = await db
            .update(customerStoreAccounts)
            .set({ clubFreePizzaUsed: true, updatedAt: new Date() })
            .where(and(
              eq(customerStoreAccounts.id, userForClub.id),
              eq(customerStoreAccounts.clubStatus, "active"),
              eq(customerStoreAccounts.clubFreePizzaUsed, false),
            ))
            .returning({ id: customerStoreAccounts.id });

          reservedFreePizza = updated.length > 0;
          return reservedFreePizza;
        };
        const releaseFreePizzaBenefit = async () => {
          if (!reservedFreePizza) return;
          reservedFreePizza = false;
          if (userForClub) {
            await db
              .update(customerStoreAccounts)
              .set({ clubFreePizzaUsed: false, updatedAt: new Date() })
              .where(eq(customerStoreAccounts.id, userForClub.id));
          }
        };

        if (userForClub && userForClub.clubStatus === "active" && userForClub.clubPlan) {
          const planConfig = await getClubPlanConfig(userForClub.clubPlan, input.storeId);
          if (planConfig) {
            clubFreeDelivery = planConfig.freeDelivery;

            let freePizzaAlreadyUsed = Boolean(userForClub.clubFreePizzaUsed);
            const now = new Date();
            if (freePizzaAlreadyUsed && userForClub.clubFreePizzaResetAt && now > userForClub.clubFreePizzaResetAt) {
              const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              await db
                .update(customerStoreAccounts)
                .set({ clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset, updatedAt: new Date() })
                .where(and(eq(customerStoreAccounts.id, userForClub.id), lte(customerStoreAccounts.clubFreePizzaResetAt, now)));
              freePizzaAlreadyUsed = false;
            }

            if (planConfig.freePizzaPerMonth && !freePizzaAlreadyUsed) {
              const pizzaCategoryIds = getPizzaCategoryIds(await getCategories({ storeId: input.storeId }));
              const candidateFreePizzaDiscount = getFreePizzaDiscountForCart(input.items, productMap, pizzaCategoryIds);
              if (candidateFreePizzaDiscount > 0 && await reserveFreePizzaBenefit()) {
                clubFreePizzaDiscount = candidateFreePizzaDiscount;
              }
            }

            const clubDiscountBase = Math.max(0, subtotal - discountAmount - clubFreePizzaDiscount);
            clubDiscountAmount = (clubDiscountBase * planConfig.discountPercent) / 100;
          }
        }
        discountAmount += clubFreePizzaDiscount + clubDiscountAmount;
        // Desconto de pontos de fidelidade (1 ponto = R$ 0,10, mínimo 50 pontos).
        // O débito real dos pontos é feito *atomicamente* após a criação do pedido
        // (abaixo), garantindo consistência em caso de falha.
        const POINTS_TO_BRL = 0.10;
        let pointsDiscount = 0;
        let pointsUsed = 0;
        // A entrega é sempre recalculada server-side pela distância da rota.
        // Bairro permanece apenas como parte do endereço e nunca define cobertura/preço.
        let rawDeliveryFee = 0;
        let deliveryQuoteSnapshot: Awaited<ReturnType<typeof quoteDelivery>> | null = null;
        if (input.serviceType === "delivery") {
          if (
            !input.deliveryCep ||
            !input.deliveryStreet?.trim() ||
            !input.deliveryNumber?.trim() ||
            !input.deliveryCity?.trim() ||
            !input.deliveryState?.trim()
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Preencha CEP, rua, número, cidade e UF para calcular a entrega.",
            });
          }

          const quote = await quoteDelivery({
            storeId: input.storeId,
            address: {
              postalCode: input.deliveryCep,
              street: input.deliveryStreet,
              number: input.deliveryNumber,
              complement: input.deliveryComplement ?? null,
              neighborhood: input.deliveryNeighborhood ?? null,
              city: input.deliveryCity,
              state: input.deliveryState,
            },
          });
          deliveryQuoteSnapshot = quote;

          if (!quote.available) {
            const deliveryErrorMessages: Record<string, string> = {
              DELIVERY_DISABLED: "A entrega própria está temporariamente indisponível nesta unidade.",
              STORE_LOCATION_MISSING: "A unidade ainda não possui uma origem de entrega configurada.",
              INVALID_ADDRESS: "Preencha o endereço completo para calcular a entrega.",
              ADDRESS_NOT_FOUND: "Não conseguimos localizar este endereço. Confira rua e número.",
              LOW_CONFIDENCE_ADDRESS: "Não conseguimos localizar este endereço com confiança. Confira rua e número.",
              ROUTING_PROVIDER_UNAVAILABLE: "Não foi possível calcular a rota agora. Tente novamente em instantes.",
              OUTSIDE_DELIVERY_AREA: "Infelizmente este endereço está fora da nossa área de entrega.",
              NO_COVERAGE_ZONE: "Este endereço fica em uma área sem cobertura de entrega.",
              NO_DELIVERY_ZONES: "As faixas de entrega desta unidade ainda não foram configuradas.",
            };
            throw new TRPCError({
              code: quote.reason === "OUTSIDE_DELIVERY_AREA" || quote.reason === "NO_COVERAGE_ZONE"
                ? "PRECONDITION_FAILED"
                : "BAD_REQUEST",
              message: deliveryErrorMessages[quote.reason] ?? "Não foi possível calcular a entrega.",
            });
          }

          rawDeliveryFee = quote.deliveryFeeCents / 100;
        }
        const deliveryFee = input.serviceType === "pickup"
          ? 0
          : (clubFreeDelivery || rewardCouponBenefit?.freeDelivery ? 0 : rawDeliveryFee);

        if (input.pointsToRedeem && input.pointsToRedeem >= 50) {
          const userBalance = await getUserLoyaltyPoints(ctx.user.id, input.storeId);
          const payableBeforePoints = Math.max(0, subtotal - discountAmount + deliveryFee);
          const maxPointsByTotal = Math.floor(payableBeforePoints / POINTS_TO_BRL);
          const pts = Math.min(input.pointsToRedeem, userBalance, maxPointsByTotal);
          if (pts >= 50) {
            pointsDiscount = parseFloat((pts * POINTS_TO_BRL).toFixed(2));
            pointsUsed = pts;
            discountAmount += pointsDiscount;
          }
        }
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
        // A unidade do pedido vem da loja selecionada pela URL no cliente.
        // Endereço/CEP definem apenas a entrega e nunca redirecionam o pedido
        // silenciosamente para outra unidade.
        const routedStore = { storeId: input.storeId, reason: "store_slug" as const };

        const deliverySnapshot = deliveryQuoteSnapshot?.available ? deliveryQuoteSnapshot : null;
        const orderData = {
          storeId: routedStore.storeId ?? null,
          userId: ctx.user.id,
          idempotencyKey: input.idempotencyKey,
          serviceType: input.serviceType,
          customerName: input.customerName,
          customerEmail: input.customerEmail ?? null,
          customerPhone: input.customerPhone ?? null,
          deliveryAddress: input.deliveryAddress,
          deliveryNeighborhood: input.deliveryNeighborhood ?? null,
          deliveryCity: input.deliveryCity ?? null,
          deliveryState: input.deliveryState ?? null,
          deliveryCep: input.deliveryCep ?? null,
          deliveryComplement: input.deliveryComplement ?? null,
          deliveryLatitude: deliverySnapshot ? deliverySnapshot.destination.latitude.toFixed(7) : null,
          deliveryLongitude: deliverySnapshot ? deliverySnapshot.destination.longitude.toFixed(7) : null,
          deliveryStraightLineMeters: deliverySnapshot?.straightLineDistanceMeters ?? null,
          deliveryRouteDistanceMeters: deliverySnapshot?.routeDistanceMeters ?? null,
          deliveryDistanceMeters: deliverySnapshot?.distanceMeters ?? null,
          deliveryEstimatedMinutes: deliverySnapshot?.estimatedMinutes ?? null,
          deliveryDistanceZoneId: deliverySnapshot?.zoneId ?? null,
          deliveryStoreLatitude: deliverySnapshot ? deliverySnapshot.origin.latitude.toFixed(7) : null,
          deliveryStoreLongitude: deliverySnapshot ? deliverySnapshot.origin.longitude.toFixed(7) : null,
          deliveryGeocodingProvider: deliverySnapshot?.geocodingProvider ?? null,
          deliveryRoutingProvider: deliverySnapshot?.routingProvider ?? null,
          subtotal: subtotal.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          deliveryFee: deliveryFee.toFixed(2),
          total: total.toFixed(2),
          couponCode: input.couponCode ?? null,
          pointsDiscount: pointsDiscount.toFixed(2),
          pointsUsed,
          paymentMethod: input.paymentMethod,
          deliveryConfirmationCode: input.serviceType === "delivery"
            ? String(crypto.randomInt(0, 10_000)).padStart(4, "0")
            : null,
          notes: input.notes ?? null,
        };
        const orderItemsData = resolvedItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productPrice: item.productPrice,
          quantity: item.quantity,
          notes: item.notes ?? null,
          snapshotVersion: item.snapshotVersion,
          configurationSnapshot: item.configurationSnapshot,
          pricingBreakdown: item.pricingBreakdown,
          subtotal: (parseFloat(item.productPrice) * item.quantity).toFixed(2),
        }));

        // 1) Criação do pedido. Fazemos primeiro para que o orderId seja
        //    conhecido e gravado no livro-razão de fidelidade/cupom.
        let orderId: number;
        try {
          orderId = await createOrder(orderData, orderItemsData);
          createdOrderId = orderId;
          await attachOrderRequest(input.idempotencyKey, orderId);
          await bootstrapOrderLifecycle(orderId);

          if (input.attribution) {
            await db.insert(orderAttributions).values({
              orderId,
              storeId: input.storeId,
              visitorId: input.attribution.visitorId ?? null,
              sessionId: input.attribution.sessionId ?? null,
              utmSource: input.attribution.utmSource ?? null,
              utmMedium: input.attribution.utmMedium ?? null,
              utmCampaign: input.attribution.utmCampaign ?? null,
              utmContent: input.attribution.utmContent ?? null,
              utmTerm: input.attribution.utmTerm ?? null,
              fbclid: input.attribution.fbclid ?? null,
              gclid: input.attribution.gclid ?? null,
              ttclid: input.attribution.ttclid ?? null,
              referrer: input.attribution.referrer ?? null,
              landingPage: input.attribution.landingPage ?? null,
              firstTouchSource: input.attribution.firstTouchSource ?? null,
              firstTouchMedium: input.attribution.firstTouchMedium ?? null,
              firstTouchCampaign: input.attribution.firstTouchCampaign ?? null,
              lastTouchSource: input.attribution.lastTouchSource ?? null,
              lastTouchMedium: input.attribution.lastTouchMedium ?? null,
              lastTouchCampaign: input.attribution.lastTouchCampaign ?? null,
            }).onConflictDoNothing({ target: orderAttributions.orderId });
          }
        } catch (error) {
          await releaseFreePizzaBenefit().catch((releaseError) => {
            console.error("[orders.create] failed to release free pizza benefit after create error:", releaseError);
          });
          throw error;
        }

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
              `-${pointsUsed} pontos resgatados no pedido #${orderId}`,
              routedStore.storeId,
            );
          } catch (debitErr) {
            try {
              await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
              await releaseFreePizzaBenefit();
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
              await releaseFreePizzaBenefit();
            } catch (cancelErr) {
              console.error("[orders.create] failed to cancel order after debit race:", cancelErr);
            }
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Saldo de pontos insuficiente. Saldo atual: ${debit.newBalance}.`,
            });
          }
        }

        // 3) Cupom de recompensa: consumo único e vinculado ao pedido.
        if (rewardCouponBenefit && input.couponCode && input.storeId) {
          try {
            await consumeRewardCoupon({
              storeId: input.storeId,
              userId: ctx.user.id,
              code: input.couponCode,
              orderId,
            });
          } catch (rewardCouponError) {
            try {
              await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
              if (pointsUsed > 0) {
                await addLoyaltyPoints(ctx.user.id, pointsUsed, orderId, `Estorno por falha ao aplicar recompensa no pedido #${orderId}`, routedStore.storeId);
              }
              await releaseFreePizzaBenefit();
            } catch (cleanupError) {
              console.error("[orders.create] cleanup after reward coupon race failed:", cleanupError);
            }
            throw rewardCouponError;
          }
        }

        // 4) Cupom comum: incremento atômico + registro ligado ao pedido. Se a
        //    corrida contra maxUses disparar, cancela o pedido e estorna pontos.
        if (couponToApply) {
          const accepted = await incrementCouponUsage(couponToApply.id);
          if (!accepted) {
            try {
              await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
              if (pointsUsed > 0) {
                await addLoyaltyPoints(ctx.user.id, pointsUsed, orderId, `Estorno por falha ao aplicar cupom no pedido #${orderId}`, routedStore.storeId);
              }
              await releaseFreePizzaBenefit();
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

        const persistedOrder = await getOrderById(orderId);
        await completeOrderRequest(input.idempotencyKey, orderId);

        return {
          orderId,
          orderNumber: persistedOrder?.orderNumber ?? null,
          total,
          idempotentReplay: false,
        };
        } catch (error) {
          await failOrderRequest(input.idempotencyKey, error, createdOrderId).catch((failError) => {
            console.error("[orders.create] failed to mark idempotency request as failed:", failError);
          });
          throw error;
        }
      }),

    myOrders: protectedProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input, ctx }) => getOrdersByUser(ctx.user.id, input?.storeId)),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await getOrderById(input.id);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        // Only allow owner or admin to view order details
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
          if (ctx.user.role !== "manager" || order.storeId == null) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
          }
          await assertStoreEntityAccess(ctx.user, order.storeId);
        }
        const items = await getOrderItems(input.id);
        return { ...order, items };
      }),

    // Admin
    list: staffProcedure
      .input(
        z.object({
          status: z.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]).optional(),
          limit: z.number().int().min(1).max(50000).optional(),
          offset: z.number().int().min(0).optional(),
          storeId: z.number().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getAllOrders({ ...input, storeId });
      }),
    alertFeed: staffProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(50).optional(),
          storeId: z.number().optional(),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getOrderAlertFeed(storeId, input?.limit ?? 20);
      }),

    updateStatus: staffProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]),
          cancellationReasonCode: z.enum([
            "customer_request",
            "payment",
            "address",
            "out_of_stock",
            "delay",
            "operational",
            "other",
          ]).optional(),
          cancellationReason: z.string().trim().min(3).max(500).optional(),
        }).superRefine((value, refinementCtx) => {
          if (value.status === "cancelled" && (!value.cancellationReasonCode || !value.cancellationReason)) {
            refinementCtx.addIssue({
              code: "custom",
              path: ["cancellationReason"],
              message: "Informe o motivo do cancelamento.",
            });
          }
        })
      )
      .mutation(async ({ input, ctx }) => {
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
        const currentOrder = await getOrderById(input.id);
        if (!currentOrder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
        }
        await assertStoreEntityAccess(ctx.user, currentOrder.storeId);
        if (
          input.status === "preparing" &&
          currentOrder.paymentMethod === "pix" &&
          currentOrder.paymentStatus !== "paid"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Marque o PIX como recebido antes de preparar este pedido.",
          });
        }
        const guard = await updateOrderStatusGuarded(input.id, input.status, allowedFrom, {
          actorUserId: ctx.user.id,
          source: ctx.user.role === "manager" ? "manager" : "admin",
          cancellationReasonCode: input.status === "cancelled" ? input.cancellationReasonCode : undefined,
          cancellationReason: input.status === "cancelled" ? input.cancellationReason : undefined,
          notes: input.status === "cancelled" ? input.cancellationReason : undefined,
        });
        if (!guard.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: guard.previous
              ? `Não é possível ir de ${guard.previous} para ${input.status}.`
              : "Pedido não encontrado.",
          });
        }
        if (guard.previous) {
          await applyOrderStatusLifecycle(input.id, guard.previous, input.status, {
            actorUserId: ctx.user.id,
            source: ctx.user.role === "manager" ? "manager" : "admin",
            skipStageLog: true,
          skipStatusTimestamp: true,
          });
        }
        // Buscar pedido para notificar o cliente
        const order = await getOrderById(input.id);
        if (order) {
          // Marcar conversão de automação (carrinho abandonado / reativação)
          if ((input.status === 'confirmed' || input.status === 'preparing') && order.userId) {
            (async () => {
              if (order.storeId) {
                try { await markConversions(order.userId!, input.id, order.storeId); } catch (e) { console.error("markConversions error:", e); }
              }
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
          if (
            input.status === 'delivered' &&
            order.userId &&
            order.total &&
            order.paymentStatus !== 'failed' &&
            order.paymentStatus !== 'refunded'
          ) {
            const pointsToAdd = Math.floor(Number(order.total));
            if (pointsToAdd > 0) {
              (async () => {
                try {
                  const orderTenant = order.storeId ? await getBonattoRuntimeByStoreId(order.storeId) : null;
                  if (orderTenant && !orderTenant.features.loyalty) return;
                  const credited = await creditLoyaltyForOrderIdempotent(
                    input.id,
                    order.userId!,
                    pointsToAdd,
                    `+${pointsToAdd} pontos pelo pedido #${input.id}`,
                    order.storeId,
                  );
                  if (credited) {
                    console.info("[Loyalty] Pontos creditados sem push", {
                      orderId: input.id,
                      userId: order.userId,
                      points: pointsToAdd,
                    });
                  }
                } catch (e) { console.error("Loyalty points error:", e); }
              })();
            }
          }
          // ── Disparar triggers de automação por status ──────────────────────────
          if (order.userId) {
            const orderTriggerMap: Record<string, "order_delivered" | "order_cancelled" | undefined> = {
              delivered: "order_delivered",
              cancelled: "order_cancelled",
            };
            const journeyTrigger = orderTriggerMap[input.status];
            if (journeyTrigger) {
              fireJourneyTrigger(journeyTrigger, order.userId, order.customerPhone ?? undefined, order.storeId ?? undefined).catch(() => {});
            }
            // first_order_month: primeiro pedido do mês corrente
            if (input.status === "delivered") {
              (async () => {
                try {
                  const { getDb } = await import("./db.ts");
                  const { orders: ordersTable } = await import("../drizzle/schema.ts");
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
                    fireJourneyTrigger("first_order_month", order.userId!, order.customerPhone ?? undefined, order.storeId ?? undefined).catch(() => {});
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
      .mutation(async ({ input, ctx }) => {
        const order = await getOrderById(input.id);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido nao encontrado." });
        await assertStoreEntityAccess(ctx.user, order.storeId);
        return updateOrderPaymentStatus(input.id, input.paymentStatus, input.stripePaymentIntentId);
      }),

    confirmPixReceived: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const order = await getOrderById(input.id);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
        await assertStoreEntityAccess(ctx.user, order.storeId);
        if (order.paymentMethod !== "pix") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este pedido não foi feito com PIX." });
        }
        if (order.paymentStatus !== "paid") {
          await updateOrderPaymentStatus(input.id, "paid");
        }
        return { ok: true };
      }),
  }),

  // --- MARKETPLACES ----------------------------------------------------------
  marketplaces: router({
    overview: adminProcedure.query(async () => {
      return getMarketplaceOverview();
    }),
    saveConfig: adminProcedure
      .input(
        z.object({
          providerId: marketplaceProviderIdSchema,
          config: marketplaceConfigSchema.partial(),
        })
      )
      .mutation(async ({ input }) => saveMarketplaceConfig(input.providerId, input.config)),
    testConnection: adminProcedure
      .input(z.object({ providerId: marketplaceProviderIdSchema }))
      .mutation(async ({ input }) => {
        return testMarketplaceConnection(input.providerId);
      }),
    syncCatalog: adminProcedure
      .input(z.object({ providerId: marketplaceProviderIdSchema, merchantId: z.string().optional() }))
      .mutation(async ({ input }) => {
        return runMarketplaceCatalogSync(input.providerId, input.merchantId);
      }),
    syncPromotions: adminProcedure
      .input(
        z.object({
          providerId: marketplaceProviderIdSchema,
          merchantId: z.string().optional(),
          aggregationIds: z.array(z.string().min(1)).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return runMarketplacePromotionsSync(input.providerId, {
          merchantId: input.merchantId,
          aggregationIds: input.aggregationIds,
        });
      }),
    pullOrders: adminProcedure
      .input(z.object({ providerId: marketplaceProviderIdSchema }))
      .mutation(async ({ input }) => {
        return pullMarketplaceOrders(input.providerId);
      }),
  }),

  // --- INTEGRATIONS ----------------------------------------------------------
  integrations: router({
    ifood: router({
      status: staffProcedure
        .input(z.object({ storeId: z.number().optional() }).optional())
        .query(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().getStatus(restaurantId);
        }),
      connect: staffProcedure
        .input(z.object({ storeId: z.number().optional() }).optional())
        .mutation(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().connect(restaurantId);
        }),
      disconnect: staffProcedure
        .input(z.object({ storeId: z.number().optional() }).optional())
        .mutation(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().disconnect(restaurantId);
        }),
      orders: staffProcedure
        .input(z.object({ storeId: z.number().optional() }).optional())
        .query(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().getOrders(restaurantId);
        }),
      generateTestOrder: staffProcedure
        .input(z.object({ storeId: z.number().optional() }).optional())
        .mutation(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().generateTestOrder(restaurantId);
        }),
      logs: staffProcedure
        .input(z.object({ storeId: z.number().optional() }).optional())
        .query(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return listIfoodIntegrationLogs(restaurantId);
        }),
      confirmOrder: staffProcedure
        .input(z.object({ id: z.number(), storeId: z.number().optional() }))
        .mutation(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().confirmOrder(input.id, restaurantId);
        }),
      startPreparation: staffProcedure
        .input(z.object({ id: z.number(), storeId: z.number().optional() }))
        .mutation(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().startPreparation(input.id, restaurantId);
        }),
      dispatch: staffProcedure
        .input(z.object({ id: z.number(), storeId: z.number().optional() }))
        .mutation(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().dispatchOrder(input.id, restaurantId);
        }),
      conclude: staffProcedure
        .input(z.object({ id: z.number(), storeId: z.number().optional() }))
        .mutation(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().concludeOrder(input.id, restaurantId);
        }),
      cancel: staffProcedure
        .input(z.object({ id: z.number(), storeId: z.number().optional() }))
        .mutation(async ({ ctx, input }) => {
          const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
          const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
          return getIfoodProvider().cancelOrder(input.id, restaurantId);
        }),
    }),
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
        await assertPaymentMethodEnabled("credit_card", order.storeId ?? undefined);
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
        await assertPaymentMethodEnabled("credit_card", order.storeId ?? undefined);
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
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido nao encontrado" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const paymentSettings = await assertPaymentMethodEnabled("credit_card", order.storeId ?? undefined);
        if (!paymentSettings.config.orders.savedCardsEnabled) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "O uso de cartões salvos está desativado no momento.",
          });
        }
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
    createManualPixCode: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const paymentOrder = await getOrderById(input.orderId);
        if (!paymentOrder) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido nao encontrado" });
        if (paymentOrder.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const paymentSettings = await assertPaymentMethodEnabled("pix", paymentOrder.storeId ?? undefined);
        if (paymentSettings.config.orders.pixMode !== "manual_key") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "O PIX manual não está ativo para pedidos.",
          });
        }
        const adminPaymentSettings = await getPaymentSettingsAdmin(paymentOrder.storeId ?? undefined);
        const pixKey = adminPaymentSettings.pixKey.trim();
        if (!pixKey) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Configure a chave PIX na aba de pagamentos do admin.",
          });
        }
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const amount = parseFloat(order.total ?? "0");
        if (amount <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Valor do pedido inválido" });
        const txId = `PED${order.id}${Date.now()}`.substring(0, 25);
        const pixCopiaECola = generatePixCode(
          pixKey,
          adminPaymentSettings.config.pix.merchantName,
          amount,
          txId,
          adminPaymentSettings.config.pix.merchantCity,
        );
        return {
          chargeId: `manual:${order.id}`,
          qrCodeImage: generatePixQrCodeUrl(pixCopiaECola),
          pixCopiaECola,
          expirationDate: "",
          value: amount,
          autoConfirm: false,
          instructions: adminPaymentSettings.config.pix.instructions,
        };
      }),
  }),
  // --- ASAAS PIX ---------------------------------------------------------------
  asaas: router({
    /** Gera cobrança PIX via Asaas e retorna QR Code */
    createPix: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const paymentOrder = await getOrderById(input.orderId);
        if (!paymentOrder) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido nao encontrado" });
        if (paymentOrder.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const paymentSettings = await assertPaymentMethodEnabled("pix", paymentOrder.storeId ?? undefined);
        if (paymentSettings.config.orders.pixMode !== "dynamic_asaas") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "O PIX automático via Asaas não está ativo para pedidos.",
          });
        }
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
        savedStreet: z.string().max(240).optional(),
        savedNumber: z.string().max(40).optional(),
        savedComplement: z.string().max(160).optional(),
        savedNeighborhood: z.string().max(160).optional(),
        savedCep: z.string().max(10).optional(),
        savedCity: z.string().max(100).optional(),
        savedState: z.string().max(2).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const hasAnyAddress = Boolean(
          input.savedStreet?.trim() ||
          input.savedNumber?.trim() ||
          input.savedCep?.trim() ||
          input.savedCity?.trim() ||
          input.savedState?.trim() ||
          input.savedAddress?.trim(),
        );

        if (!hasAnyAddress) {
          return updateUserProfile(ctx.user.id, {
            ...input,
            savedAddress: "",
            savedStreet: "",
            savedNumber: "",
            savedComplement: "",
            savedNeighborhood: "",
            savedCep: "",
            savedCity: "",
            savedState: "",
            savedLatitude: null,
            savedLongitude: null,
            savedGeocodedAt: null,
          });
        }

        if (
          !input.savedStreet?.trim() ||
          !input.savedNumber?.trim() ||
          !input.savedCep?.trim() ||
          !input.savedCity?.trim() ||
          input.savedState?.trim().length !== 2
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Para salvar o endereço, preencha CEP, rua, número, cidade e UF.",
          });
        }

        const geocoded = await geocodeDeliveryAddress({
          postalCode: input.savedCep,
          street: input.savedStreet,
          number: input.savedNumber,
          complement: input.savedComplement ?? null,
          neighborhood: input.savedNeighborhood ?? null,
          city: input.savedCity,
          state: input.savedState,
        });

        if (!geocoded.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: geocoded.reason === "LOW_CONFIDENCE_ADDRESS"
              ? "Não conseguimos localizar este endereço com confiança. Confira rua e número."
              : "Não conseguimos localizar este endereço. Confira rua e número.",
          });
        }

        const locality = [
          input.savedNeighborhood?.trim(),
          input.savedCity.trim(),
          input.savedState.trim().toUpperCase(),
        ].filter(Boolean).join(" - ");
        const displayAddress = [
          `${input.savedStreet.trim()}, ${input.savedNumber.trim()}`,
          input.savedComplement?.trim(),
          locality,
          input.savedCep.trim(),
        ].filter(Boolean).join(", ");

        return updateUserProfile(ctx.user.id, {
          ...input,
          savedAddress: displayAddress,
          savedState: input.savedState.trim().toUpperCase(),
          savedLatitude: geocoded.result.latitude.toFixed(7),
          savedLongitude: geocoded.result.longitude.toFixed(7),
          savedGeocodedAt: new Date(),
        });
      }),
    myCoupons: protectedProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input, ctx }) => getCouponsByUser(ctx.user.id, input?.storeId)),
  }),

  // --- UP-SELLS ---------------------------------------------------------------
  upsells: router({
    forCart: publicProcedure
      .input(z.object({ productIds: z.array(z.number()), cartTotal: z.number(), storeId: z.number().optional() }))
      .query(({ input }) => getUpsellsForCart(input.productIds, input.cartTotal, input.storeId)),
    all: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => getAllUpsells(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    create: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
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
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        return createUpsell({ ...input, storeId });
      }),
    update: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional(), data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        discountPercent: z.number().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }) }))
      .mutation(async ({ input, ctx }) => updateUpsell(input.id, await resolveRequiredStoreId(ctx.user, input.storeId), input.data)),
    delete: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => deleteUpsell(input.id, await resolveRequiredStoreId(ctx.user, input.storeId))),
  }),

  // --- PROMOTIONS ---------------------------------------------------------------
  promotions: router({
    // Only logged-in customers can see promotions that requiresLogin=true
    active: protectedProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) => getActivePromotions(input?.storeId)),
    // Public promotions (requiresLogin=false) visible to everyone
    publicActive: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) => getActivePromotions(input?.storeId).then((promos) => promos.filter((p) => !p.requiresLogin))),
    // A promotion can be public while its coupon remains protected by login.
    homeActive: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) => getActivePromotions(input?.storeId).then((promos) => promos.map((promotion) => ({
        ...promotion,
        couponCode: promotion.requiresLogin ? null : promotion.couponCode,
      })))),
    all: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => getAllPromotions(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    create: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        couponCode: z.string().optional(),
        active: z.boolean().default(true),
        requiresLogin: z.boolean().default(true),
        startsAt: z.date().optional(),
        endsAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const result = await createPromotion({ ...input, storeId });
        // Alerta automático para clientes
        await createClientAlert({
          type: "promotion",
          title: `🍽️ Nova promoção: ${input.title}`,
          message: input.description ?? "Confira a nova promoção disponível no cardápio!",
          imageUrl: input.imageUrl,
          icon: "🍽️",
          url: "/minha-conta",
          storeId,
          expiresAt: input.endsAt,
        });
        return result;
      }),
    update: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional(), data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        couponCode: z.string().optional(),
        active: z.boolean().optional(),
        requiresLogin: z.boolean().optional(),
        endsAt: z.date().optional(),
      }) }))
      .mutation(async ({ input, ctx }) => updatePromotion(input.id, await resolveRequiredStoreId(ctx.user, input.storeId), input.data)),
    delete: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => deletePromotion(input.id, await resolveRequiredStoreId(ctx.user, input.storeId))),
  }),

  // --- RAFFLES ---------------------------------------------------------------
  raffles: router({
    active: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) => getActiveRaffles(input?.storeId)),
    all: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => getAllRaffles(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    entries: staffProcedure
      .input(z.object({ raffleId: z.number(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => getRaffleEntries(input.raffleId, await resolveRequiredStoreId(ctx.user, input.storeId))),
    enter: protectedProcedure
      .input(z.object({ raffleId: z.number(), storeId: z.number().optional() }))
      .mutation(({ input, ctx }) => enterRaffle(input.raffleId, ctx.user.id, ctx.user.name ?? "Cliente", input.storeId)),
    draw: staffProcedure
      .input(z.object({ raffleId: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => drawRaffleWinner(input.raffleId, await resolveRequiredStoreId(ctx.user, input.storeId))),
    create: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        prize: z.string().min(1),
        imageUrl: z.string().optional(),
        endsAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const result = await createRaffle({ ...input, storeId, status: "active" });
        // Alerta automático para clientes
        await createClientAlert({
          type: "raffle",
          title: `🌟 Novo sorteio: ${input.title}`,
          message: `Prêmio: ${input.prize}. ${input.description ?? "Participe agora e concorra!"}`,
          imageUrl: input.imageUrl,
          icon: "🌟",
          url: "/minha-conta",
          storeId,
          expiresAt: input.endsAt,
        });
        return result;
      }),
    update: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional(), data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        prize: z.string().optional(),
        status: z.enum(["active", "closed", "drawn"]).optional(),
        endsAt: z.date().optional(),
      }) }))
      .mutation(async ({ input, ctx }) => updateRaffle(input.id, await resolveRequiredStoreId(ctx.user, input.storeId), input.data)),
  }),

  inventory: router({
    list: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        activeOnly: z.boolean().optional(),
        lowStockOnly: z.boolean().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getIngredients({ storeId, activeOnly: input?.activeOnly ?? true, lowStockOnly: input?.lowStockOnly ?? false });
      }),
    lowStock: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getIngredients({ storeId, activeOnly: true, lowStockOnly: true });
      }),
    movements: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        ingredientId: z.number().optional(),
        orderId: z.number().optional(),
        limit: z.number().min(1).max(500).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getInventoryMovements({
          storeId,
          ingredientId: input?.ingredientId,
          orderId: input?.orderId,
          limit: input?.limit,
        });
      }),
    create: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        name: z.string().min(1).max(160),
        category: z.string().max(120).optional(),
        unit: z.enum(["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]),
        currentStock: z.string().regex(/^-?\d+(\.\d{1,3})?$/),
        minimumStock: z.string().regex(/^-?\d+(\.\d{1,3})?$/),
        unitCost: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
        supplier: z.string().max(160).optional(),
        notes: z.string().max(5000).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return createIngredient({
          storeId,
          name: input.name,
          category: input.category ?? null,
          unit: input.unit,
          currentStock: input.currentStock,
          minimumStock: input.minimumStock,
          unitCost: input.unitCost ?? "0.0000",
          supplier: input.supplier ?? null,
          notes: input.notes ?? null,
          active: input.active ?? true,
        });
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(160).optional(),
        category: z.string().max(120).optional(),
        unit: z.enum(["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]).optional(),
        currentStock: z.string().regex(/^-?\d+(\.\d{1,3})?$/).optional(),
        minimumStock: z.string().regex(/^-?\d+(\.\d{1,3})?$/).optional(),
        unitCost: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
        supplier: z.string().max(160).optional(),
        notes: z.string().max(5000).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateIngredient(id, data);
        return { ok: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteIngredient(input.id);
        return { ok: true };
      }),
    adjust: staffProcedure
      .input(z.object({
        ingredientId: z.number(),
        quantityDelta: z.string().regex(/^-?\d+(\.\d{1,3})?$/),
        movementType: z.enum(["entry", "manual_adjustment", "waste", "reversal"]),
        reason: z.string().max(255).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return adjustIngredientStock({
          ingredientId: input.ingredientId,
          quantityDelta: input.quantityDelta,
          movementType: input.movementType,
          reason: input.reason ?? null,
          performedByUserId: ctx.user.id,
        });
      }),
    recipe: staffProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => getProductRecipe(input.productId)),
    setRecipe: staffProcedure
      .input(z.object({
        productId: z.number(),
        items: z.array(z.object({
          ingredientId: z.number(),
          quantity: z.string().regex(/^\d+(\.\d{1,3})?$/),
          wastePercent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        })),
      }))
      .mutation(({ input }) => setProductRecipe(input.productId, input.items)),
    syncOrderConsumption: staffProcedure
      .input(z.object({ orderId: z.number(), mode: z.enum(["consume", "reverse"]) }))
      .mutation(async ({ input }) => {
        return input.mode === "consume" ? consumeInventoryForOrder(input.orderId) : reverseInventoryForOrder(input.orderId);
      }),
  }),

  staffMembers: router({
      list: staffProcedure
        .input(z.object({
          storeId: z.number().optional(),
          role: z.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]).optional(),
          activeOnly: z.boolean().optional(),
        }).optional())
        .query(async ({ input, ctx }) => {
          const storeId = await resolveStoreId(ctx.user, input?.storeId);
          const staff = await getStaffMembers({ storeId, role: input?.role, activeOnly: input?.activeOnly ?? true });
          return Promise.all(
            staff.map(async (member: any) => {
              if (member.role !== "waiter") return member;
              const accessToken = await ensureStaffAccessToken(member.id);
              return { ...member, accessToken };
            }),
          );
        }),
    create: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        userId: z.number().optional(),
        name: z.string().min(2).max(200),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        const id = await createStaffMember({
          storeId,
          userId: input.userId ?? null,
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          role: input.role,
          active: input.active ?? true,
        });
        const accessToken = input.role === "waiter" ? await ensureStaffAccessToken(id) : null;
        return { id, accessToken };
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).max(200).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const member = await getStaffMemberById(id);
        if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Membro nao encontrado." });
        await assertStoreEntityAccess(ctx.user, member.storeId);
        await updateStaffMember(id, data);
        return { ok: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const member = await getStaffMemberById(input.id);
        if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Membro nao encontrado." });
        await assertStoreEntityAccess(ctx.user, member.storeId);
        await deleteStaffMember(input.id);
        return { ok: true };
      }),
    regenerateAccessToken: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const member = await getStaffMemberById(input.id);
        if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Membro nao encontrado." });
        await assertStoreEntityAccess(ctx.user, member.storeId);
        const accessToken = await regenerateStaffAccessToken(input.id);
        return { accessToken };
      }),
  }),

  diningRoom: router({
    tables: staffProcedure
      .input(z.object({ storeId: z.number().optional(), activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getDiningTables({ storeId, activeOnly: input?.activeOnly ?? true });
      }),
    createTable: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        name: z.string().min(1).max(80),
        capacity: z.number().int().min(1).max(50).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return createDiningTable({
          storeId,
          name: input.name,
          capacity: input.capacity ?? 4,
          status: "free",
          active: input.active ?? true,
        });
      }),
    updateTable: staffProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(80).optional(),
        status: z.enum(["free", "occupied", "reserved", "awaiting_closure"]).optional(),
        capacity: z.number().int().min(1).max(50).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const table = await getDiningTableById(id);
        if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Mesa nao encontrada." });
        await assertStoreEntityAccess(ctx.user, table.storeId);
        await updateDiningTable(id, data);
        return { ok: true };
      }),
    deleteTable: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const table = await getDiningTableById(input.id);
        if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Mesa nao encontrada." });
        await assertStoreEntityAccess(ctx.user, table.storeId);
        await deleteDiningTable(input.id);
        return { ok: true };
      }),
    sessions: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        status: z.enum(["open", "awaiting_closure", "closed", "cancelled"]).optional(),
        waiterStaffId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getTableSessions({ storeId, status: input?.status, waiterStaffId: input?.waiterStaffId });
      }),
    openSession: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        tableId: z.number(),
        waiterStaffId: z.number().optional(),
        customerName: z.string().max(200).optional(),
        guestCount: z.number().int().min(1).max(50).optional(),
        notes: z.string().max(5000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        const table = await getDiningTableById(input.tableId);
        if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Mesa nao encontrada." });
        await assertStoreEntityAccess(ctx.user, table.storeId, storeId);
        return openTableSession({
          tableId: input.tableId,
          storeId,
          waiterStaffId: input.waiterStaffId ?? null,
          customerName: input.customerName ?? null,
          guestCount: input.guestCount ?? 1,
          status: "open",
          notes: input.notes ?? null,
          subtotal: "0.00",
          discountAmount: "0.00",
          total: "0.00",
        });
      }),
    updateSession: staffProcedure
      .input(z.object({
        id: z.number(),
        waiterStaffId: z.number().optional(),
        customerName: z.string().max(200).optional(),
        guestCount: z.number().int().min(1).max(50).optional(),
        notes: z.string().max(5000).optional(),
        status: z.enum(["open", "awaiting_closure", "closed", "cancelled"]).optional(),
        subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        total: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const session = await getTableSessionById(id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Comanda nao encontrada." });
        await assertStoreEntityAccess(ctx.user, session.storeId);
        await updateTableSession(id, data);
        return { ok: true };
      }),
    closeSession: staffProcedure
      .input(z.object({
        id: z.number(),
        subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        tipAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        total: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        status: z.enum(["awaiting_closure", "closed", "cancelled"]).optional(),
        closedByStaffId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const session = await getTableSessionById(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Comanda nao encontrada." });
        await assertStoreEntityAccess(ctx.user, session.storeId);
        await closeTableSessionWithComputedTotals(input.id, {
          subtotal: input.subtotal,
          discountAmount: input.discountAmount,
          tipAmount: input.tipAmount,
          total: input.total,
          status: input.status,
          closedByStaffId: input.closedByStaffId ?? null,
        });
        return { ok: true };
      }),
    attachOrder: staffProcedure
      .input(z.object({ tableSessionId: z.number(), orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const session = await getTableSessionById(input.tableSessionId);
        const order = await getOrderById(input.orderId);
        if (!session || !order) throw new TRPCError({ code: "NOT_FOUND", message: "Comanda ou pedido nao encontrado." });
        await assertStoreEntityAccess(ctx.user, session.storeId);
        await assertStoreEntityAccess(ctx.user, order.storeId);
        if (session.storeId !== order.storeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Comanda e pedido pertencem a lojas diferentes." });
        await attachOrderToTableSessionAndSync(input.tableSessionId, input.orderId);
        return { ok: true };
      }),
    addItem: staffProcedure
      .input(z.object({
        tableSessionId: z.number(),
        productId: z.number(),
        quantity: z.number().int().min(1).max(100),
        notes: z.string().max(500).optional(),
        addedByStaffId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const session = await getTableSessionById(input.tableSessionId);
        const product = await getProductById(input.productId);
        if (!session || !product) throw new TRPCError({ code: "NOT_FOUND", message: "Comanda ou produto nao encontrado." });
        await assertStoreEntityAccess(ctx.user, session.storeId);
        if (product.storeId != null && product.storeId !== session.storeId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Produto fora da loja da comanda." });
        }
        const itemId = await addTableSessionItem({
          tableSessionId: input.tableSessionId,
          productId: input.productId,
          quantity: input.quantity,
          notes: input.notes ?? null,
          addedByStaffId: input.addedByStaffId ?? null,
        });
        return { ok: true, itemId };
      }),
    removeItem: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const item = await getTableSessionItemById(input.id);
        const session = item ? await getTableSessionById(item.tableSessionId) : undefined;
        if (!item || !session) throw new TRPCError({ code: "NOT_FOUND", message: "Item nao encontrado." });
        await assertStoreEntityAccess(ctx.user, session.storeId);
        await removeTableSessionItem(input.id);
        return { ok: true };
      }),
    updateItemStatus: staffProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "preparing", "ready", "served", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const item = await getTableSessionItemById(input.id);
        const session = item ? await getTableSessionById(item.tableSessionId) : undefined;
        if (!item || !session) throw new TRPCError({ code: "NOT_FOUND", message: "Item nao encontrado." });
        await assertStoreEntityAccess(ctx.user, session.storeId);
        await updateTableSessionItemStatus(input.id, input.status);
        return { ok: true };
      }),
  }),

  customerMetrics: router({
    list: staffProcedure
      .input(z.object({ storeId: z.number().optional(), limit: z.number().min(1).max(500).optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getCustomerMetricsReport({ storeId: storeId ?? 0, limit: input?.limit });
      }),
  }),

  // --- ADMIN USERS ---------------------------------------------------------------
  adminUsers: router({
    list: staffProcedure
      .input(z.object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        search: z.string().max(160).optional(),
        role: z.enum(["user", "admin", "manager"]).optional(),
        status: z.enum(["active", "inactive", "suspended", "setup_pending"]).optional(),
        clubStatus: z.enum(["active", "pending", "cancelled", "none"]).optional(),
        loginMethod: z.enum(["email", "phone", "google", "apple", "facebook", "instagram", "manus"]).optional(),
        hasOrders: z.enum(["with_orders", "without_orders"]).optional(),
        storeId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getAdminUsersPage({
          page: input?.page,
          pageSize: input?.pageSize,
          search: input?.search,
          role: input?.role,
          status: input?.status,
          clubStatus: input?.clubStatus,
          loginMethod: input?.loginMethod,
          hasOrders: input?.hasOrders,
          storeId,
        });
      }),
    sendCoupon: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        userId: z.number(),
        code: z.string().min(1),
        discountType: z.enum(["percentage", "fixed"]),
        discountValue: z.string(),
        minOrderValue: z.string().optional(),
        maxUses: z.number().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => createUserCoupon({ ...input, storeId: await resolveRequiredStoreId(ctx.user, input.storeId) })),
  }),

  reports: router({
    sales: staffProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return getSalesReport(input.startDate, input.endDate, storeId);
      }),
    topProducts: staffProcedure
      .input(
        z
          .object({
            limit: z.number().optional(),
            storeId: z.number().optional(),
            startDate: z.date().optional(),
            endDate: z.date().optional(),
          })
          .optional(),
      )
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getTopProducts(input?.limit, storeId, {
          startDate: input?.startDate,
          endDate: input?.endDate,
        });
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
      .input(z.object({ name: z.string(), phone: z.string().optional(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const token = crypto.randomBytes(32).toString("hex");
        const id = await createDriver({
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          accessToken: token,
          active: true,
          storeId,
        });
        return { id, accessToken: token };
      }),
    update: staffProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), phone: z.string().optional(), active: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const driver = await getDriverById(input.id);
        if (!driver) throw new TRPCError({ code: "NOT_FOUND", message: "Motoboy nao encontrado." });
        await assertStoreEntityAccess(ctx.user, driver.storeId);
        return updateDriver(input.id, { name: input.name, phone: input.phone, active: input.active });
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const driver = await getDriverById(input.id);
        if (!driver) throw new TRPCError({ code: "NOT_FOUND", message: "Motoboy nao encontrado." });
        await assertStoreEntityAccess(ctx.user, driver.storeId);
        return deleteDriver(input.id);
      }),
    assignToOrder: staffProcedure
      .input(z.object({ orderId: z.number(), driverId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        // Capturar motoboy anterior antes de atualizar
        const prevOrder = await getOrderById(input.orderId);
        if (!prevOrder) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido nao encontrado." });
        await assertStoreEntityAccess(ctx.user, prevOrder.storeId);
        if (input.driverId) {
          const nextDriver = await getDriverById(input.driverId);
          if (!nextDriver) throw new TRPCError({ code: "NOT_FOUND", message: "Motoboy nao encontrado." });
          if (!nextDriver.active) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Este motoboy está inativo." });
          }
          await assertStoreEntityAccess(ctx.user, nextDriver.storeId);
          if (prevOrder.storeId !== nextDriver.storeId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Pedido e motoboy pertencem a lojas diferentes." });
          }
        }
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
    allLocations: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getAllActiveDriverLocations(storeId);
      }),
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

    // Motoboy aceita explicitamente o pedido antes de iniciar a rota
    acceptOrder: publicProcedure
      .input(z.object({ token: z.string(), orderId: z.number() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });

        const result = await driverAcceptOrder(driver.id, input.orderId);
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error ?? "Não foi possível aceitar este pedido.",
          });
        }

        return { ok: true, acceptedAt: result.acceptedAt };
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
      .input(z.object({
        token: z.string(),
        orderId: z.number(),
        confirmationCode: z.string().regex(/^\d{4}$/, "Informe os 4 dígitos do código de entrega."),
      }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
        const result = await driverConfirmDelivery(driver.id, input.orderId, input.confirmationCode);
        if (!result.success) throw new TRPCError({ code: "BAD_REQUEST", message: result.error ?? "Erro ao confirmar entrega" });

        await applyOrderStatusLifecycle(input.orderId, "out_for_delivery", "delivered", {
          source: "driver",
          skipStageLog: true,
          skipStatusTimestamp: true,
        });

        // A notificação do cliente é processada pelo lifecycle/outbox
        // de forma idempotente. Não duplicar uma segunda notificação aqui.
        // O painel administrativo já recebe o novo status em tempo real.
        // Não gerar push para todos os admins a cada entrega concluída.
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

  waiters: router({
    me: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const waiter = await getStaffMemberByAccessToken(input.token);
        if (!waiter || waiter.role !== "waiter") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token invalido" });
        }
        return waiter;
      }),
    tables: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const waiter = await getStaffMemberByAccessToken(input.token);
        if (!waiter || waiter.role !== "waiter") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token invalido" });
        }
        return getDiningTables({ storeId: waiter.storeId ?? undefined, activeOnly: true });
      }),
    sessions: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const waiter = await getStaffMemberByAccessToken(input.token);
        if (!waiter || waiter.role !== "waiter") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token invalido" });
        }
        const sessions = (await getTableSessions({ storeId: waiter.storeId ?? undefined })) as any[];
        return sessions.filter(
          (session) =>
            (session.status === "open" || session.status === "awaiting_closure") &&
            (session.waiterStaffId == null || session.waiterStaffId === waiter.id),
        );
      }),
    menu: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const waiter = await getStaffMemberByAccessToken(input.token);
        if (!waiter || waiter.role !== "waiter") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token invalido" });
        }
        return getProducts({ storeId: waiter.storeId ?? undefined, activeOnly: true });
      }),
    openSession: publicProcedure
      .input(z.object({
        token: z.string(),
        tableId: z.number(),
        customerName: z.string().max(200).optional(),
        guestCount: z.number().int().min(1).max(50).optional(),
        notes: z.string().max(5000).optional(),
      }))
      .mutation(async ({ input }) => {
        const waiter = await getStaffMemberByAccessToken(input.token);
        if (!waiter || waiter.role !== "waiter") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token invalido" });
        }
        const table = await getDiningTableById(input.tableId);
        if (!table || table.storeId == null || table.storeId !== waiter.storeId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Mesa fora da loja do garcom." });
        }
        const id = await openTableSession({
          tableId: input.tableId,
          storeId: waiter.storeId ?? null,
          waiterStaffId: waiter.id,
          customerName: input.customerName ?? null,
          guestCount: input.guestCount ?? 1,
          status: "open",
          notes: input.notes ?? null,
          subtotal: "0.00",
          discountAmount: "0.00",
          tipAmount: "0.00",
          total: "0.00",
        });
        return { id };
      }),
    addItem: publicProcedure
      .input(z.object({
        token: z.string(),
        tableSessionId: z.number(),
        productId: z.number(),
        quantity: z.number().int().min(1).max(100),
        notes: z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const waiter = await getStaffMemberByAccessToken(input.token);
        if (!waiter || waiter.role !== "waiter") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token invalido" });
        }
        const session = await getTableSessionById(input.tableSessionId);
        const product = await getProductById(input.productId);
        if (!session || session.storeId == null || session.storeId !== waiter.storeId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Comanda fora da loja do garcom." });
        }
        if (!product || (product.storeId != null && product.storeId !== waiter.storeId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Produto fora da loja do garcom." });
        }
        await updateTableSession(input.tableSessionId, { waiterStaffId: waiter.id });
        const itemId = await addTableSessionItem({
          tableSessionId: input.tableSessionId,
          productId: input.productId,
          quantity: input.quantity,
          notes: input.notes ?? null,
          addedByStaffId: waiter.id,
        });
        return { itemId };
      }),
    closeSession: publicProcedure
      .input(z.object({
        token: z.string(),
        id: z.number(),
        discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        tipAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      }))
      .mutation(async ({ input }) => {
        const waiter = await getStaffMemberByAccessToken(input.token);
        if (!waiter || waiter.role !== "waiter") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token invalido" });
        }
        const session = await getTableSessionById(input.id);
        if (!session || session.storeId == null || session.storeId !== waiter.storeId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Comanda fora da loja do garcom." });
        }
        await updateTableSession(input.id, { waiterStaffId: waiter.id });
        await closeTableSessionWithComputedTotals(input.id, {
          status: "closed",
          discountAmount: input.discountAmount,
          tipAmount: input.tipAmount,
          closedByStaffId: waiter.id,
        });
        return { ok: true };
      }),
  }),

  // --- PAYMENT SETTINGS -------------------------------------------------------
  paymentSettings: router({
    getPublic: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) => getPaymentSettingsPublic(input?.storeId)),
    getAdmin: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => getPaymentSettingsAdmin(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    save: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        config: paymentConfigSchema,
        pixKey: z.string().max(120),
      }))
      .mutation(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const { storeId: _requestedStoreId, ...settings } = input;
        await savePaymentSettings(settings, storeId);
        return getPaymentSettingsAdmin(storeId);
      }),
  }),

  // --- STORE SETTINGS ---------------------------------------------------------
  storeSettings: router({
    // Qualquer um pode ler configurações públicas gerais da loja.
    // Cobertura/taxa de entrega são expostas exclusivamente pelo delivery.quote.
    get: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) => withLocalTtlCache(
        `public:store-settings:${input?.storeId ?? "default"}`,
        15_000,
        async () => {
          const settings = await getAllStoreSettings(input?.storeId);
          // Strip sensitive fields from public endpoint
          const { pixKey: _pk, whatsappNumber: _wn, ...publicSettings } = settings;
          return publicSettings;
        },
      )),
    // Staff endpoint with all settings including sensitive fields
    getAdmin: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getAllStoreSettings(storeId);
      }),
    // Staff pode salvar configurações da loja
    save: staffProcedure
      .input(z.object({
        storeHours: z.record(z.string(), z.union([
          z.null(),
          z.object({ open: z.string(), close: z.string() }),
        ])),
        deliveryCepPrefixes: z.array(z.string()).optional(), // legado: não usado na cobrança
        pixKey: z.string().optional(),
        whatsappNumber: z.string().optional(),
        deliveryFee: z.string().optional(),
        minOrderValue: z.string().optional(),
        manualStoreOpen: z.boolean().optional(),
        storeId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        await setStoreSetting("storeHours", JSON.stringify(input.storeHours), storeId);
        if (input.deliveryCepPrefixes !== undefined) {
          await setStoreSetting("deliveryCepPrefixes", JSON.stringify(input.deliveryCepPrefixes), storeId);
        }
        if (input.pixKey !== undefined) await setStoreSetting("pixKey", input.pixKey, storeId);
        if (input.whatsappNumber !== undefined) await setStoreSetting("whatsappNumber", input.whatsappNumber, storeId);
        if (input.deliveryFee !== undefined) await setStoreSetting("deliveryFee", input.deliveryFee, storeId);
        if (input.minOrderValue !== undefined) await setStoreSetting("minOrderValue", input.minOrderValue, storeId);
        if (input.manualStoreOpen !== undefined) await setStoreSetting("manualStoreOpen", String(input.manualStoreOpen), storeId);
        return { success: true };
      }),
    savePizzaFlavorConfig: staffProcedure
      .input(z.object({
        enabled: z.boolean(),
        pricingMode: z.enum(["highest"]).default("highest"),
        maxFlavorsBySize: z.object({
          small: z.number().int().min(1).max(4),
          medium: z.number().int().min(1).max(4),
          large: z.number().int().min(1).max(4),
          family: z.number().int().min(1).max(4),
        }),
        storeId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        const { storeId: _storeId, ...config } = input;
        await setStoreSetting("pizzaFlavorConfig", JSON.stringify(config), storeId);
        return { success: true };
      }),
    saveMenuLayout: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        layout: z.enum(["editorial", "compact", "visual"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        await setStoreSetting("menuLayout", input.layout, storeId);
        return { success: true };
      }),
    saveHomeLayoutConfig: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        greetingSubtitle: z.string().min(1).max(100),
        orderTitle: z.string().min(1).max(80),
        orderDescription: z.string().min(1).max(180),
        orderButtonLabel: z.string().min(1).max(40),
        quickActionsTitle: z.string().min(1).max(60),
        offersLabel: z.string().min(1).max(24),
        couponsLabel: z.string().min(1).max(24),
        clubLabel: z.string().min(1).max(24),
        menuLabel: z.string().min(1).max(24),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        const { storeId: _storeId, ...config } = input;
        await setStoreSetting("homeLayoutConfig", JSON.stringify(config), storeId);
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
        fireJourneyTrigger("rating_submitted", ctx.user.id, userPhone, order.storeId ?? undefined).catch(() => {});
        if (input.rating <= 3) {
          fireJourneyTrigger("rating_negative", ctx.user.id, userPhone, order.storeId ?? undefined).catch(() => {});
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

    orderReviewByOrder: protectedProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order || order.userId !== ctx.user.id) return null;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const [review] = await db
          .select()
          .from(orderReviews)
          .where(eq(orderReviews.orderId, input.orderId))
          .limit(1);
        if (!review) return null;
        const items = await db
          .select()
          .from(productReviews)
          .where(eq(productReviews.orderId, input.orderId));
        const reward = await getReviewCashbackOffer({ orderId: input.orderId, userId: ctx.user.id });
        return { ...review, items, reward };
      }),

    submitOrderReview: protectedProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(1200).optional(),
        items: z.array(z.object({
          orderItemId: z.number().int().positive(),
          rating: z.number().int().min(1).max(5),
          comment: z.string().trim().max(600).optional(),
        })).max(50).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
        if (order.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Pedido não pertence a você." });
        }
        if (order.status !== "delivered") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O pedido precisa estar concluído para ser avaliado." });
        }
        if (!order.storeId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pedido sem unidade vinculada." });
        }

        const orderItemsRows = await getOrderItems(input.orderId);
        const itemMap = new Map(orderItemsRows.map((item) => [item.id, item]));
        for (const item of input.items) {
          if (!itemMap.has(item.orderItemId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Há um item inválido nesta avaliação." });
          }
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const orderReviewId = await db.transaction(async (tx) => {
          const [review] = await tx
            .insert(orderReviews)
            .values({
              orderId: order.id,
              storeId: order.storeId!,
              userId: ctx.user.id,
              rating: input.rating,
              comment: input.comment?.trim() || null,
            })
            .onConflictDoNothing({ target: orderReviews.orderId })
            .returning({ id: orderReviews.id });

          if (!review) {
            throw new TRPCError({ code: "CONFLICT", message: "Este pedido já foi avaliado." });
          }

          if (input.items.length > 0) {
            await tx.insert(productReviews).values(
              input.items.map((item) => {
                const orderItem = itemMap.get(item.orderItemId)!;
                return {
                  orderReviewId: review.id,
                  orderId: order.id,
                  orderItemId: orderItem.id,
                  storeId: order.storeId!,
                  userId: ctx.user.id,
                  productId: orderItem.productId,
                  productName: orderItem.productName,
                  rating: item.rating,
                  comment: item.comment?.trim() || null,
                };
              }),
            );
          }
          return review.id;
        });

        const reward = await awardReviewCashback({
          orderId: order.id,
          orderReviewId,
          userId: ctx.user.id,
          storeId: order.storeId,
        });

        const phone = ctx.user.phone ?? undefined;
        fireJourneyTrigger("rating_submitted", ctx.user.id, phone, order.storeId).catch(() => {});
        if (input.rating <= 3) {
          fireJourneyTrigger("rating_negative", ctx.user.id, phone, order.storeId).catch(() => {});
        }
        return { success: true, reward };
      }),

    adminOrderReviews: staffProcedure
      .input(z.object({
        storeId: z.number().int().positive().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(100).default(25),
      }).optional())
      .query(async ({ ctx, input }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 25;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const where = storeId ? eq(orderReviews.storeId, storeId) : undefined;
        const rows = await db
          .select()
          .from(orderReviews)
          .where(where)
          .orderBy(desc(orderReviews.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize);

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(orderReviews)
          .where(where);

        return {
          rows,
          pagination: {
            page,
            pageSize,
            total: count ?? 0,
            totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
          },
        };
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
  // Endereços salvos também são geocodificados. A coordenada serve apenas para
  // reutilização do endereço; taxa e prazo são sempre recalculados no delivery.quote.
  addresses: router({
    list: protectedProcedure.query(({ ctx }) => getUserAddresses(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        label: z.string().trim().min(1).max(50),
        cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
        street: z.string().trim().min(2).max(240),
        number: z.string().trim().min(1).max(40),
        complement: z.string().trim().max(160).optional(),
        neighborhood: z.string().trim().max(160).optional(),
        city: z.string().trim().min(2).max(100),
        state: z.string().trim().length(2),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const geocoded = await geocodeDeliveryAddress({
          postalCode: input.cep,
          street: input.street,
          number: input.number,
          complement: input.complement ?? null,
          neighborhood: input.neighborhood ?? null,
          city: input.city,
          state: input.state,
        });
        if (!geocoded.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: geocoded.reason === "LOW_CONFIDENCE_ADDRESS"
              ? "Não conseguimos localizar este endereço com confiança. Confira rua e número."
              : "Não conseguimos localizar este endereço. Confira rua e número.",
          });
        }
        const state = input.state.toUpperCase();
        const locality = [input.neighborhood, input.city, state].filter(Boolean).join(" - ");
        const address = [
          `${input.street}, ${input.number}`,
          input.complement,
          locality,
          input.cep,
        ].filter(Boolean).join(", ");
        await createUserAddress({
          userId: ctx.user.id,
          label: input.label,
          address,
          cep: input.cep,
          street: input.street,
          number: input.number,
          complement: input.complement ?? null,
          neighborhood: input.neighborhood ?? null,
          city: input.city,
          state,
          latitude: geocoded.result.latitude.toFixed(7),
          longitude: geocoded.result.longitude.toFixed(7),
          geocodedAt: new Date(),
          isDefault: input.isDefault ?? false,
          updatedAt: new Date(),
        });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        label: z.string().trim().min(1).max(50),
        cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
        street: z.string().trim().min(2).max(240),
        number: z.string().trim().min(1).max(40),
        complement: z.string().trim().max(160).optional(),
        neighborhood: z.string().trim().max(160).optional(),
        city: z.string().trim().min(2).max(100),
        state: z.string().trim().length(2),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const geocoded = await geocodeDeliveryAddress({
          postalCode: input.cep,
          street: input.street,
          number: input.number,
          complement: input.complement ?? null,
          neighborhood: input.neighborhood ?? null,
          city: input.city,
          state: input.state,
        });
        if (!geocoded.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: geocoded.reason === "LOW_CONFIDENCE_ADDRESS"
              ? "Não conseguimos localizar este endereço com confiança. Confira rua e número."
              : "Não conseguimos localizar este endereço. Confira rua e número.",
          });
        }
        const state = input.state.toUpperCase();
        const locality = [input.neighborhood, input.city, state].filter(Boolean).join(" - ");
        const address = [
          `${input.street}, ${input.number}`,
          input.complement,
          locality,
          input.cep,
        ].filter(Boolean).join(", ");
        await updateUserAddress(input.id, ctx.user.id, {
          label: input.label,
          address,
          cep: input.cep,
          street: input.street,
          number: input.number,
          complement: input.complement ?? null,
          neighborhood: input.neighborhood ?? null,
          city: input.city,
          state,
          latitude: geocoded.result.latitude.toFixed(7),
          longitude: geocoded.result.longitude.toFixed(7),
          geocodedAt: new Date(),
          isDefault: input.isDefault ?? false,
          updatedAt: new Date(),
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
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
    neighborhoodOptions: staffProcedure
      .input(z.object({ storeId: z.number().int().positive().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input?.storeId);
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select({
            neighborhood: orders.deliveryNeighborhood,
            city: orders.deliveryCity,
          })
          .from(orders)
          .where(and(eq(orders.storeId, storeId), isNotNull(orders.deliveryNeighborhood)))
          .groupBy(orders.deliveryNeighborhood, orders.deliveryCity)
          .orderBy(orders.deliveryNeighborhood);
        return rows
          .filter((row): row is { neighborhood: string; city: string | null } => Boolean(row.neighborhood?.trim()))
          .map((row) => ({ neighborhood: row.neighborhood.trim(), city: row.city?.trim() || null }));
      }),
    list: protectedProcedure
      .input(z.object({ storeId: z.number().int().positive().optional() }).optional())
      .query(({ ctx, input }) => getClientNotifications(ctx.user.id, input?.storeId)),
    unreadCount: protectedProcedure
      .input(z.object({ storeId: z.number().int().positive().optional() }).optional())
      .query(({ ctx, input }) => getUnreadNotificationCount(ctx.user.id, input?.storeId)),
    markRead: protectedProcedure
      .input(z.object({ storeId: z.number().int().positive().optional() }).optional())
      .mutation(({ ctx, input }) => markNotificationsRead(ctx.user.id, input?.storeId)),
    markOneRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive(), storeId: z.number().int().positive().optional() }))
      .mutation(({ ctx, input }) => markNotificationRead(input.notificationId, ctx.user.id, input.storeId)),
    archive: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive(), storeId: z.number().int().positive().optional() }))
      .mutation(({ ctx, input }) => archiveClientNotification(input.notificationId, ctx.user.id, input.storeId)),
    send: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        userId: z.number(),
        title: z.string(),
        message: z.string(),
        type: z.enum(['order', 'promo', 'system']).optional(),
      }))
      .mutation(async ({ input, ctx }) => createClientNotification({
        ...input,
        storeId: await resolveRequiredStoreId(ctx.user, input.storeId),
        type: input.type ?? 'system',
      })),
    // --- Agendamento de notificações ---
    scheduleList: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => listScheduledNotifications(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    scheduleCreate: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        title: z.string().min(1).max(200),
        message: z.string().min(1),
        imageUrl: z.string().max(2048).optional(),
        channel: z.enum(['push', 'whatsapp', 'both']).default('push'),
        targetAudience: z.enum(['all', 'active', 'inactive', 'club']).default('all'),
        scheduledAt: z.date(),
        recurrence: z.enum(['once', 'daily', 'weekly']).default('once'),
        neighborhoodFilter: z.array(z.string()).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => createScheduledNotification({
        storeId: await resolveRequiredStoreId(ctx.user, input.storeId),
        title: input.title,
        message: input.message,
        imageUrl: input.imageUrl ?? null,
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
    scheduleCancel: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => cancelScheduledNotification(input.id, await resolveRequiredStoreId(ctx.user, input.storeId))),
    scheduleDelete: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => deleteScheduledNotification(input.id, await resolveRequiredStoreId(ctx.user, input.storeId))),
  }),

  // --- LOYALTY ----------------------------------------------------------------
  loyalty: router({
    points: protectedProcedure
      .input(z.object({ storeId: z.number().int().positive().optional() }).optional())
      .query(({ ctx, input }) => getUserLoyaltyPoints(ctx.user.id, input?.storeId)),
    spendingHistory: protectedProcedure
      .input(z.object({ storeId: z.number().int().positive().optional() }).optional())
      .query(({ ctx, input }) => getUserSpendingHistory(ctx.user.id, input?.storeId)),
    history: protectedProcedure
      .input(z.object({ storeId: z.number().int().positive().optional() }).optional())
      .query(({ ctx, input }) => getLoyaltyHistory(ctx.user.id, 30, input?.storeId)),
    // Preview do desconto de pontos (sem debitar — o débito acontece no createOrder)
    preview: protectedProcedure
      .input(z.object({ points: z.number().int().min(50).max(5000), storeId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const POINTS_TO_BRL = 0.10;
        const balance = await getUserLoyaltyPoints(ctx.user.id, input.storeId);
        const pts = Math.min(input.points, balance);
        if (pts < 50) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pontos insuficientes para resgate.' });
        const discount = parseFloat((pts * POINTS_TO_BRL).toFixed(2));
        return { discount, pointsUsed: pts, balance };
      }),
    // Admin: adicionar pontos manualmente
    adminAdd: staffProcedure
      .input(z.object({ userId: z.number(), points: z.number().int().min(1), description: z.string().optional(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        await addLoyaltyPoints(input.userId, input.points, undefined, input.description ?? `+${input.points} pontos (manual)`, storeId);
        return { ok: true };
      }),
  }),

  // --- AVATAR -----------------------------------------------------------------------------
  avatar: router({
    upload: protectedProcedure
      .input(z.object({
        base64: legacyImageBase64Schema, // ~3MB base64 limit for avatars
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePutAdapter: storagePut } = await import("./adapters/storage.ts");
        const buffer = Buffer.from(input.base64, "base64");
      assertLegacyImageSize(buffer);
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
        const pushPreview = input.message.length > 100 ? input.message.slice(0, 97) + "..." : input.message;
        if (senderRole === 'customer') {
          await sendPushToAdmins({
            storeId: order.storeId,
            title: "Nova mensagem de cliente",
            body: `Pedido #${input.orderId} - ${order.customerName}: ${pushPreview}`,
            url: `/admin?tab=messages&order=${input.orderId}`,
            tag: `admin-chat-${input.orderId}`,
          });
        }
        if (senderRole === 'admin' && order.userId) {
          await sendPushToUser(order.userId, {
            storeId: order.storeId,
            title: "Mensagem da Bonatto Pizza",
            body: pushPreview,
            url: `/rastrear/${input.orderId}`,
            tag: `customer-chat-${input.orderId}`,
          });
        }
        if (senderRole === 'admin' && order.driverId) {
          await sendPushToDriver(order.driverId, {
            title: "Mensagem do restaurante",
            body: pushPreview,
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
        const { callLLM } = await import('./adapters/llm.ts');
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
        const reply = content.trim();
        await sendOrderMessage({ orderId: input.orderId, userId: adminId, senderRole: 'admin', message: reply });
        if (order.userId) await sendPushToUser(order.userId, {
          storeId: order.storeId,
          title: "Resposta da Bonatto Pizza",
          body: reply.length > 100 ? reply.slice(0, 97) + "..." : reply,
          url: `/rastrear/${input.orderId}`,
          tag: `customer-chat-ai-${input.orderId}`,
        });
        return { reply };
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
          url: `/admin?tab=messages&order=${input.orderId}`,
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
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
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
    listJourneys: staffProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
      const list = await listJourneys(await resolveRequiredStoreId(ctx.user, input.storeId));
      return list.map(j => ({ ...j, steps: JSON.parse(j.steps) as JourneyStep[] }));
    }),
    getJourney: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const j = await getJourneyById(input.id, storeId);
        if (!j) throw new TRPCError({ code: 'NOT_FOUND' });
        return { ...j, steps: JSON.parse(j.steps) as JourneyStep[] };
      }),
    createJourney: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
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
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const id = await createJourney({ ...input, storeId });
        return { id };
      }),
    updateJourney: staffProcedure
      .input(z.object({
        id: z.number(),
        storeId: z.number().optional(),
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
      .mutation(async ({ input, ctx }) => {
        const { id, storeId: requestedStoreId, ...data } = input;
        const storeId = await resolveRequiredStoreId(ctx.user, requestedStoreId);
        await updateJourney(id, data as Parameters<typeof updateJourney>[1], storeId);
        return { ok: true };
      }),
    deleteJourney: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await deleteJourney(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
    duplicateJourney: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const newId = await duplicateJourney(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
        if (newId === -1) throw new TRPCError({ code: 'NOT_FOUND', message: 'Jornada não encontrada' });
        return { id: newId };
      }),
    toggleJourney: staffProcedure
      .input(z.object({ id: z.number(), status: z.enum(['active', 'paused', 'draft']), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await updateJourney(input.id, { status: input.status }, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
    listExecutions: staffProcedure
      .input(z.object({ journeyId: z.number().optional(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        return listExecutions(input.journeyId, storeId);
      }),
    cancelExecution: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await cancelExecution(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
    triggerJourney: staffProcedure
      .input(z.object({ journeyId: z.number(), userIds: z.array(z.number()), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        if (!await getJourneyById(input.journeyId, storeId)) throw new TRPCError({ code: "NOT_FOUND" });
        let started = 0;
        for (const uid of input.userIds) {
          const r = await startJourneyExecution(input.journeyId, uid);
          if (r > 0) started++;
        }
        return { started };
      }),
    listCustomerTags: staffProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
      const result = await getAllCustomerTagsWithUsers(await resolveRequiredStoreId(ctx.user, input.storeId));
      return (result as unknown as [unknown[]])[0] as Array<{
        userId: number; tag: string; assignedAt: Date; name: string; email: string; phone: string;
      }>;
    }),
    refreshTags: staffProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
      await refreshCustomerTags(await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    listAbandonedCarts: staffProcedure
      .input(z.object({ status: z.enum(['pending', 'recovered', 'expired']).optional(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => listAbandonedCarts(input.status, await resolveRequiredStoreId(ctx.user, input.storeId))),
    registerAbandonedCart: protectedProcedure
      .input(z.object({
        storeId: z.number().int().positive(),
        customerName: z.string(),
        customerPhone: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          quantity: z.number().int().min(1).max(99),
          productPrice: z.string(),
        })),
        total: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenant = await getBonattoRuntimeByStoreId(input.storeId);
        if (!tenant?.features.automations) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Automacoes indisponiveis nesta loja." });
        const id = await registerAbandonedCart({ userId: ctx.user.id, ...input });
        return { id };
      }),
    generateWebhookToken: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        if (!await getJourneyById(input.id, storeId)) throw new TRPCError({ code: "NOT_FOUND" });
        const token = crypto.randomBytes(32).toString('hex');
        await updateJourney(input.id, { webhookToken: token } as Parameters<typeof updateJourney>[1], storeId);
        return { token };
      }),
    getWebhookToken: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const j = await getJourneyById(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
        if (!j) throw new TRPCError({ code: 'NOT_FOUND' });
        return { token: (j as Record<string, unknown>).webhookToken as string | null };
      }),
    processExecutions: staffProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      await processJourneyExecutions(storeId);
      return { ok: true };
      }),
    getExecutionLogs: staffProcedure
      .input(z.object({ executionId: z.number(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const execs = await listExecutions(undefined, await resolveRequiredStoreId(ctx.user, input.storeId));
        const exec = execs.find(e => e.id === input.executionId);
        if (!exec) throw new TRPCError({ code: 'NOT_FOUND' });
        return {
          ...exec,
          logs: exec.logs ? JSON.parse(exec.logs) as Array<{ at: string; msg: string }> : [],
        };
      }),
    testTrigger: staffProcedure
      .input(z.object({
        journeyId: z.number(),
        storeId: z.number().optional(),
        trigger: z.enum(['checkout_abandoned', 'tag_inativo_15', 'tag_inativo_30', 'tag_inativo_60', 'tag_inativo_custom', 'first_order', 'new_user', 'club_subscriber', 'manual', 'order_delivered', 'order_cancelled', 'birthday', 'loyalty_milestone', 'rating_submitted', 'rating_negative', 'club_expiring', 'first_order_month']),
        userId: z.number().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        if (!await getJourneyById(input.journeyId, storeId)) throw new TRPCError({ code: "NOT_FOUND" });
        const targetUserId = input.userId ?? ctx.user.id;
        await startJourneyExecution(input.journeyId, targetUserId, input.phone);
        return { ok: true, message: `Gatilho disparado para jornada #${input.journeyId} com usuário #${targetUserId}` };
      }),

    // ── Painel A/B: estatísticas de grupos A e B por jornada ─────────────────
    getAbStats: staffProcedure
      .input(z.object({ journeyId: z.number(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { groupA: 0, groupB: 0, conversionA: 0, conversionB: 0, revenueA: 0, revenueB: 0 };
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const execs = await db
          .select()
          .from(journeyExecutions)
          .where(and(eq(journeyExecutions.journeyId, input.journeyId), eq(journeyExecutions.storeId, storeId)));
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
    health: staffProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        if (!db) return {
          status: "critical" as const,
          running: 0,
          overdue: 0,
          failedLast7Days: 0,
          completedLast7Days: 0,
          channels: { push: false, whatsapp: false, email: false },
          lastExecutionAt: null,
        };

        const since = new Date(Date.now() - 7 * 86_400_000);
        const [runningRows, recentRows, latestRows] = await Promise.all([
          db.select({ id: journeyExecutions.id, nextStepAt: journeyExecutions.nextStepAt }).from(journeyExecutions).where(and(eq(journeyExecutions.storeId, storeId), eq(journeyExecutions.status, "running"))).limit(10_000),
          db.select({ status: journeyExecutions.status }).from(journeyExecutions).where(and(eq(journeyExecutions.storeId, storeId), gte(journeyExecutions.startedAt, since))).limit(20_000),
          db.select({ startedAt: journeyExecutions.startedAt }).from(journeyExecutions).where(eq(journeyExecutions.storeId, storeId)).orderBy(desc(journeyExecutions.startedAt)).limit(1),
        ]);
        const now = Date.now();
        const overdue = runningRows.filter((item) => item.nextStepAt && item.nextStepAt.getTime() < now - 5 * 60_000).length;
        const failedLast7Days = recentRows.filter((item) => item.status === "failed").length;
        const completedLast7Days = recentRows.filter((item) => item.status === "completed").length;
        const channels = {
          push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
          whatsapp: (process.env.WHATSAPP_PROVIDER ?? "none") !== "none",
          email: Boolean(process.env.RESEND_API_KEY),
        };
        const status = overdue > 20 || failedLast7Days > 50
          ? "critical" as const
          : overdue > 0 || failedLast7Days > 0 || !channels.push
            ? "attention" as const
            : "healthy" as const;
        return { status, running: runningRows.length, overdue, failedLast7Days, completedLast7Days, channels, lastExecutionAt: latestRows[0]?.startedAt ?? null };
      }),

    getGlobalMetrics: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { totalExecutions: 0, completedExecutions: 0, conversions: 0, conversionRate: 0, attributedRevenue: 0, activeJourneys: 0, topJourneys: [] };
        const storeId = await resolveRequiredStoreId(ctx.user, input?.storeId);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Execuções do mês
        let allExecs = await db
          .select()
          .from(journeyExecutions)
          .where(and(eq(journeyExecutions.storeId, storeId), gte(journeyExecutions.startedAt, monthStart)));
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
        const activeJourneysList = await db.select({ id: journeys.id, name: journeys.name }).from(journeys).where(and(eq(journeys.storeId, storeId), eq(journeys.status, 'active')));
        // Top 5 jornadas por execuções no mês
        const execsByJourney = allExecs.reduce((acc, e) => {
          acc[e.journeyId] = (acc[e.journeyId] ?? 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        const allJourneysList = await db.select({ id: journeys.id, name: journeys.name }).from(journeys).where(eq(journeys.storeId, storeId));
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
    getCustomerJourneyHistory: staffProcedure
      .input(z.object({ userId: z.number(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const execs = await db
          .select()
          .from(journeyExecutions)
          .where(and(eq(journeyExecutions.storeId, storeId), eq(journeyExecutions.userId, input.userId)))
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
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        if (input.tag) {
          const customers = await getCrmCustomersByTag(input.tag, storeId);
          return { customers, total: customers.length };
        }
        const [customers, total] = await Promise.all([
          getCrmCustomers({ search: input.search, limit: input.limit, offset: input.offset, storeId }),
          countCrmCustomers(input.search, storeId),
        ]);
        return { customers, total };
      }),
    getCustomerDetail: staffProcedure
      .input(z.object({ userId: z.number(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const detail = await getCrmCustomerDetail(input.userId, storeId);
        if (!detail) throw new TRPCError({ code: 'NOT_FOUND' });
        const [tags, executions, carts] = await Promise.all([
          getTagsForCustomer(input.userId, storeId),
          getJourneyExecutionsByUser(input.userId, storeId),
          getAbandonedCartsByUser(input.userId, storeId),
        ]);
        return { ...detail, tags, executions, carts };
      }),
    assignTag: staffProcedure
      .input(z.object({ userId: z.number(), tag: z.string(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await assignTagToCustomer(input.userId, input.tag, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
    removeTag: staffProcedure
      .input(z.object({ userId: z.number(), tag: z.string(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await removeTagFromCustomer(input.userId, input.tag, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
    getStats: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input?.storeId);
        return getCrmStats(storeId);
      }),

    // ── Tags Personalizadas ──────────────────────────────────────────────
    listCustomTags: staffProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => listCustomTags(await resolveRequiredStoreId(ctx.user, input.storeId))),
    createCustomTag: staffProcedure
      .input(z.object({ name: z.string().min(1).max(100), color: z.string().default("#6b7280"), description: z.string().optional(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const id = await createCustomTag({ ...input, storeId: await resolveRequiredStoreId(ctx.user, input.storeId) });
        return { id };
      }),
    updateCustomTag: staffProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), color: z.string().optional(), description: z.string().optional(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { id, storeId: requestedStoreId, ...data } = input;
        await updateCustomTag(id, await resolveRequiredStoreId(ctx.user, requestedStoreId), data);
        return { ok: true };
      }),
    deleteCustomTag: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await deleteCustomTag(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
    assignCustomTag: staffProcedure
      .input(z.object({ userId: z.number(), tagId: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await assignCustomTagToCustomer(input.userId, input.tagId, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
    removeCustomTag: staffProcedure
      .input(z.object({ userId: z.number(), tagId: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await removeCustomTagFromCustomer(input.userId, input.tagId, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
    getCustomTagsForCustomer: staffProcedure
      .input(z.object({ userId: z.number(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return getCustomTagsForCustomer(input.userId, await resolveRequiredStoreId(ctx.user, input.storeId));
      }),
    getCustomersByCustomTag: staffProcedure
      .input(z.object({ tagName: z.string(), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return getCustomersByCustomTagName(input.tagName, await resolveRequiredStoreId(ctx.user, input.storeId));
      }),
    triggerJourneyForTag: staffProcedure
      .input(z.object({ journeyId: z.number(), tag: z.string(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        if (!await getJourneyById(input.journeyId, storeId)) throw new TRPCError({ code: "NOT_FOUND" });
        const customers = await getCrmCustomersByTag(input.tag, storeId);
        let started = 0;
        for (const c of customers) {
          const r = await startJourneyExecution(input.journeyId, c.id, c.phone ?? undefined);
          if (r > 0) started++;
        }
        return { started, total: customers.length };
      }),
    triggerJourneyForCustomer: staffProcedure
      .input(z.object({ journeyId: z.number(), userId: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        if (!await getJourneyById(input.journeyId, storeId)) throw new TRPCError({ code: "NOT_FOUND" });
        const db = await import('./db.ts');
        const detail = await db.getCrmCustomerDetail(input.userId, storeId);
        if (!detail) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        const r = await startJourneyExecution(input.journeyId, input.userId, detail.user.phone ?? undefined);
        return { started: r > 0 ? 1 : 0 };
      }),
  }),

  // ── Templates de Notificação ──────────────────────────────────────────────
  notificationTemplates: router({
    list: staffProcedure
      .input(z.object({ storeId: z.number().optional(), event: z.string().optional(), channel: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => listNotificationTemplates({
        ...input,
        storeId: await resolveRequiredStoreId(ctx.user, input?.storeId),
      })),

    seed: staffProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        await seedNotificationTemplates(await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),

    uploadImage: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        base64: legacyImageBase64Schema,
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(255).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const { storagePutAdapter: storagePut } = await import("./adapters/storage.ts");
        const { compressToWebP } = await import("./imageUtils.ts");
        const rawBuffer = Buffer.from(input.base64, "base64");
      assertLegacyImageSize(rawBuffer);
        const { buffer, mimeType, ext } = await compressToWebP(rawBuffer, 84, 1200);
        const key = `stores/${storeId}/notifications/notification-${Date.now()}.${ext}`;
        return storagePut(key, buffer, mimeType);
      }),

     create: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        event: z.enum(['order_confirmed', 'order_preparing', 'order_out_for_delivery', 'order_delivered', 'order_cancelled', 'cart_abandoned_step1', 'cart_abandoned_step2', 'cart_abandoned_step3', 'reactivation_15', 'reactivation_30', 'reactivation_60', 'custom']),
        channel: z.enum(['push', 'whatsapp', 'both']).default('both'),
        title: z.string().min(1).max(200),
        body: z.string().min(1),
        imageUrl: z.string().max(2048).optional(),
        redirectUrl: z.string().max(500).optional(),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createNotificationTemplate({
          ...input,
          storeId: await resolveRequiredStoreId(ctx.user, input.storeId),
        });
        return { id };
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        storeId: z.number().optional(),
        title: z.string().min(1).max(200).optional(),
        body: z.string().min(1).optional(),
        imageUrl: z.string().max(2048).optional().nullable(),
        isActive: z.boolean().optional(),
        channel: z.enum(['push', 'whatsapp', 'both']).optional(),
        redirectUrl: z.string().max(500).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, storeId: requestedStoreId, ...data } = input;
        await updateNotificationTemplate(id, await resolveRequiredStoreId(ctx.user, requestedStoreId), data);
        return { ok: true };
      }),

    delete: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        await deleteNotificationTemplate(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),

    // Disparo de notificação personalizada em massa
    sendCustom: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        title: z.string().min(1).max(200),
        body: z.string().min(1),
        imageUrl: z.string().max(2048).optional(),
        redirectUrl: z.string().optional(), // ex: "/cardapio", "/promocoes", URL completa
        tag: z.enum(['novo', 'recorrente', 'indeciso', 'inativo_15', 'inativo_30', 'inativo_60']).optional(),
        // se tag for undefined, envia para todos
      }))
      .mutation(async ({ ctx, input }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const database = await getDb();
        if (!database) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
        }
        const storeCustomers = await database
          .selectDistinct({ userId: orders.userId })
          .from(orders)
          .where(and(eq(orders.storeId, storeId), isNotNull(orders.userId)));
        let userIds = storeCustomers
          .map((row) => row.userId)
          .filter((userId): userId is number => userId !== null);

        // Se tiver tag, buscar apenas os usuários com aquela tag
        if (input.tag) {
          const { customerTags } = await import('../drizzle/schema.ts');
          const rows = await database
            .select({ userId: customerTags.userId })
            .from(customerTags)
            .where(and(eq(customerTags.storeId, storeId), eq(customerTags.tag, input.tag)));
          const taggedUserIds = new Set(rows.map((row) => row.userId));
          userIds = userIds.filter((userId) => taggedUserIds.has(userId));
        }
        if (userIds.length === 0) {
          return { sent: 0 as number, failed: 0 as number, skipped: true as boolean };
        }

        const result = await sendPushToAllUsers(
          {
            title: input.title,
            body: input.body,
            imageUrl: input.imageUrl,
            url: input.redirectUrl ?? "/",
            tag: input.tag ? `custom-${input.tag}` : "custom",
          },
          userIds
        );
        return result;
      }),
  }),
  // --- ENTREGA POR DISTÂNCIA --------------------------------------------------
  // A antiga tabela delivery_zones permanece somente como legado de dados.
  // Não há mais API pública/administrativa de preço ou cobertura por bairro.
  delivery: deliveryRouter,

  // --- LOJAS (MULTI-TENANT) --------------------------------------------------
  stores: storesRouter,
  operations: operationsRouter,
  siteStudio: siteStudioRouter,
  rewards: rewardsRouter,
  catalog: catalogRouter,

  restaurantNetwork: router({
    distributionProducts: staffProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(({ input }) => listDistributionProducts({ activeOnly: input?.activeOnly ?? true })),
    createDistributionProduct: adminProcedure
      .input(distributionProductSchema)
      .mutation(({ ctx, input }) => createDistributionProduct(input, ctx.user.id)),
    updateDistributionProduct: adminProcedure
      .input(updateDistributionProductSchema)
      .mutation(({ ctx, input }) => updateDistributionProduct(input, ctx.user.id)),
    overview: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ ctx, input }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        return getFinancialOverview({ storeId, startDate: input.startDate, endDate: input.endDate });
      }),
    supplyOrders: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return listSupplyOrders({ storeId, status: input?.status });
      }),
    supplyOrderDetails: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getSupplyOrderDetails(input.id)),
    createSupplyOrder: staffProcedure
      .input(createSupplyOrderSchema)
      .mutation(async ({ ctx, input }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        if (!storeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma loja para criar o pedido ao centro de distribuição." });
        return createSupplyOrder({ ...input, storeId }, ctx.user.id);
      }),
    updateSupplyOrderStatus: staffProcedure
      .input(updateSupplyOrderStatusSchema)
      .mutation(async ({ ctx, input }) => updateSupplyOrderStatus(input, ctx.user.id)),
    createExpense: staffProcedure
      .input(createExpenseSchema)
      .mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
        return createExpense(input, ctx.user.id, scopedStoreId);
      }),
    createFinancialFee: staffProcedure
      .input(createFinancialFeeSchema)
      .mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
        return createFinancialFee(input, ctx.user.id, scopedStoreId);
      }),
    upsertMonthlyClosing: staffProcedure
      .input(createMonthlyClosingSchema)
      .mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
        return upsertMonthlyClosing(input, ctx.user.id, scopedStoreId);
      }),
    monthlyClosings: staffProcedure
      .input(z.object({ storeId: z.number().optional(), year: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return listMonthlyClosings({ storeId, year: input?.year });
      }),
    auditLogs: staffProcedure
      .input(z.object({ storeId: z.number().optional(), limit: z.number().min(1).max(250).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return listAuditLogs({ storeId, limit: input?.limit });
      }),
  }),

  // --- CLUBE DO BONATTO -------------------------------------------------------
  club: clubRouter,

  // --- MENU SLIDES -----------------------------------------------------------
  analytics: mergeRouters(analyticsRouter, router({
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
    globalSearch: staffProcedure
      .input(z.object({ query: z.string().trim().min(2).max(80), storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input.storeId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { sql } = await import("drizzle-orm");
        const likeQuery = `%${input.query}%`;
        const storeClause = storeId ? sql`AND o."storeId" = ${storeId}` : sql``;
        const messageStoreClause = storeId ? sql`AND ord."storeId" = ${storeId}` : sql``;
        const tableStoreClause = storeId ? sql`AND dt."storeId" = ${storeId}` : sql``;

        const [ordersResult, customersResult, tablesResult, conversationsResult] = await Promise.all([
          db.execute(sql`
            SELECT o.id, o."customerName", o."customerPhone", o.status, o.total, o."createdAt"
            FROM orders o
            WHERE (
              o.id::text ILIKE ${likeQuery}
              OR o."customerName" ILIKE ${likeQuery}
              OR o."customerPhone" ILIKE ${likeQuery}
            )
            ${storeClause}
            ORDER BY o."createdAt" DESC
            LIMIT 8
          `),
          db.execute(sql`
            SELECT u.id, u.name, u.email, u.phone, MAX(o."createdAt") AS "lastOrderAt"
            FROM users u
            LEFT JOIN orders o ON o."userId" = u.id
            WHERE u.role = 'user'
              AND (
                u.name ILIKE ${likeQuery}
                OR u.email ILIKE ${likeQuery}
                OR u.phone ILIKE ${likeQuery}
              )
              ${storeId ? sql`AND EXISTS (SELECT 1 FROM orders ox WHERE ox."userId" = u.id AND ox."storeId" = ${storeId})` : sql``}
            GROUP BY u.id, u.name, u.email, u.phone
            ORDER BY "lastOrderAt" DESC NULLS LAST
            LIMIT 8
          `),
          db.execute(sql`
            SELECT dt.id, dt.name, dt.status, ts.id AS "sessionId", ts."customerName", ts."updatedAt"
            FROM dining_tables dt
            LEFT JOIN table_sessions ts ON ts."tableId" = dt.id AND ts.status IN ('open', 'awaiting_closure')
            WHERE (
              dt.name ILIKE ${likeQuery}
              OR ts."customerName" ILIKE ${likeQuery}
            )
            ${tableStoreClause}
            ORDER BY ts."updatedAt" DESC NULLS LAST, dt."updatedAt" DESC
            LIMIT 8
          `),
          db.execute(sql`
            SELECT ord.id AS "orderId", ord."customerName", MAX(om."createdAt") AS "lastMessageAt", MAX(om.message) AS "lastMessage"
            FROM order_messages om
            INNER JOIN orders ord ON ord.id = om."orderId"
            WHERE (
              ord."customerName" ILIKE ${likeQuery}
              OR ord.id::text ILIKE ${likeQuery}
              OR om.message ILIKE ${likeQuery}
            )
            ${messageStoreClause}
            GROUP BY ord.id, ord."customerName"
            ORDER BY "lastMessageAt" DESC
            LIMIT 8
          `),
        ]);

        const rowsOf = (result: unknown) =>
          ((result as { rows?: Array<Record<string, unknown>> })?.rows
            ?? (result as [Array<Record<string, unknown>>])?.[0]
            ?? []);

        return {
          orders: rowsOf(ordersResult),
          customers: rowsOf(customersResult),
          tables: rowsOf(tablesResult),
          conversations: rowsOf(conversationsResult),
        };
      }),
    dashboardSnapshot: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const storeId = await resolveStoreId(ctx.user, input?.storeId);
        return getAdminDashboardSnapshot(storeId);
      }),
  })),

  menuSlides: router({
    uploadImage: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        base64: legacyImageBase64Schema, // keep below Vercel request-size limits
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(255).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const { storagePutAdapter: storagePut } = await import("./adapters/storage.ts");
        const { compressToWebP } = await import("./imageUtils.ts");
        const rawBuffer = Buffer.from(input.base64, "base64");
      assertLegacyImageSize(rawBuffer);
        const { buffer, mimeType, ext, reductionPct } = await compressToWebP(rawBuffer, 85, 1920);
        const key = `stores/${storeId}/banners/slide-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        console.log(`[upload] banner comprimido ${reductionPct}% → WebP`);
        return { url };
      }),
    list: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) => getMenuSlides(true, input?.storeId)),
    listAll: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => getMenuSlides(false, await resolveRequiredStoreId(ctx.user, input?.storeId))),
    seed: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .mutation(async ({ input, ctx }) => seedMenuSlides(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    create: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        title: z.string().min(1).max(200),
        subtitle: z.string().max(300).optional().nullable(),
        imageUrl: z.string().max(2000).optional().nullable(),
        videoUrl: z.string().max(2000).optional().nullable(),
        badgeText: z.string().max(80).optional().nullable(),
        ctaText: z.string().max(80).optional().nullable(),
        ctaLink: z.string().max(500).optional().nullable(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input, ctx }) => createMenuSlide({ ...input, storeId: await resolveRequiredStoreId(ctx.user, input.storeId) })),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        storeId: z.number().optional(),
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
      .mutation(async ({ input, ctx }) => {
        const { id, storeId: requestedStoreId, ...data } = input;
        return updateMenuSlide(id, await resolveRequiredStoreId(ctx.user, requestedStoreId), data);
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await deleteMenuSlide(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
        return { ok: true };
      }),
  }),

  // --- CARROSSEL HERO --------------------------------------------------------
  carousel: router({
    list: publicProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(({ input }) => getCarouselImages(true, input?.storeId)),
    listAll: staffProcedure
      .input(z.object({ storeId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => getCarouselImages(false, await resolveRequiredStoreId(ctx.user, input?.storeId))),
    uploadImage: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        base64: legacyImageBase64Schema, // keep below Vercel request-size limits
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        fileName: z.string().max(255).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const { storagePutAdapter: storagePut } = await import("./adapters/storage.ts");
        const { compressToWebP } = await import("./imageUtils.ts");
        const rawBuffer = Buffer.from(input.base64, "base64");
      assertLegacyImageSize(rawBuffer);
        const { buffer, mimeType, ext, reductionPct } = await compressToWebP(rawBuffer, 85, 1920);
        const key = `stores/${storeId}/carousel/hero-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        console.log(`[upload] carrossel comprimido ${reductionPct}% → WebP`);
        return { url };
      }),
    create: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        imageUrl: z.string().min(1),
        title: z.string().optional().nullable(),
        destinationType: z.enum(["none", "product", "category", "internal", "external"]).default("none"),
        destinationValue: z.string().max(2000).optional().nullable(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
        const destinationValue = await validateCarouselDestination(storeId, input.destinationType, input.destinationValue);
        return createCarouselImage({ ...input, destinationValue, storeId });
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        storeId: z.number().optional(),
        imageUrl: z.string().optional(),
        title: z.string().optional().nullable(),
        destinationType: z.enum(["none", "product", "category", "internal", "external"]).optional(),
        destinationValue: z.string().max(2000).optional().nullable(),
        sortOrder: z.number().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, storeId: requestedStoreId, ...data } = input;
        const storeId = await resolveRequiredStoreId(ctx.user, requestedStoreId);
        if (data.destinationType) {
          data.destinationValue = await validateCarouselDestination(storeId, data.destinationType, data.destinationValue);
        }
        return updateCarouselImage(id, storeId, data);
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number(), storeId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => { await deleteCarouselImage(input.id, await resolveRequiredStoreId(ctx.user, input.storeId)); return { ok: true }; }),
  }),

  // ─── RECOVERY DASHBOARD ─────────────────────────────────────────────────────────────
  recovery: router({

    /** KPIs gerais de recuperação de receita */
    stats: adminProcedure
      .input(z.object({
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db.ts");
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
        const { getDb: getDb2 } = await import("./db.ts");
        const db = await getDb2();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { abandonedCarts: acTable } = await import("../drizzle/schema.ts");
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
        const { getDb: getDb3 } = await import("./db.ts");
        const db = await getDb3();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { automationEvents: aeTable } = await import("../drizzle/schema.ts");
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
      const { getDb: getDb4 } = await import("./db.ts");
      const db = await getDb4();
      if (!db) return [];
      const { abandonedCarts: acTable } = await import("../drizzle/schema.ts");
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
        const { getDb: getDb4 } = await import("./db.ts");
        const db = await getDb4();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { abandonedCarts: acTable } = await import("../drizzle/schema.ts");
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
        const { getDb: getDb4 } = await import("./db.ts");
        const db = await getDb4();
        if (!db) return null;
        const { abandonedCarts: acTable } = await import("../drizzle/schema.ts");
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
    list: protectedProcedure
      .input(z.object({ storeId: z.number().int().positive() }))
      .query(({ ctx, input }) => listClientAlerts(ctx.user.id, input.storeId)),

    // Conta alertas não lidos (para badge no nav)
    unreadCount: protectedProcedure
      .input(z.object({ storeId: z.number().int().positive() }))
      .query(({ ctx, input }) => countUnreadClientAlerts(ctx.user.id, input.storeId)),

    // Marca alerta como lido
    dismiss: protectedProcedure
      .input(z.object({ alertId: z.number(), storeId: z.number().int().positive() }))
      .mutation(({ input, ctx }) => dismissClientAlert(input.alertId, ctx.user.id, input.storeId)),

    // Admin: criar alerta manual (novidades do clube, comunicados etc.)
    createManual: staffProcedure
      .input(z.object({
        storeId: z.number().optional(),
        type: z.enum(["promotion", "raffle", "coupon", "club", "custom"]),
        title: z.string().min(1),
        message: z.string().min(1),
        imageUrl: z.string().max(2048).optional(),
        icon: z.string().optional(),
        url: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => createClientAlert({
        ...input,
        storeId: await resolveRequiredStoreId(ctx.user, input.storeId),
      })),
  }),
});
export type AppRouter = typeof appRouter;





