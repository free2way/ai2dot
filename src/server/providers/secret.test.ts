import { afterEach, describe, expect, it } from "vitest";
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from "@/server/providers/secret";

const previousKey = process.env.PROVIDER_SECRET_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) {
    delete process.env.PROVIDER_SECRET_ENCRYPTION_KEY;
  } else {
    process.env.PROVIDER_SECRET_ENCRYPTION_KEY = previousKey;
  }
});

describe("provider secret encryption", () => {
  it("round-trips a secret without storing plaintext", async () => {
    process.env.PROVIDER_SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = await encryptProviderSecret("sk-sensitive-value");

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain("sk-sensitive-value");
    await expect(decryptProviderSecret(encrypted)).resolves.toBe("sk-sensitive-value");
  });

  it("requires a 32-byte key", async () => {
    process.env.PROVIDER_SECRET_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    await expect(encryptProviderSecret("secret")).rejects.toThrow("32 bytes");
  });
});
