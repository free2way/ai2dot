import { eq } from "drizzle-orm";
import { streamText, type LanguageModel } from "ai";
import { extensionSummaryRequestSchema } from "@/lib/extension";
import { estimateUsageCostUsd } from "@/lib/operations";
import { isFeaturedModel } from "@/lib/models";
import {
  getGatewayEnvironmentTag,
  isAiGatewayConfigured,
} from "@/server/ai/gateway";
import { getDb } from "@/server/db";
import { usageEvents } from "@/server/db/schema";
import {
  extensionAuthErrorResponse,
  getChromeExtensionWorkspaceContext,
} from "@/server/extension/auth";
import {
  buildPageSummaryPrompt,
  getPageSummaryMaxOutputTokens,
  PAGE_SUMMARY_SYSTEM_PROMPT,
} from "@/server/extension/prompt";
import { logServerEvent } from "@/server/observability/log";
import { resolveChatModel } from "@/server/providers/store";
import { consumeChatRateLimit } from "@/server/rate-limit/chat";

export const maxDuration = 60;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const authorized = await getChromeExtensionWorkspaceContext(request);
  if (!authorized.ok) return extensionAuthErrorResponse(authorized);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return Response.json(
      { code: "INVALID_PAGE_CONTENT", message: "页面分析请求格式不正确。" },
      { status: 400 },
    );
  }

  const parsed = extensionSummaryRequestSchema.safeParse(requestBody);
  if (!parsed.success) {
    const pageTooLarge = parsed.error.issues.some(
      (issue) => issue.path.join(".") === "page.markdown" && issue.code === "too_big",
    );
    return Response.json(
      {
        code: pageTooLarge ? "PAGE_TOO_LARGE" : "INVALID_PAGE_CONTENT",
        message: pageTooLarge
          ? "页面内容过长，请选择重点内容后重新分析。"
          : "页面内容不完整或格式不正确。",
      },
      { status: pageTooLarge ? 413 : 400 },
    );
  }

  const requestId = `extension:${parsed.data.idempotencyKey}`;
  const [existingUsage] = await getDb()
    .select({ id: usageEvents.id })
    .from(usageEvents)
    .where(eq(usageEvents.requestId, requestId))
    .limit(1);
  if (existingUsage) {
    return Response.json(
      {
        code: "IDEMPOTENCY_CONFLICT",
        message: "该页面总结请求已经完成，请创建新的请求后重试。",
      },
      { status: 409 },
    );
  }

  try {
    const rateLimit = await consumeChatRateLimit(authorized.context);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          code: "RATE_LIMITED",
          message: `请求过于频繁，请在 ${rateLimit.retryAfterSeconds} 秒后重试。`,
        },
        {
          status: 429,
          headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
        },
      );
    }
  } catch (error) {
    logServerEvent("error", "extension.rate_limit_failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { code: "RATE_LIMIT_UNAVAILABLE", message: "请求保护服务暂时不可用。" },
      { status: 503 },
    );
  }

  const { modelId } = parsed.data;
  let languageModel: string | LanguageModel = modelId;
  let databaseModelId: string | undefined;
  let modelPricing: Record<string, string> | null | undefined;
  let gatewayRouted = false;

  if (isFeaturedModel(modelId)) {
    if (!isAiGatewayConfigured()) {
      return Response.json(
        { code: "MODEL_UNAVAILABLE", message: "当前模型未启用。" },
        { status: 503 },
      );
    }
    gatewayRouted = true;
  } else {
    try {
      const resolved = await resolveChatModel(authorized.context, modelId);
      if (!resolved || !resolved.available) {
        return Response.json(
          { code: "MODEL_FORBIDDEN", message: "当前工作区无法使用该模型。" },
          { status: 403 },
        );
      }
      languageModel = resolved.languageModel;
      databaseModelId = resolved.databaseModelId;
      modelPricing = resolved.pricing;
      gatewayRouted = resolved.gatewayRouted;
    } catch (error) {
      logServerEvent("error", "extension.model_resolution_failed", {
        requestId,
        modelId,
        error: error instanceof Error ? error.message : String(error),
      });
      return Response.json(
        { code: "MODEL_UNAVAILABLE", message: "模型供应商暂时不可用。" },
        { status: 503 },
      );
    }
  }

  logServerEvent("info", "extension.summary_started", {
    requestId,
    extensionId: authorized.identity.extensionId,
    workspaceId: authorized.context.workspaceId,
    userId: authorized.context.userId,
    modelId,
    sourceOrigin: new URL(parsed.data.page.url).origin,
    inputCharacters: parsed.data.page.markdown.length,
  });

  const result = streamText({
    model: languageModel,
    system: PAGE_SUMMARY_SYSTEM_PROMPT,
    prompt: buildPageSummaryPrompt(parsed.data),
    maxOutputTokens: getPageSummaryMaxOutputTokens(parsed.data.template),
    abortSignal: request.signal,
    ...(gatewayRouted
      ? {
          providerOptions: {
            gateway: {
              user: authorized.identity.externalAuthId,
              tags: ["feature:extension-summary", getGatewayEnvironmentTag()],
            },
          },
        }
      : {}),
    async onEnd({ usage }) {
      const latencyMs = Date.now() - startedAt;
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const costUsd = estimateUsageCostUsd(
        modelPricing,
        inputTokens,
        outputTokens,
      );
      try {
        await getDb().insert(usageEvents).values({
          requestId,
          workspaceId: authorized.context.workspaceId,
          userId: authorized.context.userId,
          modelId: databaseModelId,
          inputTokens,
          outputTokens,
          costUsd: costUsd.toFixed(8),
          latencyMs,
          status: "extension.page_summary.completed",
        });
      } catch (error) {
        logServerEvent("error", "extension.usage_write_failed", {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      logServerEvent("info", "extension.summary_completed", {
        requestId,
        workspaceId: authorized.context.workspaceId,
        modelId,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
      });
    },
    onError({ error }) {
      logServerEvent("error", "extension.summary_failed", {
        requestId,
        workspaceId: authorized.context.workspaceId,
        modelId,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
      });
    },
    onAbort() {
      logServerEvent("info", "extension.summary_stopped", {
        requestId,
        workspaceId: authorized.context.workspaceId,
        modelId,
        latencyMs: Date.now() - startedAt,
      });
    },
  });

  return result.toTextStreamResponse({
    headers: {
      "cache-control": "no-store",
      "x-ai2dot-mode": "extension-summary",
      "x-ai2dot-request-id": requestId,
    },
  });
}
