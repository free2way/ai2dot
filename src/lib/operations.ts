export type ProviderHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "ready"
  | "unknown"
  | "disabled";

export type ProviderHealthSummary = {
  connectionId: string;
  status: ProviderHealthStatus;
  requestCount: number;
  failedCount: number;
  successRate: number;
  averageLatencyMs: number;
  lastRequestAt: string | null;
};

export type WorkspaceOperationsOverview = {
  periodDays: number;
  requestCount: number;
  completedCount: number;
  failedCount: number;
  successRate: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  averageLatencyMs: number;
  rateLimitPerMinute: number;
  providers: ProviderHealthSummary[];
};

export const EMPTY_OPERATIONS_OVERVIEW: WorkspaceOperationsOverview = {
  periodDays: 30,
  requestCount: 0,
  completedCount: 0,
  failedCount: 0,
  successRate: 100,
  inputTokens: 0,
  outputTokens: 0,
  estimatedCostUsd: 0,
  averageLatencyMs: 0,
  rateLimitPerMinute: 30,
  providers: [],
};

export function deriveProviderHealth(input: {
  enabled: boolean;
  requestCount: number;
  failedCount: number;
  lastSyncedAt?: Date | string | null;
}): ProviderHealthStatus {
  if (!input.enabled) return "disabled";
  if (input.requestCount === 0) return input.lastSyncedAt ? "ready" : "unknown";

  const failureRate = input.failedCount / input.requestCount;
  if (failureRate >= 0.25) return "unavailable";
  if (failureRate >= 0.05) return "degraded";
  return "healthy";
}

function readPrice(
  pricing: Record<string, string> | null | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = Number(pricing?.[key]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return 0;
}

export function estimateUsageCostUsd(
  pricing: Record<string, string> | null | undefined,
  inputTokens: number,
  outputTokens: number,
) {
  const inputPrice = readPrice(pricing, ["input", "prompt"]);
  const outputPrice = readPrice(pricing, ["output", "completion"]);
  return Number(
    (Math.max(0, inputTokens) * inputPrice + Math.max(0, outputTokens) * outputPrice).toFixed(8),
  );
}
