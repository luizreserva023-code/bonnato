import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  results: [[{ storeId: 7 }], []] as Array<Array<Record<string, unknown>>>,
  queryIndex: 0,
}));

vi.mock("./db.ts", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => {
          const rows = mocks.results[mocks.queryIndex++] ?? [];
          return Object.assign(Promise.resolve(rows), {
            limit: async () => rows,
          });
        },
      }),
    }),
  })),
}));

import { assertStoreEntityAccess } from "./storeUtils.ts";

describe("tenant store isolation", () => {
  beforeEach(() => {
    mocks.results = [[{ storeId: 7 }], []];
    mocks.queryIndex = 0;
  });

  it("allows a manager to access records from their own store", async () => {
    await expect(assertStoreEntityAccess({ id: 10, role: "manager" }, 7)).resolves.toBe(7);
  });

  it("blocks a manager from accessing another store", async () => {
    await expect(assertStoreEntityAccess({ id: 10, role: "manager" }, 8)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a tenant manager to access every unit in their brand", async () => {
    mocks.results = [
      [],
      [{ tenantKey: "pizza-joao" }],
      [{ storeId: 7 }, { storeId: 8 }],
    ];

    await expect(assertStoreEntityAccess({ id: 10, role: "manager" }, 8)).resolves.toBe(8);
  });

  it("allows an admin to operate globally", async () => {
    await expect(assertStoreEntityAccess({ id: 1, role: "admin" }, 8)).resolves.toBeUndefined();
  });

  it("keeps an admin inside an explicitly selected store", async () => {
    await expect(assertStoreEntityAccess({ id: 1, role: "admin" }, 8, 7)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
