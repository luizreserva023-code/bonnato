import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCheckoutIdempotencyKey, getCheckoutIdempotencyKey } from "./order-idempotency";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

describe("checkout idempotency key", () => {
  const originalSessionStorage = globalThis.sessionStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: originalSessionStorage,
    });
  });

  it("reutiliza a mesma chave para a mesma compra na mesma loja", () => {
    const first = getCheckoutIdempotencyKey(1, "fingerprint-a");
    const second = getCheckoutIdempotencyKey(1, "fingerprint-a");
    expect(second).toBe(first);
  });

  it("gera uma nova chave quando o conteúdo da compra muda", () => {
    const first = getCheckoutIdempotencyKey(1, "fingerprint-a");
    const second = getCheckoutIdempotencyKey(1, "fingerprint-b");
    expect(second).not.toBe(first);
  });

  it("isola a chave por unidade", () => {
    const mateusLeme = getCheckoutIdempotencyKey(1, "same-order");
    const itauna = getCheckoutIdempotencyKey(2, "same-order");
    expect(itauna).not.toBe(mateusLeme);
  });

  it("clear encerra a tentativa e força uma nova chave", () => {
    const first = getCheckoutIdempotencyKey(1, "fingerprint-a");
    clearCheckoutIdempotencyKey(1);
    const second = getCheckoutIdempotencyKey(1, "fingerprint-a");
    expect(second).not.toBe(first);
  });
});
