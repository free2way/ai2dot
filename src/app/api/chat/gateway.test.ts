import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { FEATURED_MODELS } from "@/lib/models";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(), databaseConfigured: vi.fn(), limit: vi.fn(),
  model: null as MockLanguageModelV4 | null,
}));
vi.mock("@/server/db/workspace", () => ({ getWorkspaceContext: mocks.workspace }));
vi.mock("@/server/db", () => ({ isDatabaseConfigured: mocks.databaseConfigured, getDb: vi.fn() }));
vi.mock("@/server/auth/config", () => ({ isAuthConfigured: () => true }));
vi.mock("@/server/auth/session", () => ({ getRequestIdentity: async () => ({ externalAuthId: "fixture-account" }) }));
vi.mock("@/server/rate-limit/chat", () => ({ consumeChatRateLimit: mocks.limit }));
vi.mock("@/server/knowledge/store", () => ({ searchKnowledge: async () => [] }));
vi.mock("@/server/mcp/store", () => ({ getEnabledMcpTools: async () => null }));
vi.mock("@/server/mcp/audit", () => ({ recordApprovalResponses: async () => undefined }));
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, streamText: (options: Parameters<typeof actual.streamText>[0]) =>
    actual.streamText({ ...options, model: mocks.model! }) };
});

const context = { userId: "fixture-user", workspaceId: "fixture-workspace", role: "owner" };
const request = () => POST(new Request("http://fixture/api/chat", {
  method: "POST", body: JSON.stringify({ modelId: FEATURED_MODELS[0].id,
    messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "Hello" }] }],
  }),
}));

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-credential");
  mocks.workspace.mockReset().mockResolvedValue(context);
  mocks.databaseConfigured.mockReset().mockReturnValue(true);
  mocks.limit.mockReset().mockResolvedValue({ allowed: true, limit: 30, remaining: 29, resetAt: 60_000, retryAfterSeconds: 60 });
  mocks.model = new MockLanguageModelV4({ doStream: async () => ({ stream: new ReadableStream({
    start(controller) {
      controller.enqueue({ type: "stream-start", warnings: [] });
      controller.enqueue({ type: "text-start", id: "answer" });
      controller.enqueue({ type: "text-delta", id: "answer", delta: "Gateway answer" });
      controller.enqueue({ type: "text-end", id: "answer" });
      controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      } });
      controller.close();
    },
  }) }) });
});
afterEach(() => vi.unstubAllEnvs());

describe("Gateway access without a persisted conversation", () => {
  it("checks the workspace and consumes the rate limit before streaming", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-remaining")).toBe("29");
    expect(await response.text()).toContain("Gateway answer");
    expect(mocks.workspace).toHaveBeenCalledOnce();
    expect(mocks.limit).toHaveBeenCalledWith(context);
    expect(mocks.model!.doStreamCalls).toHaveLength(1);
  });
  it("rejects missing or suspended workspace access without a model call", async () => {
    mocks.workspace.mockResolvedValue(null);
    expect((await request()).status).toBe(401);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.model!.doStreamCalls).toHaveLength(0);
  });
  it("rejects requests over the workspace limit", async () => {
    mocks.limit.mockResolvedValue({ allowed: false, limit: 30, remaining: 0, resetAt: 60_000, retryAfterSeconds: 10 });
    const response = await request();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("10");
    expect(mocks.model!.doStreamCalls).toHaveLength(0);
  });
  it("fails closed if the limiter is unavailable", async () => {
    mocks.limit.mockRejectedValue(new Error("Fixture unavailable"));
    expect((await request()).status).toBe(503);
    expect(mocks.model!.doStreamCalls).toHaveLength(0);
  });
  it("fails closed if the workspace cannot be loaded", async () => {
    mocks.workspace.mockRejectedValue(new Error("Fixture database failure"));
    expect((await request()).status).toBe(503);
    expect(mocks.model!.doStreamCalls).toHaveLength(0);
  });
  it("requires persistence to protect configured gateway access", async () => {
    mocks.databaseConfigured.mockReturnValue(false);
    const response = await request();
    expect(response.status).toBe(503);
    expect(mocks.workspace).not.toHaveBeenCalled();
    expect(mocks.model!.doStreamCalls).toHaveLength(0);
  });
});
