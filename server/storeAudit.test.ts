import { describe, expect, it } from "vitest";

import { sanitizeAuditValue } from "./storeAudit.ts";

describe("audit log sanitization", () => {
  it("redacts sensitive values recursively without removing useful context", () => {
    const sanitized = sanitizeAuditValue({
      status: "confirmed",
      password: "super-secret",
      nested: {
        apiKey: "key-value",
        token: "token-value",
        reason: "Atualização operacional",
      },
      items: [
        { id: 1, authorization: "Bearer hidden", name: "Pizza" },
      ],
    });

    expect(sanitized).toEqual({
      status: "confirmed",
      password: "[redacted]",
      nested: {
        apiKey: "[redacted]",
        token: "[redacted]",
        reason: "Atualização operacional",
      },
      items: [
        {
          id: 1,
          authorization: "[redacted]",
          name: "Pizza",
        },
      ],
    });
  });

  it("redacts common credential key variants", () => {
    expect(sanitizeAuditValue({
      "api-key": "a",
      api_key: "b",
      secretValue: "c",
      credential: "d",
      cookie: "e",
      normal: "visible",
    })).toEqual({
      "api-key": "[redacted]",
      api_key: "[redacted]",
      secretValue: "[redacted]",
      credential: "[redacted]",
      cookie: "[redacted]",
      normal: "visible",
    });
  });

  it("limits excessively deep audit payloads", () => {
    const sanitized = sanitizeAuditValue({
      a: { b: { c: { d: { e: { f: "hidden depth" } } } } },
    });
    expect(JSON.stringify(sanitized)).toContain("[truncated]");
  });
});
