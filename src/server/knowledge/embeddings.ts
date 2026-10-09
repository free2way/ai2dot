import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { and, desc, eq } from "drizzle-orm";
import { embed, embedMany, type EmbeddingModel } from "ai";
import { getGatewayAuthMode } from "@/server/ai/gateway";
import { getDb } from "@/server/db";
import { providerConnections } from "@/server/db/schema";
import { assertSafeProviderBaseUrl } from "@/server/providers/catalog";
import { decryptProviderSecret } from "@/server/providers/secret";

export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_KNOWLEDGE_EMBEDDING_MODEL =
  "openai/text-embedding-3-small";

export type KnowledgeEmbeddingConfig = {
  modelId: string;
  model: EmbeddingModel;
  providerOptions?: {
    openaiCompatible: { dimensions: number };
  };
};

export function isKnowledgeEmbeddingConfigured(
  environment: Partial<NodeJS.ProcessEnv> = process.env,
) {
  if (environment.AI2DOT_EMBEDDING_PROVIDER_NAME?.trim()) return true;
  if (environment.AI2DOT_EMBEDDING_BASE_URL?.trim()) return true;
  return getGatewayAuthMode(environment) !== "unconfigured";
}

export function getKnowledgeEmbeddingModelId(
  environment: Partial<NodeJS.ProcessEnv> = process.env,
) {
  return (
    environment.AI2DOT_EMBEDDING_MODEL?.trim() ||
    DEFAULT_KNOWLEDGE_EMBEDDING_MODEL
  );
}

async function resolveWorkspaceProvider(
  workspaceId: string,
  providerName: string,
  providerModelId: string,
) {
  const [record] = await getDb()
    .select({
      id: providerConnections.id,
      type: providerConnections.type,
      baseUrl: providerConnections.baseUrl,
      encryptedSecret: providerConnections.encryptedSecret,
    })
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.workspaceId, workspaceId),
        eq(providerConnections.name, providerName),
        eq(providerConnections.enabled, true),
      ),
    )
    .orderBy(desc(providerConnections.updatedAt))
    .limit(1);

  if (!record) {
    throw new Error(`工作区中找不到已启用的模型供应商：${providerName}`);
  }
  if (record.type === "gateway" && !record.encryptedSecret) {
    return {
      modelId: `db:${record.id}:${providerModelId}`,
      model: providerModelId,
    } satisfies KnowledgeEmbeddingConfig;
  }
  if (record.type !== "openai_compatible" && record.type !== "gateway") {
    throw new Error("知识库 Embedding 目前只支持 AI Gateway 或 OpenAI-compatible 供应商。");
  }
  if (!record.baseUrl) throw new Error("Embedding 供应商缺少 Base URL。");
  await assertSafeProviderBaseUrl(record.baseUrl);

  const provider = createOpenAICompatible({
    name: `ai2dot_embeddings_${record.id.replaceAll("-", "")}`,
    baseURL: record.baseUrl.replace(/\/$/, ""),
    apiKey: record.encryptedSecret
      ? await decryptProviderSecret(record.encryptedSecret)
      : undefined,
  });
  return {
    modelId: `db:${record.id}:${providerModelId}`,
    model: provider.embeddingModel(providerModelId),
    providerOptions: {
      openaiCompatible: { dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS },
    },
  } satisfies KnowledgeEmbeddingConfig;
}

export async function resolveKnowledgeEmbeddingModel(
  workspaceId: string,
  environment: Partial<NodeJS.ProcessEnv> = process.env,
): Promise<KnowledgeEmbeddingConfig> {
  const providerModelId = getKnowledgeEmbeddingModelId(environment);
  const providerName = environment.AI2DOT_EMBEDDING_PROVIDER_NAME?.trim();
  if (providerName) {
    return resolveWorkspaceProvider(workspaceId, providerName, providerModelId);
  }

  const baseURL = environment.AI2DOT_EMBEDDING_BASE_URL?.trim();
  if (!baseURL) {
    return {
      modelId: `gateway:${providerModelId}`,
      model: providerModelId,
    };
  }

  const provider = createOpenAICompatible({
    name: "ai2dot_embeddings",
    baseURL: baseURL.replace(/\/$/, ""),
    apiKey: environment.AI2DOT_EMBEDDING_API_KEY?.trim(),
  });
  return {
    modelId: `endpoint:${baseURL.replace(/\/$/, "")}:${providerModelId}`,
    model: provider.embeddingModel(providerModelId),
    providerOptions: {
      openaiCompatible: { dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS },
    },
  };
}

function validateAndNormalizeEmbedding(embedding: number[]) {
  if (
    embedding.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `Embedding 模型必须返回 ${KNOWLEDGE_EMBEDDING_DIMENSIONS} 维有限数值向量。`,
    );
  }
  const magnitude = Math.sqrt(
    embedding.reduce((sum, value) => sum + value * value, 0),
  );
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Embedding 模型返回了无法归一化的零向量。");
  }
  return embedding.map((value) => value / magnitude);
}

export async function embedKnowledgeQuery(workspaceId: string, value: string) {
  if (!isKnowledgeEmbeddingConfigured()) return null;
  const { model, modelId, providerOptions } =
    await resolveKnowledgeEmbeddingModel(workspaceId);
  const result = await embed({
    model,
    value: value.replaceAll("\n", " ").trim().slice(0, 8_000),
    providerOptions,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(20_000),
  });
  return {
    embedding: validateAndNormalizeEmbedding(result.embedding),
    modelId,
  };
}

export async function embedKnowledgeChunks(
  workspaceId: string,
  values: string[],
) {
  if (!isKnowledgeEmbeddingConfigured()) {
    throw new Error("Embedding 服务尚未配置。");
  }
  const { model, modelId, providerOptions } =
    await resolveKnowledgeEmbeddingModel(workspaceId);
  const result = await embedMany({
    model,
    values: values.map((value) => value.replaceAll("\n", " ").slice(0, 8_000)),
    providerOptions,
    maxParallelCalls: 2,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(35_000),
  });
  return {
    embeddings: result.embeddings.map(validateAndNormalizeEmbedding),
    modelId,
    tokens: result.usage.tokens,
  };
}
