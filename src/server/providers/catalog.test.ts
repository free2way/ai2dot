import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafeProviderBaseUrl,
  isDesktopReachableAddress,
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

  it("normalizes ZenMux display and capability fields", () => {
    const result = parseProviderCatalog({
      data: [
        {
          id: "anthropic/claude-sonnet",
          display_name: "Anthropic: Claude Sonnet",
          context_length: 200000,
          input_modalities: ["text", "image", "file"],
          capabilities: { reasoning: true },
        },
      ],
    });

    expect(result[0]).toMatchObject({
      name: "Anthropic: Claude Sonnet",
      contextWindow: 200000,
      capabilities: ["text", "image", "files", "reasoning"],
    });
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

describe("desktop provider URL policy", () => {
  const previousDesktop = process.env.AI2DOT_DESKTOP;

  afterEach(() => {
    if (previousDesktop === undefined) delete process.env.AI2DOT_DESKTOP;
    else process.env.AI2DOT_DESKTOP = previousDesktop;
  });

  it("allows HTTP loopback and LAN providers in desktop mode", async () => {
    process.env.AI2DOT_DESKTOP = "1";
    await expect(
      assertSafeProviderBaseUrl("http://127.0.0.1:11434/v1"),
    ).resolves.toBeUndefined();
    await expect(
      assertSafeProviderBaseUrl("http://192.168.1.20:1234/v1"),
    ).resolves.toBeUndefined();
    await expect(
      assertSafeProviderBaseUrl("http://localhost:8080/v1"),
    ).resolves.toBeUndefined();
  });

  it("still blocks metadata and multicast addresses in desktop mode", async () => {
    process.env.AI2DOT_DESKTOP = "1";
    await expect(
      assertSafeProviderBaseUrl("http://169.254.169.254/latest"),
    ).rejects.toThrow("Private");
    await expect(
      assertSafeProviderBaseUrl("http://239.0.0.1/v1"),
    ).rejects.toThrow("Private");
    expect(isDesktopReachableAddress("10.0.0.5")).toBe(true);
    expect(isDesktopReachableAddress("169.254.1.1")).toBe(false);
  });
});
