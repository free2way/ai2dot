import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import {
  deriveProviderHealth,
  type WorkspaceOperationsOverview,
} from "@/lib/operations";
import { getDb } from "@/server/db";
import {
  generations,
  models,
  providerConnections,
  usageEvents,
} from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";
import { resolveChatRateLimit } from "@/server/rate-limit/chat";

const USAGE_PERIOD_DAYS = 30;
const HEALTH_PERIOD_HOURS = 24;

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getWorkspaceOperations(
  context: WorkspaceContext,
): Promise<WorkspaceOperationsOverview> {
  const db = getDb();
  const now = Date.now();
  const usageSince = new Date(now - USAGE_PERIOD_DAYS * 24 * 60 * 60 * 1_000);
  const healthSince = new Date(now - HEALTH_PERIOD_HOURS * 60 * 60 * 1_000);

  const [generationRows, usageRows, providerRows] = await Promise.all([
    db
      .select({
        requestCount: sql<number>`count(${generations.id}) filter (where ${generations.status} in ('completed', 'failed'))::int`,
        completedCount: sql<number>`count(${generations.id}) filter (where ${generations.status} = 'completed')::int`,
        failedCount: sql<number>`count(${generations.id}) filter (where ${generations.status} = 'failed')::int`,
        averageLatencyMs: sql<number>`coalesce(avg(${generations.latencyMs}) filter (where ${generations.status} = 'completed'), 0)::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.workspaceId, context.workspaceId),
          gte(generations.createdAt, usageSince),
        ),
      ),
    db
      .select({
        inputTokens: sql<number>`coalesce(sum(${usageEvents.inputTokens}), 0)::bigint`,
        outputTokens: sql<number>`coalesce(sum(${usageEvents.outputTokens}), 0)::bigint`,
        estimatedCostUsd: sql<string>`coalesce(sum(${usageEvents.costUsd}), 0)`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.workspaceId, context.workspaceId),
          gte(usageEvents.createdAt, usageSince),
        ),
      ),
    db
      .select({
        connectionId: providerConnections.id,
        enabled: providerConnections.enabled,
        lastSyncedAt: providerConnections.lastSyncedAt,
        requestCount: sql<number>`count(${generations.id}) filter (where ${generations.status} in ('completed', 'failed'))::int`,
        failedCount: sql<number>`count(${generations.id}) filter (where ${generations.status} = 'failed')::int`,
        averageLatencyMs: sql<number>`coalesce(avg(${generations.latencyMs}) filter (where ${generations.status} = 'completed'), 0)::int`,
        lastRequestAt: sql<Date | null>`max(${generations.createdAt})`,
      })
      .from(providerConnections)
      .leftJoin(models, eq(models.connectionId, providerConnections.id))
      .leftJoin(
        generations,
        and(
          eq(generations.modelId, models.id),
          gte(generations.createdAt, healthSince),
        ),
      )
      .where(eq(providerConnections.workspaceId, context.workspaceId))
      .groupBy(
        providerConnections.id,
        providerConnections.enabled,
        providerConnections.lastSyncedAt,
      ),
  ]);

  const generationTotals = generationRows[0];
  const usageTotals = usageRows[0];
  const requestCount = asNumber(generationTotals?.requestCount);
  const completedCount = asNumber(generationTotals?.completedCount);
  const failedCount = asNumber(generationTotals?.failedCount);

  return {
    periodDays: USAGE_PERIOD_DAYS,
    requestCount,
    completedCount,
    failedCount,
    successRate:
      completedCount + failedCount > 0
        ? Number(((completedCount / (completedCount + failedCount)) * 100).toFixed(1))
        : 100,
    inputTokens: asNumber(usageTotals?.inputTokens),
    outputTokens: asNumber(usageTotals?.outputTokens),
    estimatedCostUsd: Number(asNumber(usageTotals?.estimatedCostUsd).toFixed(6)),
    averageLatencyMs: asNumber(generationTotals?.averageLatencyMs),
    rateLimitPerMinute: resolveChatRateLimit(),
    providers: providerRows.map((provider) => {
      const providerRequestCount = asNumber(provider.requestCount);
      const providerFailedCount = asNumber(provider.failedCount);
      return {
        connectionId: provider.connectionId,
        status: deriveProviderHealth({
          enabled: provider.enabled,
          requestCount: providerRequestCount,
          failedCount: providerFailedCount,
          lastSyncedAt: provider.lastSyncedAt,
        }),
        requestCount: providerRequestCount,
        failedCount: providerFailedCount,
        successRate:
          providerRequestCount > 0
            ? Number((((providerRequestCount - providerFailedCount) / providerRequestCount) * 100).toFixed(1))
            : 100,
        averageLatencyMs: asNumber(provider.averageLatencyMs),
        lastRequestAt: provider.lastRequestAt
          ? new Date(provider.lastRequestAt).toISOString()
          : null,
      };
    }),
  };
}
