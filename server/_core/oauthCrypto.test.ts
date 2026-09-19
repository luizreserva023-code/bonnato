import { describe, expect, it } from "vitest";
import { decryptOAuthToken, encryptOAuthToken } from "./oauthCrypto.ts";

describe("OAuth token encryption", () => {
  const secret = "test-secret-with-at-least-thirty-two-characters";

  it("encrypts and decrypts without exposing the token", () => {
    const token = "provider-access-token";
    const encrypted = encryptOAuthToken(token, secret);

    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain(token);
    expect(decryptOAuthToken(encrypted, secret)).toBe(token);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptOAuthToken("sensitive", secret)!;
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("a") ? "b" : "a"}`;

    expect(() => decryptOAuthToken(tampered, secret)).toThrow();
  });

  it("does not create ciphertext without a secret", () => {
    expect(() => encryptOAuthToken("sensitive", "")).toThrow("OAUTH_ENCRYPTION_KEY");
  });
});
