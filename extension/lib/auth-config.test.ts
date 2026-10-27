import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPublicAuthKey, normalizePublishableKey, savePublicAuthKey } from "./auth-config";

const fixture = () => `pk_test_${btoa("fixture.clerk.accounts.dev$")}`;
afterEach(() => vi.unstubAllGlobals());
describe("local public sign-in configuration", () => {
  it("validates the public parameter without accepting server secrets", () => {
    expect(normalizePublishableKey(` ${fixture()} `)).toBe(fixture());
    expect(normalizePublishableKey("server-secret")).toBeNull();
    expect(normalizePublishableKey("pk_test_invalid")).toBeNull();
    expect(normalizePublishableKey(`pk_test_${btoa("https://example.com/$")}`)).toBeNull();
  });
  it("stores only a validated public parameter in local, not synced, storage", async () => {
    const values: Record<string, unknown> = {};
    const set = vi.fn(async (data) => Object.assign(values, data));
    vi.stubGlobal("chrome", { storage: { local: {
      get: async () => values, set,
    } } });
    await expect(loadPublicAuthKey()).resolves.toBeNull();
    await savePublicAuthKey(fixture());
    await expect(loadPublicAuthKey()).resolves.toBe(fixture());
    await expect(savePublicAuthKey("server-secret")).rejects.toThrow();
    expect(set).toHaveBeenCalledOnce();
  });
});
