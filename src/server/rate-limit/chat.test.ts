import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db";
import {
  consumeChatRateLimit,
  DEFAULT_CHAT_RATE_LIMIT,
  getRateLimitWindowStart,
  resolveChatRateLimit,
} from "./chat";

vi.mock("@/server/db", () => ({ getDb: vi.fn() }));

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

  it("serializes the conflict window as a PostgreSQL timestamp parameter", async () => {
    let requestCountExpression: SQL | undefined;
    vi.mocked(getDb).mockReturnValue({
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: ({ set }: { set: { requestCount: SQL } }) => {
            requestCountExpression = set.requestCount;
            return { returning: async () => [{ requestCount: 1 }] };
          },
        }),
      }),
    } as never);

    await consumeChatRateLimit(
      { workspaceId: "workspace-id", userId: "user-id" } as never,
      Date.parse("2026-08-26T10:42:59.999Z"),
    );

    const query = new PgDialect().sqlToQuery(requestCountExpression!);
    expect(query.params).toEqual(["2026-08-26T10:42:00.000Z"]);
  });
});
