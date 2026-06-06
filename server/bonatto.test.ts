import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getCategories: vi.fn().mockResolvedValue([
    { id: 1, name: "Pizzas", slug: "pizzas", description: "Pizzas artesanais", imageUrl: null, sortOrder: 1, active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Bebidas", slug: "bebidas", description: "Bebidas geladas", imageUrl: null, sortOrder: 2, active: true, createdAt: new Date(), updatedAt: new Date() },
  ]),
  getCategoryById: vi.fn().mockResolvedValue(null),
  createCategory: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  getProducts: vi.fn().mockResolvedValue([
    { id: 1, categoryId: 1, name: "Margherita", description: "Molho, mussarela, tomate", price: "45.00", imageUrl: null, active: true, featured: false, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, categoryId: 1, name: "Calabresa", description: "Molho, calabresa, cebola", price: "47.00", imageUrl: null, active: true, featured: false, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
  ]),
  getProductById: vi.fn().mockImplementation((id: number) => {
    const products = [
      { id: 1, categoryId: 1, name: "Margherita", description: "Molho, mussarela, tomate", price: "45.00", imageUrl: null, active: true, featured: false, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, categoryId: 1, name: "Calabresa", description: "Molho, calabresa, cebola", price: "47.00", imageUrl: null, active: true, featured: false, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
    ];
    return Promise.resolve(products.find(p => p.id === id) ?? null);
  }),
  getProductsByIds: vi.fn().mockImplementation((ids: number[]) => {
    const products = [
      { id: 1, categoryId: 1, name: "Margherita", description: "Molho, mussarela, tomate", price: "45.00", imageUrl: null, active: true, featured: false, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, categoryId: 1, name: "Calabresa", description: "Molho, calabresa, cebola", price: "47.00", imageUrl: null, active: true, featured: false, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
    ];
    return Promise.resolve(products.filter((p) => ids.includes(p.id)));
  }),
  createProduct: vi.fn().mockResolvedValue(3),
  updateProduct: vi.fn().mockResolvedValue(undefined),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  getAllOrders: vi.fn().mockResolvedValue([
    { id: 1, userId: null, customerName: "João Silva", customerEmail: "joao@test.com", customerPhone: "(37) 99999-0001", deliveryAddress: "Rua Teste, 123", deliveryCity: "Mateus Leme", deliveryCep: "35670-000", deliveryComplement: null, subtotal: "45.00", discountAmount: "0.00", deliveryFee: "0.00", total: "45.00", couponCode: null, status: "pending", paymentMethod: "pix", paymentStatus: "pending", stripePaymentIntentId: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
  ]),
  getOrdersByUser: vi.fn().mockResolvedValue([]),
  getOrderById: vi.fn().mockResolvedValue(null),
  getOrderItems: vi.fn().mockResolvedValue([]),
  getOrdersByPeriod: vi.fn().mockResolvedValue([]),
  createOrder: vi.fn().mockResolvedValue(42),
  updateOrderStatus: vi.fn().mockResolvedValue(undefined),
  updateOrderPaymentStatus: vi.fn().mockResolvedValue(undefined),
  getAllCoupons: vi.fn().mockResolvedValue([
    { id: 1, code: "BONATTO10", discountType: "percentage", discountValue: "10.00", minOrderValue: "30.00", maxUses: 100, usedCount: 5, active: true, expiresAt: null, createdAt: new Date() },
  ]),
  getCouponByCode: vi.fn().mockResolvedValue({
    id: 1, code: "BONATTO10", discountType: "percentage", discountValue: "10.00", minOrderValue: "30.00", maxUses: 100, usedCount: 5, active: true, expiresAt: null, createdAt: new Date(),
  }),
  createCoupon: vi.fn().mockResolvedValue(undefined),
  updateCoupon: vi.fn().mockResolvedValue(undefined),
  incrementCouponUsage: vi.fn().mockResolvedValue(undefined),
  createTransaction: vi.fn().mockResolvedValue(undefined),
  getTransactionByOrderId: vi.fn().mockResolvedValue(undefined),
  getSalesReport: vi.fn().mockResolvedValue({ totalOrders: 10, totalRevenue: "450.00", avgOrderValue: "45.00" }),
  getTopProducts: vi.fn().mockResolvedValue([
    { productName: "Margherita", totalQuantity: 25, totalRevenue: "1125.00" },
  ]),
  getDailyRevenue: vi.fn().mockResolvedValue([
    { date: "2025-04-15", totalOrders: 5, totalRevenue: "225.00" },
  ]),
  getAllStoreSettings: vi.fn().mockResolvedValue({
    storeOpen: "true",
    storeHours: JSON.stringify({ "0": { open: "00:00", close: "23:59" }, "1": { open: "00:00", close: "23:59" }, "2": { open: "00:00", close: "23:59" }, "3": { open: "00:00", close: "23:59" }, "4": { open: "00:00", close: "23:59" }, "5": { open: "00:00", close: "23:59" }, "6": { open: "00:00", close: "23:59" } }),
    deliveryFee: "0.00",
    deliveryCepPrefixes: JSON.stringify(["35670"]),
    pixKey: "test@test.com",
    whatsappNumber: "5537999999999",
    merchantName: "Bonatto Pizza",
  }),
  getStoreSetting: vi.fn().mockResolvedValue(null),
  setStoreSetting: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn().mockResolvedValue({ id: 1, openId: "user-1", name: "Test User", email: "test@test.com", role: "user", clubStatus: null, clubPlan: null, clubActivatedAt: null, clubExpiresAt: null, clubFreeItemUsed: false, loyaltyPoints: 0, createdAt: new Date(), updatedAt: new Date() }),
  getAllUsers: vi.fn().mockResolvedValue([]),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  getCouponsByUser: vi.fn().mockResolvedValue([]),
  createUserCoupon: vi.fn().mockResolvedValue(undefined),
  getActiveUpsells: vi.fn().mockResolvedValue([]),
  getUpsellsForCart: vi.fn().mockResolvedValue([]),
  createUpsell: vi.fn().mockResolvedValue(undefined),
  updateUpsell: vi.fn().mockResolvedValue(undefined),
  deleteUpsell: vi.fn().mockResolvedValue(undefined),
  getAllUpsells: vi.fn().mockResolvedValue([]),
  getActivePromotions: vi.fn().mockResolvedValue([]),
  getAllPromotions: vi.fn().mockResolvedValue([]),
  createPromotion: vi.fn().mockResolvedValue(undefined),
  updatePromotion: vi.fn().mockResolvedValue(undefined),
  deletePromotion: vi.fn().mockResolvedValue(undefined),
  getActiveRaffles: vi.fn().mockResolvedValue([]),
  getAllRaffles: vi.fn().mockResolvedValue([]),
  createRaffle: vi.fn().mockResolvedValue(undefined),
  updateRaffle: vi.fn().mockResolvedValue(undefined),
  deleteRaffle: vi.fn().mockResolvedValue(undefined),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  createEmailUser: vi.fn().mockResolvedValue(undefined),
  updateUserPasswordHash: vi.fn().mockResolvedValue(undefined),
  saveResetToken: vi.fn().mockResolvedValue(undefined),
  getUserByResetToken: vi.fn().mockResolvedValue(null),
  clearResetToken: vi.fn().mockResolvedValue(undefined),
  addLoyaltyPoints: vi.fn().mockResolvedValue(undefined),
  deductLoyaltyPoints: vi.fn().mockResolvedValue({ ok: true, newBalance: 0 }),
  getUserLoyaltyPoints: vi.fn().mockResolvedValue(0),
  updateUserAvatar: vi.fn().mockResolvedValue(undefined),
  getUserSpendingHistory: vi.fn().mockResolvedValue([]),
  getOrderMessages: vi.fn().mockResolvedValue([]),
  sendOrderMessage: vi.fn().mockResolvedValue(undefined),
  markMessagesRead: vi.fn().mockResolvedValue(undefined),
  getUnreadCountForOrder: vi.fn().mockResolvedValue(0),
  getTotalUnreadForAdmin: vi.fn().mockResolvedValue(0),
  getTotalUnreadForUser: vi.fn().mockResolvedValue(0),
  getTransactionsByUser: vi.fn().mockResolvedValue([]),
  getSalesOverview: vi.fn().mockResolvedValue({}),
  getSalesTimeSeries: vi.fn().mockResolvedValue([]),
  getRecentOrdersFeed: vi.fn().mockResolvedValue([]),
  getAllDeliveryZones: vi.fn().mockResolvedValue([]),
  getDeliveryZoneByNeighborhood: vi.fn().mockResolvedValue(null),
  searchDeliveryZones: vi.fn().mockResolvedValue([]),
  createDeliveryZone: vi.fn().mockResolvedValue(undefined),
  updateDeliveryZone: vi.fn().mockResolvedValue(undefined),
  deleteDeliveryZone: vi.fn().mockResolvedValue(undefined),
  getMenuSlides: vi.fn().mockResolvedValue([]),
  createMenuSlide: vi.fn().mockResolvedValue(undefined),
  updateMenuSlide: vi.fn().mockResolvedValue(undefined),
  deleteMenuSlide: vi.fn().mockResolvedValue(undefined),
  seedMenuSlides: vi.fn().mockResolvedValue(undefined),
  getCarouselImages: vi.fn().mockResolvedValue([]),
  createCarouselImage: vi.fn().mockResolvedValue(undefined),
  updateCarouselImage: vi.fn().mockResolvedValue(undefined),
  deleteCarouselImage: vi.fn().mockResolvedValue(undefined),
  updateStripeCustomerId: vi.fn().mockResolvedValue(undefined),
  getCrmCustomers: vi.fn().mockResolvedValue([]),
  countCrmCustomers: vi.fn().mockResolvedValue(0),
  getCrmCustomerDetail: vi.fn().mockResolvedValue(null),
  getCrmCustomersByTag: vi.fn().mockResolvedValue([]),
  assignTagToCustomer: vi.fn().mockResolvedValue(undefined),
  removeTagFromCustomer: vi.fn().mockResolvedValue(undefined),
  getTagsForCustomer: vi.fn().mockResolvedValue([]),
  getJourneyExecutionsByUser: vi.fn().mockResolvedValue([]),
  getAbandonedCartsByUser: vi.fn().mockResolvedValue([]),
  getCrmStats: vi.fn().mockResolvedValue({}),
  listNotificationTemplates: vi.fn().mockResolvedValue([]),
  createNotificationTemplate: vi.fn().mockResolvedValue(undefined),
  updateNotificationTemplate: vi.fn().mockResolvedValue(undefined),
  deleteNotificationTemplate: vi.fn().mockResolvedValue(undefined),
  pickRandomTemplate: vi.fn().mockResolvedValue(null),
  seedNotificationTemplates: vi.fn().mockResolvedValue(undefined),
  listCustomTags: vi.fn().mockResolvedValue([]),
  createCustomTag: vi.fn().mockResolvedValue(1),
  updateCustomTag: vi.fn().mockResolvedValue(undefined),
  deleteCustomTag: vi.fn().mockResolvedValue(undefined),
  assignCustomTagToCustomer: vi.fn().mockResolvedValue(undefined),
  removeCustomTagFromCustomer: vi.fn().mockResolvedValue(undefined),
  getCustomTagsForCustomer: vi.fn().mockResolvedValue([]),
  getCustomersByCustomTagName: vi.fn().mockResolvedValue([]),
  createScheduledNotification: vi.fn().mockResolvedValue(1),
  listScheduledNotifications: vi.fn().mockResolvedValue([]),
  cancelScheduledNotification: vi.fn().mockResolvedValue(undefined),
  deleteScheduledNotification: vi.fn().mockResolvedValue(undefined),
  getPendingScheduledNotifications: vi.fn().mockResolvedValue([]),
  markScheduledNotificationSent: vi.fn().mockResolvedValue(undefined),
  sendUserNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helper: create context ───────────────────────────────────────────────────
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "user-1", email: "user@test.com", name: "Test User",
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 2, openId: "admin-1", email: "admin@test.com", name: "Admin User",
      loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("categories", () => {
  it("list returns active categories", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.categories.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Pizzas");
  });
});

describe("products", () => {
  it("list returns products", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.products.list({});
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Margherita");
  });

  it("admin can create product", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    // createProduct returns void (no id returned from mutation)
    await expect(caller.products.create({
      categoryId: 1,
      name: "Nova Pizza",
      description: "Descrição",
      price: "50.00",
      featured: false,
    })).resolves.not.toThrow();
  });

  it("non-admin cannot create product", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.products.create({
      categoryId: 1,
      name: "Nova Pizza",
      description: "Descrição",
      price: "50.00",
      featured: false,
    })).rejects.toThrow();
  });
});

