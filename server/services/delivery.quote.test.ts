import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  results: [] as Array<Array<Record<string, any>>>,
  index: 0,
}));

function nextResult() {
  return mocks.results[mocks.index++] ?? [];
}

vi.mock("../db.ts", () => ({
  getDb: vi.fn(async () => ({
    select: () => {
      let consumed = false;
      let rows: Array<Record<string, any>> = [];
      const consume = () => {
        if (!consumed) {
          rows = nextResult();
          consumed = true;
        }
        return rows;
      };
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: async () => consume(),
        orderBy: async () => consume(),
      };
      return chain;
    },
    insert: () => {
      throw new Error("unexpected cache insert in cached-path test");
    },
  })),
}));

import { quoteDelivery } from "./delivery.ts";

const settings = {
  storeId: 1,
  deliveryEnabled: true,
  maxDeliveryDistanceMeters: 5000,
  latitude: "-20.0000000",
  longitude: "-44.0000000",
};

const cachedGeocode = {
  latitude: "-20.0100000",
  longitude: "-44.0100000",
  confidence: "0.9900",
  provider: "nominatim",
};

const cachedRoute = {
  routeDistanceMeters: 1200,
  straightLineDistanceMeters: 1100,
  provider: "osrm",
};

const activeZone = {
  id: 7,
  storeId: 1,
  minDistanceMeters: 1000,
  maxDistanceMeters: 2000,
  deliveryFeeCents: 690,
  estimatedMinutes: 30,
  sortOrder: 1,
  active: true,
};

const address = {
  postalCode: "35680000",
  street: "Rua Teste",
  number: "123",
  neighborhood: "Centro",
  city: "Itaúna",
  state: "MG",
};

describe("delivery quote server authority/cache", () => {
  beforeEach(() => {
    mocks.results = [];
    mocks.index = 0;
    vi.unstubAllGlobals();
    delete process.env.DELIVERY_ALLOW_STRAIGHT_LINE_FALLBACK;
  });

  it("usa geocodificação e rota em cache sem chamar provider externo", async () => {
    mocks.results = [[settings], [cachedGeocode], [cachedRoute], [activeZone]];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const quote = await quoteDelivery({ storeId: 1, address });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(quote).toMatchObject({
      available: true,
      storeId: 1,
      zoneId: 7,
      distanceMeters: 1200,
      deliveryFeeCents: 690,
      deliveryFee: 6.9,
      estimatedMinutes: 30,
      routingProvider: "osrm",
      usedStraightLineFallback: false,
    });
  });

  it("não recebe nem confia em taxa vinda do frontend; deriva a taxa da faixa do servidor", async () => {
    mocks.results = [[settings], [cachedGeocode], [cachedRoute], [{ ...activeZone, deliveryFeeCents: 890 }]];
    vi.stubGlobal("fetch", vi.fn());

    const quote = await quoteDelivery({ storeId: 1, address });

    expect(quote.available).toBe(true);
    if (!quote.available) throw new Error("quote should be available");
    expect(quote.deliveryFeeCents).toBe(890);
    expect(quote.deliveryFee).toBe(8.9);
  });

  it("retorna NO_DELIVERY_ZONES quando a unidade não tem faixa", async () => {
    mocks.results = [[settings], [cachedGeocode], [cachedRoute], []];
    vi.stubGlobal("fetch", vi.fn());

    await expect(quoteDelivery({ storeId: 1, address })).resolves.toMatchObject({
      available: false,
      reason: "NO_DELIVERY_ZONES",
    });
  });

  it("retorna OUTSIDE_DELIVERY_AREA no primeiro metro além do raio máximo", async () => {
    mocks.results = [
      [{ ...settings, maxDeliveryDistanceMeters: 1199 }],
      [cachedGeocode],
      [cachedRoute],
    ];
    vi.stubGlobal("fetch", vi.fn());

    await expect(quoteDelivery({ storeId: 1, address })).resolves.toMatchObject({
      available: false,
      reason: "OUTSIDE_DELIVERY_AREA",
      distanceMeters: 1200,
    });
  });

  it("bloqueia quando provider de rota falha e fallback não foi habilitado", async () => {
    mocks.results = [[settings], [cachedGeocode], []];
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider offline")));

    await expect(quoteDelivery({ storeId: 1, address })).resolves.toMatchObject({
      available: false,
      reason: "ROUTING_PROVIDER_UNAVAILABLE",
      routeDistanceMeters: null,
    });
  });

  it("configuração de uma unidade não vaza para outra", async () => {
    mocks.results = [
      [{ ...settings, storeId: 2 }],
      [cachedGeocode],
      [{ ...cachedRoute, routeDistanceMeters: 800 }],
      [{ ...activeZone, id: 22, storeId: 2, minDistanceMeters: 0, maxDistanceMeters: 1000, deliveryFeeCents: 490 }],
    ];
    vi.stubGlobal("fetch", vi.fn());

    const quote = await quoteDelivery({ storeId: 2, address });

    expect(quote).toMatchObject({
      available: true,
      storeId: 2,
      zoneId: 22,
      deliveryFeeCents: 490,
    });
  });
});
