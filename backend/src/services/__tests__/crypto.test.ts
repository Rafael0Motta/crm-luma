import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "../crypto";

describe("crypto", () => {
  it("encrypts and decrypts a secret round-trip", () => {
    const original = "sk-super-secret-api-key-123456";
    const encrypted = encryptSecret(original);

    expect(encrypted).not.toBe(original);
    expect(decryptSecret(encrypted)).toBe(original);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
  });

  it("rejects a tampered payload", () => {
    const encrypted = encryptSecret("valid-secret");
    const tampered = encrypted.slice(0, -2) + "00";
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("masks a secret keeping only the edges visible", () => {
    const masked = maskSecret("sk-1234567890abcdef");
    expect(masked.startsWith("sk-1")).toBe(true);
    expect(masked.endsWith("cdef")).toBe(true);
    expect(masked).toContain("*");
  });

  it("fully masks very short secrets", () => {
    expect(maskSecret("abc")).toBe("****");
  });
});
