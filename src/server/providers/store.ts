import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  FEATURED_MODELS,
  type ModelCapability,
  type ModelCatalogEntry,
} from "@/lib/models";
import { getDb } from "@/server/db";
import { models, providerConnections } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";
import {
  assertSafeProviderBaseUrl,
  fetchProviderCatalog,
} from "@/server/providers/catalog";
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from "@/server/providers/secret";

export async function listProviderConnections(context: WorkspaceContext) {
  return getDb()
    .select({
      id: providerConnections.id,
      name: providerConnections.name,
      type: providerConnections.type,
      baseUrl: providerConnections.baseUrl,
      enabled: providerConnections.enabled,
      secretConfigured: sql<boolean>`${providerConnections.encryptedSecret} is not null`,
      lastSyncedAt: providerConnections.lastSyncedAt,
      modelCount: sql<number>`count(${models.id})::int`,
    })
    .from(providerConnections)
    .leftJoin(models, eq(models.connectionId, providerConnections.id))
    .where(eq(providerConnections.workspaceId, context.workspaceId))
    .groupBy(providerConnections.id)
    .orderBy(desc(providerConnections.updatedAt));
}

export async function listProviderModels(context: WorkspaceContext) {
  return getDb()
    .select({
      id: models.id,
      providerModelId: models.providerModelId,
      name: models.name,
      connectionName: providerConnections.name,
      connectionType: providerConnections.type,
      contextWindow: models.contextWindow,
      enabled: models.enabled,
    })
    .from(models)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, models.connectionId),
    )
    .where(eq(providerConnections.workspaceId, context.workspaceId))
    .orderBy(desc(models.updatedAt))
    .limit(500);
}

function modelAccent(providerModelId: string) {
  if (providerModelId.startsWith("openai/")) return "#b7f34a";
  if (providerModelId.startsWith("anthropic/")) return "#f0a26b";
  if (providerModelId.startsWith("google/")) return "#7db2ff";
  return "#d8cf78";
}

function safeCapabilities(values: string[]): ModelCapability[] {
  const allowed = new Set<ModelCapability>([
    "text",
    "image",
    "files",
    "reasoning",
  ]);
  return values.filter((value): value is ModelCapability =>
    allowed.has(value as ModelCapability),
  );
}

export async function listEnabledChatModels(
  context: WorkspaceContext,
): Promise<ModelCatalogEntry[]> {
  const rows = await getDb()
    .select({
      id: models.id,
      providerModelId: models.providerModelId,
      name: models.name,
      description: models.description,
      contextWindow: models.contextWindow,
      capabilities: models.capabilities,
      connectionName: providerConnections.name,
    })
    .from(models)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, models.connectionId),
    )
    .where(
      and(
        eq(providerConnections.workspaceId, context.workspaceId),
        eq(providerConnections.enabled, true),
        eq(models.enabled, true),
      ),
    )
    .orderBy(desc(models.updatedAt))
    .limit(100);

  return rows.map((model) => ({
    id: `db:${model.id}`,
    name: model.name,
    provider: model.connectionName,
    description: model.description || model.providerModelId,
    contextWindow: model.contextWindow ?? 0,
    capabilities: safeCapabilities(model.capabilities),
    accent: modelAccent(model.providerModelId),
  }));
}

export async function setProviderModelEnabled(
  context: WorkspaceContext,
  modelId: string,
  enabled: boolean,
) {
  const db = getDb();
  const [ownedModel] = await db
    .select({ id: models.id })
    .from(models)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, models.connectionId),
    )
    .where(
      and(
        eq(models.id, modelId),
        eq(providerConnections.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);

  if (!ownedModel) return null;

  const [updated] = await db
    .update(models)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(models.id, modelId))
    .returning({ id: models.id, enabled: models.enabled });

  return updated ?? null;
}

export async function resolveChatModel(
  context: WorkspaceContext,
  publicModelId: string,
) {
  const id = publicModelId.startsWith("db:") ? publicModelId.slice(3) : "";
  if (!id) return null;

  const [record] = await getDb()
    .select({
      id: models.id,
      providerModelId: models.providerModelId,
      connectionName: providerConnections.name,
      connectionType: providerConnections.type,
      baseUrl: providerConnections.baseUrl,
      encryptedSecret: providerConnections.encryptedSecret,
    })
    .from(models)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, models.connectionId),
    )
    .where(
      and(
        eq(models.id, id),
        eq(models.enabled, true),
        eq(providerConnections.enabled, true),
        eq(providerConnections.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);

  if (!record) return null;

  const secret = record.encryptedSecret
    ? await decryptProviderSecret(record.encryptedSecret)
    : undefined;

  if (record.connectionType === "gateway" && !secret) {
    return {
      languageModel: record.providerModelId,
      databaseModelId: record.id,
      available: Boolean(process.env.AI_GATEWAY_API_KEY),
    };
  }

  const baseURL =
    record.connectionType === "gateway"
      ? "https://ai-gateway.vercel.sh/v1"
      : record.baseUrl;
  if (!baseURL) throw new Error("Provider base URL is missing.");
  if (record.connectionType !== "gateway") {
    await assertSafeProviderBaseUrl(baseURL);
  }

  const provider = createOpenAICompatible({
    name: `ai2dot_${record.id.replaceAll("-", "")}`,
    baseURL,
    apiKey: secret,
    includeUsage: true,
  });

  return {
    languageModel: provider(record.providerModelId),
    databaseModelId: record.id,
    available: Boolean(secret) || record.connectionType !== "gateway",
  };
}

export async function createProviderConnection(
  context: WorkspaceContext,
  input: {
    name: string;
    type: "gateway" | "openai_compatible" | "native";
    baseUrl?: string;
    secret?: string;
  },
) {
  if (input.type !== "gateway" && input.baseUrl) {
    await assertSafeProviderBaseUrl(input.baseUrl);
  }

  const encryptedSecret = input.secret
    ? await encryptProviderSecret(input.secret)
    : null;

  const [connection] = await getDb()
    .insert(providerConnections)
    .values({
      workspaceId: context.workspaceId,
      name: input.name,
      type: input.type,
      baseUrl: input.baseUrl || null,
      encryptedSecret,
    })
    .returning({ id: providerConnections.id });

  return connection;
}

export async function syncProviderConnection(
  context: WorkspaceContext,
  connectionId: string,
) {
  const db = getDb();
  const [connection] = await db
    .select()
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.id, connectionId),
        eq(providerConnections.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);

  if (!connection) return null;

  const secret = connection.encryptedSecret
    ? await decryptProviderSecret(connection.encryptedSecret)
    : connection.type === "gateway"
      ? process.env.AI_GATEWAY_API_KEY
      : undefined;
  const discoveredModels = await fetchProviderCatalog({
    type: connection.type,
    baseUrl: connection.baseUrl,
    secret,
  });
  const featuredIds = new Set(FEATURED_MODELS.map((model) => model.id));

  for (const model of discoveredModels) {
    await db
      .insert(models)
      .values({
        connectionId,
        providerModelId: model.id,
        name: model.name,
        description: model.description,
        contextWindow: model.contextWindow,
        capabilities: model.capabilities,
        pricing: model.pricing,
        enabled: featuredIds.has(model.id),
      })
      .onConflictDoUpdate({
        target: [models.connectionId, models.providerModelId],
        set: {
          name: model.name,
          description: model.description,
          contextWindow: model.contextWindow,
          capabilities: model.capabilities,
          pricing: model.pricing,
          updatedAt: new Date(),
        },
      });
  }

  await db
    .update(providerConnections)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(providerConnections.id, connectionId));

  return { discovered: discoveredModels.length };
}
