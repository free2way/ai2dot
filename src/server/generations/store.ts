import "server-only";

import { and, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { getConversationBranch } from "@/server/chat/store";
import { getDb } from "@/server/db";
import { generations } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";

export type GenerationRecord = typeof generations.$inferSelect;

export type BeginGenerationResult =
  | { kind: "created"; generation: GenerationRecord }
  | { kind: "replay"; generation: GenerationRecord; message: UIMessage }
  | { kind: "in_progress"; generation: GenerationRecord }
  | { kind: "conflict"; generation: GenerationRecord }
  | { kind: "terminal"; generation: GenerationRecord };

async function findByIdempotencyKey(
  context: WorkspaceContext,
  idempotencyKey: string,
) {
  const [generation] = await getDb()
    .select()
    .from(generations)
    .where(
      and(
        eq(generations.workspaceId, context.workspaceId),
        eq(generations.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return generation ?? null;
}

function classifyExisting(
  generation: GenerationRecord,
  payloadHash: string,
): BeginGenerationResult {
  if (generation.payloadHash !== payloadHash) {
    return { kind: "conflict", generation };
  }
  if (generation.status === "completed" && generation.responseMessage) {
    return {
      kind: "replay",
      generation,
      message: generation.responseMessage as unknown as UIMessage,
    };
  }
  if (generation.status === "pending" || generation.status === "streaming") {
    return { kind: "in_progress", generation };
  }
  return { kind: "terminal", generation };
}

export async function beginGeneration({
  context,
  conversationId,
  branchId,
  idempotencyKey,
  payloadHash,
  providerModelId,
  modelId,
}: {
  context: WorkspaceContext;
  conversationId: string;
  branchId: string;
  idempotencyKey: string;
  payloadHash: string;
  providerModelId: string;
  modelId?: string;
}): Promise<BeginGenerationResult | null> {
  const branch = await getConversationBranch(context, conversationId, branchId);
  if (!branch) return null;

  const existing = await findByIdempotencyKey(context, idempotencyKey);
  if (existing) return classifyExisting(existing, payloadHash);

  try {
    const [generation] = await getDb()
      .insert(generations)
      .values({
        idempotencyKey,
        payloadHash,
        workspaceId: context.workspaceId,
        userId: context.userId,
        conversationId,
        branchId,
        providerModelId,
        modelId,
      })
      .returning();
    return { kind: "created", generation };
  } catch {
    const raced = await findByIdempotencyKey(context, idempotencyKey);
    if (!raced) throw new Error("Generation could not be created.");
    return classifyExisting(raced, payloadHash);
  }
}

export async function markGenerationStreaming(
  context: WorkspaceContext,
  generationId: string,
) {
  await getDb()
    .update(generations)
    .set({ status: "streaming", startedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(generations.id, generationId),
        eq(generations.workspaceId, context.workspaceId),
      ),
    );
}

export async function completeGeneration({
  context,
  generationId,
  responseMessage,
  inputTokens,
  outputTokens,
  latencyMs,
}: {
  context: WorkspaceContext;
  generationId: string;
  responseMessage: UIMessage;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}) {
  await getDb()
    .update(generations)
    .set({
      status: "completed",
      responseMessage: responseMessage as unknown as Record<string, unknown>,
      inputTokens,
      outputTokens,
      latencyMs,
      completedAt: new Date(),
      updatedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(
      and(
        eq(generations.id, generationId),
        eq(generations.workspaceId, context.workspaceId),
      ),
    );
}

export async function failGeneration(
  context: WorkspaceContext,
  generationId: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Unknown generation error";
  await getDb()
    .update(generations)
    .set({
      status: "failed",
      errorCode: "MODEL_STREAM_ERROR",
      errorMessage: message.slice(0, 500),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(generations.id, generationId),
        eq(generations.workspaceId, context.workspaceId),
      ),
    );
}

export async function stopGeneration(
  context: WorkspaceContext,
  generationId: string,
) {
  await getDb()
    .update(generations)
    .set({
      status: "stopped",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(generations.id, generationId),
        eq(generations.workspaceId, context.workspaceId),
      ),
    );
}
