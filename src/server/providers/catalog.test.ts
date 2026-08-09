import { describe, expect, it } from "vitest";
import {
  assertSafeProviderBaseUrl,
  isPrivateNetworkAddress,
  parseProviderCatalog,
} from "@/server/providers/catalog";

describe("parseProviderCatalog", () => {
  it("normalizes OpenAI-compatible model catalogs", () => {
    const result = parseProviderCatalog({
      data: [
        {
          id: "acme/vision-pro",
          context_window: 128000,
          architecture: { input_modalities: ["text", "image", "pdf"] },
          pricing: { input: 0.000001, output: "0.000004" },
        },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "acme/vision-pro",
        name: "Vision Pro",
        contextWindow: 128000,
        capabilities: ["text", "image", "files"],
        pricing: { input: "0.000001", output: "0.000004" },
      }),
    ]);
  });

  it("rejects malformed catalogs", () => {
    expect(() => parseProviderCatalog({ models: [] })).toThrow();
  });

  it("reads OpenRouter context_length fields", () => {
    const result = parseProviderCatalog({
      data: [{ id: "anthropic/claude", context_length: 200000 }],
    });

    expect(result[0]?.contextWindow).toBe(200000);
  });
});

describe("provider URL safety", () => {
  it.each(["127.0.0.1", "10.0.0.8", "172.20.1.2", "192.168.1.10", "::1", "fd00::1"])(
    "blocks private address %s",
    (address) => {
      expect(isPrivateNetworkAddress(address)).toBe(true);
    },
  );

  it("blocks non-HTTPS and localhost provider URLs", async () => {
    await expect(assertSafeProviderBaseUrl("http://api.example.com/v1")).rejects.toThrow("HTTPS");
    await expect(assertSafeProviderBaseUrl("https://localhost:11434/v1")).rejects.toThrow("Private");
  });
});
