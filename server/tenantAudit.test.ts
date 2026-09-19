import { describe, expect, it } from "vitest";

import { sanitizeAuditValue } from "./tenantAudit";

describe("tenant audit metadata", () => {
  it("redacts credentials recursively", () => {
    expect(sanitizeAuditValue({
      action: "provider.connected",
      apiKey: "secret-value",
      nested: { authorization: "Bearer token", safe: "mercado-pago" },
    })).toEqual({
      action: "provider.connected",
      apiKey: "[redacted]",
      nested: { authorization: "[redacted]", safe: "mercado-pago" },
    });
  });

  it("limits deeply nested payloads", () => {
    const value = sanitizeAuditValue({ a: { b: { c: { d: { e: { f: "hidden" } } } } } });
    expect(JSON.stringify(value)).toContain("[truncated]");
  });
});
