import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSafeProviderBaseUrl,
  fetchProviderCatalog,
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

describe("provider catalog redirects", () => {
  afterEach(() => vi.unstubAllGlobals());

  function mockRedirects(locations: string[]) {
    const requests: { url: string; authorization: string | null }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      requests.push({ url, authorization: headers.get("authorization") });
      const location = locations[requests.length - 1];
      return location
        ? new Response(null, { status: 302, headers: { location } })
        : Response.json({ data: [] });
    }));
    return requests;
  }

  const provider = {
    type: "openai_compatible" as const,
    baseUrl: "https://1.1.1.1/v1",
    secret: "test-provider-key",
  };

  it("keeps credentials for a relative redirect on the same origin", async () => {
    const requests = mockRedirects(["/v2/models"]);
    await expect(fetchProviderCatalog(provider)).resolves.toEqual([]);
    expect(requests.map((request) => request.authorization)).toEqual([
      "Bearer test-provider-key", "Bearer test-provider-key",
    ]);
  });

  it.each(["https://8.8.8.8/models", "https://1.1.1.1:8443/models"])(
    "drops credentials when redirecting to %s, including a redirect back",
    async (location) => {
      const requests = mockRedirects([location, "/redirect", "https://1.1.1.1/models"]);
      await fetchProviderCatalog(provider);
      expect(requests.map((request) => request.authorization)).toEqual([
        "Bearer test-provider-key", null, null, null,
      ]);
    },
  );

  it("rejects redirects to private addresses before making another request", async () => {
    const requests = mockRedirects(["https://127.0.0.1/models"]);
    await expect(fetchProviderCatalog(provider)).rejects.toThrow("Private");
    expect(requests).toHaveLength(1);
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
