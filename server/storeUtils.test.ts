import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [{ storeId: 7 }],
}));

vi.mock("./db.ts", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mocks.rows,
        }),
      }),
    }),
  })),
}));

import { assertStoreEntityAccess } from "./storeUtils.ts";

describe("tenant store isolation", () => {
  beforeEach(() => {
    mocks.rows = [{ storeId: 7 }];
  });

  it("allows a manager to access records from their own store", async () => {
    await expect(assertStoreEntityAccess({ id: 10, role: "manager" }, 7)).resolves.toBe(7);
  });

  it("blocks a manager from accessing another store", async () => {
    await expect(assertStoreEntityAccess({ id: 10, role: "manager" }, 8)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
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
