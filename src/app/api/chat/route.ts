import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { z } from "zod";
import { DEFAULT_MODEL_ID, isFeaturedModel } from "@/lib/models";
import { isClerkConfigured } from "@/server/auth/config";
import { getRequestIdentity } from "@/server/auth/session";
import {
  getGatewayEnvironmentTag,
  isAiGatewayConfigured,
} from "@/server/ai/gateway";
import { saveConversationMessages } from "@/server/chat/store";
import { getDb } from "@/server/db";
import { usageEvents } from "@/server/db/schema";
import {
  getWorkspaceContext,
  type WorkspaceContext,
} from "@/server/db/workspace";
import { fingerprintGenerationRequest } from "@/server/generations/fingerprint";
import {
  beginGeneration,
  completeGeneration,
  failGeneration,
  markGenerationStreaming,
  stopGeneration,
  type GenerationRecord,
} from "@/server/generations/store";
import { resolveChatModel } from "@/server/providers/store";

export const maxDuration = 60;

const chatRequestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1).max(200),
  modelId: z.string().min(1).max(120).optional(),
  conversationId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

const SYSTEM_PROMPT = `你是 Dot，一位可靠、简洁且主动的中文 AI 助手。
优先给出明确结论，再补充必要的解释。遇到不确定的信息要坦诚说明。
不要声称执行了尚未执行的操作。`;

function getLatestUserText(messages: UIMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return (
    latest?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ") ?? ""
  );
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function createTextResponse({
  messages,
  text,
  mode,
  generationId,
  onComplete,
}: {
  messages: UIMessage[];
  text: string;
  mode: "demo" | "replay";
  generationId?: string;
  onComplete?: (responseMessage: UIMessage) => Promise<void>;
}) {
  const stream = createUIMessageStream({
    originalMessages: messages,
    generateId: createIdGenerator({ prefix: "msg", size: 20 }),
    async execute({ writer }) {
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      const chunkSize = mode === "demo" ? 12 : Math.max(text.length, 1);
      for (const chunk of text.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, "g")) ?? [text]) {
        writer.write({ type: "text-delta", id: textId, delta: chunk });
        if (mode === "demo") {
          await new Promise((resolve) => setTimeout(resolve, 28));
        }
      }
      writer.write({ type: "text-end", id: textId });
    },
    async onEnd({ responseMessage }) {
      await onComplete?.(responseMessage);
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "x-ai2dot-mode": mode,
      ...(generationId ? { "x-ai2dot-generation-id": generationId } : {}),
    },
  });
}

function generationError(
  kind: "conflict" | "in_progress" | "terminal",
  generation: GenerationRecord,
) {
  if (kind === "conflict") {
    return Response.json(
      { code: "IDEMPOTENCY_CONFLICT", message: "同一幂等键不能用于不同请求。" },
      { status: 409 },
    );
  }
  if (kind === "in_progress") {
    return Response.json(
      {
        code: "GENERATION_IN_PROGRESS",
        message: "该请求仍在生成中，请勿重复提交。",
        generationId: generation.id,
      },
      { status: 409 },
    );
  }
  return Response.json(
    {
      code: "GENERATION_TERMINAL",
      message: "该请求已结束，请使用新的幂等键重试。",
      generationId: generation.id,
      status: generation.status,
    },
    { status: 409 },
  );
}

