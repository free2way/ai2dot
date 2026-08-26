import { describe, expect, it } from "vitest";
import { deriveProviderHealth, estimateUsageCostUsd } from "./operations";

describe("deriveProviderHealth", () => {
  it("distinguishes ready, healthy, degraded, and unavailable providers", () => {
    expect(deriveProviderHealth({ enabled: true, requestCount: 0, failedCount: 0, lastSyncedAt: new Date() })).toBe("ready");
    expect(deriveProviderHealth({ enabled: true, requestCount: 100, failedCount: 4 })).toBe("healthy");
    expect(deriveProviderHealth({ enabled: true, requestCount: 20, failedCount: 2 })).toBe("degraded");
    expect(deriveProviderHealth({ enabled: true, requestCount: 8, failedCount: 2 })).toBe("unavailable");
    expect(deriveProviderHealth({ enabled: false, requestCount: 100, failedCount: 0 })).toBe("disabled");
  });
});

describe("estimateUsageCostUsd", () => {
  it("supports Gateway and OpenRouter pricing keys", () => {
    expect(
      estimateUsageCostUsd(
        { input: "0.000001", output: "0.000003" },
        1_000,
        500,
      ),
    ).toBe(0.0025);
    expect(
      estimateUsageCostUsd(
        { prompt: "0.000002", completion: "0.000004" },
        100,
        50,
      ),
    ).toBe(0.0004);
  });

  it("returns zero when pricing is unavailable", () => {
    expect(estimateUsageCostUsd(undefined, 1_000, 1_000)).toBe(0);
  });
});
