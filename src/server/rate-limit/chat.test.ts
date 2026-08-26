import { describe, expect, it } from "vitest";
import { DEFAULT_CHAT_RATE_LIMIT, getRateLimitWindowStart, resolveChatRateLimit } from "./chat";

describe("chat rate limit configuration", () => {
  it("uses a stable minute window", () => {
    expect(getRateLimitWindowStart(Date.parse("2026-08-26T10:42:59.999Z")).toISOString()).toBe("2026-08-26T10:42:00.000Z");
  });

  it("falls back and clamps unsafe limits", () => {
    expect(resolveChatRateLimit()).toBe(DEFAULT_CHAT_RATE_LIMIT);
    expect(resolveChatRateLimit("invalid")).toBe(DEFAULT_CHAT_RATE_LIMIT);
    expect(resolveChatRateLimit("0")).toBe(1);
    expect(resolveChatRateLimit("9999")).toBe(300);
  });
});
