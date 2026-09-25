import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = Array<Record<string, unknown>>;

const mocks = vi.hoisted(() => ({
  results: [] as QueryResult[],
  queryIndex: 0,
}));

function nextRows() {
  return mocks.results[mocks.queryIndex++] ?? [];
}

vi.mock("./db.ts", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => {
        const chain: any = {
          innerJoin: () => chain,
          where: () => {
            const rows = nextRows();
            return Object.assign(Promise.resolve(rows), {
              limit: async () => rows,
            });
          },
        };
        return chain;
      },
    }),
  })),
}));

import { assertStoreEntityAccess, resolveStoreId } from "./storeUtils.ts";

describe("store isolation", () => {
  beforeEach(() => {
    mocks.results = [];
    mocks.queryIndex = 0;
  });

  it("allows a manager to access an assigned store", async () => {
    mocks.results = [[{ storeId: 7 }]];
    await expect(assertStoreEntityAccess({ id: 10, role: "manager" }, 7)).resolves.toBe(7);
  });

  it("blocks a manager from another store", async () => {
    mocks.results = [[{ storeId: 7 }]];
    await expect(assertStoreEntityAccess({ id: 10, role: "manager" }, 8)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a manager to access multiple explicitly assigned stores", async () => {
    mocks.results = [[{ storeId: 7 }, { storeId: 8 }]];
    await expect(assertStoreEntityAccess({ id: 10, role: "manager" }, 8)).resolves.toBe(8);
  });

  it("lets an admin aggregate all stores when no store is selected", async () => {
    await expect(resolveStoreId({ id: 1, role: "admin" })).resolves.toBeUndefined();
  });

  it("keeps admin access scoped to the selected entity store", async () => {
    mocks.results = [[{ id: 8 }]];
    await expect(assertStoreEntityAccess({ id: 1, role: "admin" }, 8)).resolves.toBe(8);
  });

  it("rejects an admin request when the selected store differs from the entity store", async () => {
    mocks.results = [[{ id: 7 }]];
    await expect(assertStoreEntityAccess({ id: 1, role: "admin" }, 8, 7)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