describe("orders", () => {
  it("creates order successfully", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.orders.create({
      customerName: "Maria Santos",
      customerEmail: "maria@test.com",
      customerPhone: "(37) 99999-0002",
      deliveryAddress: "Av Principal, 456",
      deliveryCity: "Mateus Leme",
      deliveryCep: "35670-000",
      deliveryComplement: "",
      notes: "",
      paymentMethod: "pix",
      items: [
        { productId: 1, productName: "Margherita", productPrice: "45.00", quantity: 1 },
      ],
    });
    expect(result.orderId).toBe(42);
  });

  it("admin can list all orders", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.orders.list({});
    expect(result).toHaveLength(1);
    expect(result[0].customerName).toBe("João Silva");
  });

  it("non-admin cannot list all orders", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.orders.list({})).rejects.toThrow();
  });

  it("authenticated user can see own orders", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.orders.myOrders();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("coupons", () => {
  it("validates valid coupon", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.coupons.validate({ code: "BONATTO10", orderTotal: 50 });
    expect(result.discount).toBe(5); // 10% of 50
    expect(result.valid).toBe(true);
  });

  it("admin can list coupons", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.coupons.list();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("BONATTO10");
  });
});

describe("reports", () => {
  it("admin can view sales report", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.sales({ startDate: new Date("2025-01-01"), endDate: new Date() });
    expect(result.totalOrders).toBe(10);
  });

  it("admin can view top products", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.topProducts({ limit: 10 });
    expect(result[0].productName).toBe("Margherita");
  });

  it("non-admin cannot view reports", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.reports.sales({ startDate: new Date("2025-01-01"), endDate: new Date() })).rejects.toThrow();
  });
});

describe("auth.logout", () => {
  it("clears session cookie", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
