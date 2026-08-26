import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { chatRateLimits } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";

const WINDOW_MS = 60_000;
export const DEFAULT_CHAT_RATE_LIMIT = 30;

export function resolveChatRateLimit(
  value = process.env.AI2DOT_CHAT_RATE_LIMIT_PER_MINUTE,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_CHAT_RATE_LIMIT;
  return Math.min(Math.max(parsed, 1), 300);
}

export function getRateLimitWindowStart(now = Date.now()) {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
}

export async function consumeChatRateLimit(
  context: WorkspaceContext,
  now = Date.now(),
) {
  const limit = resolveChatRateLimit();
  const windowStart = getRateLimitWindowStart(now);
  const [bucket] = await getDb()
    .insert(chatRateLimits)
    .values({
      workspaceId: context.workspaceId,
      userId: context.userId,
      windowStart,
      requestCount: 1,
    })
    .onConflictDoUpdate({
      target: [chatRateLimits.workspaceId, chatRateLimits.userId],
      set: {
        windowStart,
        requestCount: sql`case when ${chatRateLimits.windowStart} = ${windowStart} then ${chatRateLimits.requestCount} + 1 else 1 end`,
        updatedAt: new Date(now),
      },
    })
    .returning({ requestCount: chatRateLimits.requestCount });

  const requestCount = bucket?.requestCount ?? limit + 1;
  const resetAt = windowStart.getTime() + WINDOW_MS;
  return {
    allowed: requestCount <= limit,
    limit,
    remaining: Math.max(0, limit - requestCount),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1_000)),
  };
}
