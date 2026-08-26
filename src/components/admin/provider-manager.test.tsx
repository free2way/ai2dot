// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { ProviderManager } from "./provider-manager";

describe("ProviderManager operations overview", () => {
  it("renders workspace usage and provider health", () => {
    render(
      <ProviderManager
        infrastructureReady
        configuration={{ authReady: true, databaseReady: true, encryptionReady: true }}
        initialProviders={[
          {
            id: "provider-1",
            name: "ZenMux",
            type: "openai_compatible",
            baseUrl: "https://zenmux.ai/api/v1",
            enabled: true,
            secretConfigured: true,
            lastSyncedAt: "2026-08-26T10:00:00.000Z",
            modelCount: 12,
          },
        ]}
        initialOperations={{
          periodDays: 30,
          requestCount: 120,
          completedCount: 114,
          failedCount: 6,
          successRate: 95,
          inputTokens: 80_000,
          outputTokens: 20_000,
          estimatedCostUsd: 1.2345,
          averageLatencyMs: 1_800,
          rateLimitPerMinute: 30,
          providers: [
            {
              connectionId: "provider-1",
              status: "healthy",
              requestCount: 40,
              failedCount: 1,
              successRate: 97.5,
              averageLatencyMs: 1_200,
              lastRequestAt: "2026-08-26T10:30:00.000Z",
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "运行概览" })).toBeInTheDocument();
    expect(screen.getByText("95% 成功")).toBeInTheDocument();
    expect(screen.getByText("$1.2345")).toBeInTheDocument();
    expect(screen.getByText("稳定")).toBeInTheDocument();
    expect(screen.getByText("40 次调用 · 1.2s")).toBeInTheDocument();
  });
});