export async function POST(request: Request) {
  const parsed = chatRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "消息格式不正确。" },
      { status: 400 },
    );
  }

  const modelId = parsed.data.modelId ?? DEFAULT_MODEL_ID;
  let messages: UIMessage[];
  try {
    messages = await validateUIMessages({ messages: parsed.data.messages });
  } catch {
    return Response.json(
      { code: "INVALID_MESSAGES", message: "消息历史无法验证。" },
      { status: 400 },
    );
  }

  const needsWorkspace = Boolean(parsed.data.conversationId) || modelId.startsWith("db:");
  const workspaceContext = needsWorkspace ? await getWorkspaceContext() : null;
  const gatewayConfigured = isAiGatewayConfigured();
  const requestIdentity =
    gatewayConfigured && isClerkConfigured()
      ? await getRequestIdentity()
      : null;

  if (parsed.data.conversationId && !workspaceContext) {
    return Response.json(
      { code: "UNAUTHORIZED", message: "请登录后保存云端会话。" },
      { status: 401 },
    );
  }
  if (
    parsed.data.conversationId &&
    (!parsed.data.branchId || !parsed.data.idempotencyKey)
  ) {
    return Response.json(
      { code: "GENERATION_ID_REQUIRED", message: "云端会话缺少分支或幂等键。" },
      { status: 400 },
    );
  }

  let languageModel: string | LanguageModel = modelId;
  let databaseModelId: string | undefined;
  let modelAvailable = isFeaturedModel(modelId)
    ? gatewayConfigured &&
      (!isClerkConfigured() || Boolean(requestIdentity))
    : false;
  let gatewayRouted = isFeaturedModel(modelId);
  let responseMode = "gateway";

  if (!isFeaturedModel(modelId)) {
    if (!workspaceContext) {
      return Response.json(
        { code: "MODEL_UNAVAILABLE", message: "当前模型未启用。" },
        { status: 400 },
      );
    }

    try {
      const resolved = await resolveChatModel(workspaceContext, modelId);
      if (!resolved) {
        return Response.json(
          { code: "MODEL_UNAVAILABLE", message: "当前模型未启用。" },
          { status: 400 },
        );
      }
      languageModel = resolved.languageModel;
      databaseModelId = resolved.databaseModelId;
      modelAvailable = resolved.available;
      gatewayRouted = resolved.gatewayRouted;
      responseMode = "provider";
    } catch {
      return Response.json(
        { code: "PROVIDER_UNAVAILABLE", message: "模型供应商配置无法使用。" },
        { status: 503 },
      );
    }
  }

  let persistence:
    | {
        context: WorkspaceContext;
        conversationId: string;
        branchId: string;
        generation: GenerationRecord;
      }
    | undefined;

  if (
    workspaceContext &&
    parsed.data.conversationId &&
    parsed.data.branchId &&
    parsed.data.idempotencyKey
  ) {
    const payloadHash = fingerprintGenerationRequest({
      conversationId: parsed.data.conversationId,
      branchId: parsed.data.branchId,
      modelId,
      messages,
    });
    const begun = await beginGeneration({
      context: workspaceContext,
      conversationId: parsed.data.conversationId,
      branchId: parsed.data.branchId,
      idempotencyKey: parsed.data.idempotencyKey,
      payloadHash,
      providerModelId: modelId,
      modelId: databaseModelId,
    });
    if (!begun) {
      return Response.json(
        { code: "CONVERSATION_NOT_FOUND", message: "会话或分支不存在。" },
        { status: 404 },
      );
    }
    if (begun.kind === "replay") {
      return createTextResponse({
        messages,
        text: getMessageText(begun.message),
        mode: "replay",
        generationId: begun.generation.id,
      });
    }
    if (begun.kind !== "created") {
      return generationError(begun.kind, begun.generation);
    }

    persistence = {
      context: workspaceContext,
      conversationId: parsed.data.conversationId,
      branchId: parsed.data.branchId,
      generation: begun.generation,
    };

    try {
      await saveConversationMessages({
        context: persistence.context,
        conversationId: persistence.conversationId,
        branchId: persistence.branchId,
        chatMessages: messages,
        modelId,
      });
      await markGenerationStreaming(persistence.context, persistence.generation.id);
    } catch (error) {
      await failGeneration(persistence.context, persistence.generation.id, error);
      return Response.json(
        { code: "CONVERSATION_NOT_FOUND", message: "会话或分支不存在。" },
        { status: 404 },
      );
    }
  }

  const persistCompleted = async (
    completedMessages: UIMessage[],
    responseMessage: UIMessage,
    usage = { inputTokens: 0, outputTokens: 0 },
    startedAt = Date.now(),
  ) => {
    if (!persistence) return;

    await saveConversationMessages({
      context: persistence.context,
      conversationId: persistence.conversationId,
      branchId: persistence.branchId,
      chatMessages: completedMessages,
      modelId,
    });
    const latencyMs = Date.now() - startedAt;
    await completeGeneration({
      context: persistence.context,
      generationId: persistence.generation.id,
      responseMessage,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs,
    });
    await getDb().insert(usageEvents).values({
      requestId: persistence.generation.id,
      workspaceId: persistence.context.workspaceId,
      userId: persistence.context.userId,
      modelId: databaseModelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs,
      status: "completed",
    });
  };

  if (!modelAvailable) {
    const prompt = getLatestUserText(messages);
    const demoText = prompt
      ? `这是演示模式下的本地响应。我已经收到：\n\n“${prompt.slice(0, 180)}${prompt.length > 180 ? "…" : ""}”\n\n配置 \`AI_GATEWAY_API_KEY\` 后，这里会切换为真实模型的流式回答。当前聊天界面、模型切换和历史记录已经可以正常体验。`
      : "演示模式已就绪。配置 AI Gateway 密钥后即可开始真实模型对话。";
    const startedAt = Date.now();
    return createTextResponse({
      messages,
      text: demoText,
      mode: "demo",
      generationId: persistence?.generation.id,
      async onComplete(responseMessage) {
        await persistCompleted([...messages, responseMessage], responseMessage, undefined, startedAt);
      },
    });
  }

  const startedAt = Date.now();
  const result = streamText({
    model: languageModel,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    ...(gatewayRouted
      ? {
          providerOptions: {
            gateway: {
              ...(requestIdentity
                ? { user: requestIdentity.externalAuthId }
                : {}),
              tags: ["feature:chat", getGatewayEnvironmentTag()],
            },
          },
        }
      : {}),
    abortSignal: request.signal,
    onError({ error }) {
      if (persistence) {
        void failGeneration(persistence.context, persistence.generation.id, error);
      }
    },
    onAbort() {
      if (persistence) {
        void stopGeneration(persistence.context, persistence.generation.id);
      }
    },
  });

  result.consumeStream({
    onError(error) {
      if (persistence) {
        void failGeneration(persistence.context, persistence.generation.id, error);
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 20 }),
      async onEnd({ messages: completedMessages, responseMessage, isAborted }) {
        if (isAborted && persistence) {
          await stopGeneration(persistence.context, persistence.generation.id);
          return;
        }
        const usage = await result.usage;
        await persistCompleted(completedMessages, responseMessage, {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        }, startedAt);
      },
      onError: () => "模型暂时不可用，请稍后重试。",
    }),
    headers: {
      "x-ai2dot-mode": responseMode,
      ...(persistence
        ? { "x-ai2dot-generation-id": persistence.generation.id }
        : {}),
    },
  });
}
