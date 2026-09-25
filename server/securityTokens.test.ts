import { describe, expect, it } from "vitest";

import { hashRecoveryToken } from "./securityTokens.ts";

describe("recovery token hashing", () => {
  it("stores a deterministic digest instead of the raw recovery token", () => {
    const raw = "reset-secret-token";
    const hashed = hashRecoveryToken(raw);
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toBe(raw);
    expect(hashRecoveryToken(raw)).toBe(hashed);
  });
});
