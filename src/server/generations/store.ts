import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { UIMessage } from "ai";
import { getMessageSkillResolution, hasPendingToolApproval } from "@/lib/skill-execution";
import type {
  ResolvedSkillSnapshot,
  SkillResolution,
} from "@/lib/skill-selection";
import { getConversationBranch } from "@/server/chat/store";
import { getDb } from "@/server/db";
import { generationSkillInvocations, generations, skills, skillVersions } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";

export type GenerationRecord = typeof generations.$inferSelect;

export type BeginGenerationResult =
  | { kind: "created"; generation: GenerationRecord }
  | { kind: "replay"; generation: GenerationRecord; message: UIMessage }
  | { kind: "in_progress"; generation: GenerationRecord }
  | { kind: "conflict"; generation: GenerationRecord }
  | { kind: "continuation_conflict"; generation: GenerationRecord }
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
  parentGenerationId,
}: {
  context: WorkspaceContext;
  conversationId: string;
  branchId: string;
  idempotencyKey: string;
  payloadHash: string;
  providerModelId: string;
  modelId?: string;
  parentGenerationId?: string;
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
        parentGenerationId,
      })
      .returning();
    return { kind: "created", generation };
  } catch {
    const raced = await findByIdempotencyKey(context, idempotencyKey);
    if (!raced && parentGenerationId) {
      const [child] = await getDb().select().from(generations).where(and(
        eq(generations.parentGenerationId, parentGenerationId),
        eq(generations.workspaceId, context.workspaceId),
        eq(generations.userId, context.userId),
      )).limit(1);
      if (child) return { kind: "continuation_conflict", generation: child };
    }
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

export async function recordGenerationSkillResolution({
  context,
  generationId,
  resolution,
  selectionHash,
  snapshots,
}: {
  context: WorkspaceContext;
  generationId: string;
  resolution: SkillResolution;
  selectionHash: string;
  snapshots: ResolvedSkillSnapshot[];
}) {
  const byVersionId = new Map(
    snapshots.map((snapshot) => [snapshot.versionId, snapshot]),
  );
  await getDb().transaction(async (tx) => {
    const included = resolution.skills.filter((item) => item.status === "included");
    if (included.length > 0) {
      const executable = await tx
        .select({ skillId: skills.id, versionId: skillVersions.id, contentHash: skillVersions.contentHash })
        .from(skillVersions)
        .innerJoin(skills, eq(skills.id, skillVersions.skillId))
        .where(and(
          eq(skills.workspaceId, context.workspaceId),
          eq(skills.enabled, true),
          isNull(skills.archivedAt),
          isNull(skillVersions.revokedAt),
          inArray(skillVersions.id, included.map((item) => item.versionId)),
        ))
        .for("share");
      if (included.some((item) => !executable.some((row) =>
        row.skillId === item.id && row.versionId === item.versionId &&
        row.contentHash === byVersionId.get(item.versionId)?.contentHash,
      ))) {
        throw new Error("Skill policy changed before execution was frozen.");
      }
    }
    const [updated] = await tx
      .update(generations)
      .set({
        skillResolution: resolution,
        skillSelectionHash: selectionHash,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(generations.id, generationId),
          eq(generations.workspaceId, context.workspaceId),
          eq(generations.userId, context.userId),
        ),
      )
      .returning({ id: generations.id });
    if (!updated) throw new Error("Generation not found.");

    if (resolution.skills.length > 0) {
      await tx.insert(generationSkillInvocations).values(
        resolution.skills.map((item, position) => {
          const snapshot = byVersionId.get(item.versionId);
          if (!snapshot) throw new Error("Skill snapshot is missing.");
          return {
            generationId,
            workspaceId: context.workspaceId,
            userId: context.userId,
            skillId: item.id,
            skillVersionId: item.versionId,
            position,
            trigger: item.trigger,
            snapshot: snapshot as unknown as Record<string, unknown>,
            status: item.status,
            statusReason: item.statusReason,
            contextTarget: resolution.contextTarget,
            estimatedInputTokens: item.estimatedInputTokens,
          };
        }),
      );
    }
  });
}

async function updateInvocationStatuses(
  context: WorkspaceContext,
  generationId: string,
  from: Array<
    | "resolved"
    | "included"
    | "awaiting_approval"
  >,
  status: "completed" | "failed" | "stopped" | "awaiting_approval",
  db: Pick<ReturnType<typeof getDb>, "update"> = getDb(),
) {
  await db
    .update(generationSkillInvocations)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(generationSkillInvocations.generationId, generationId),
        eq(generationSkillInvocations.workspaceId, context.workspaceId),
        inArray(generationSkillInvocations.status, from),
      ),
    );
}

export async function getGenerationSkillDetails(
  context: WorkspaceContext,
  generationId: string,
) {
  const [generation] = await getDb()
    .select({
      id: generations.id,
      status: generations.status,
      resolution: generations.skillResolution,
      inputTokens: generations.inputTokens,
      outputTokens: generations.outputTokens,
      conversationId: generations.conversationId,
      branchId: generations.branchId,
      skillSelectionHash: generations.skillSelectionHash,
      responseMessage: generations.responseMessage,
      parentGenerationId: generations.parentGenerationId,
    })
    .from(generations)
    .where(
      and(
        eq(generations.id, generationId),
        eq(generations.workspaceId, context.workspaceId),
        eq(generations.userId, context.userId),
      ),
    )
    .limit(1);
  if (!generation) return null;
  const invocations = await getDb()
    .select({
      skillId: generationSkillInvocations.skillId,
      versionId: generationSkillInvocations.skillVersionId,
      position: generationSkillInvocations.position,
      trigger: generationSkillInvocations.trigger,
      status: generationSkillInvocations.status,
      statusReason: generationSkillInvocations.statusReason,
      contextTarget: generationSkillInvocations.contextTarget,
      estimatedInputTokens: generationSkillInvocations.estimatedInputTokens,
      snapshot: generationSkillInvocations.snapshot,
    })
    .from(generationSkillInvocations)
    .where(eq(generationSkillInvocations.generationId, generationId))
    .orderBy(asc(generationSkillInvocations.position));
  return { ...generation, invocations };
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
  return getDb().transaction(async (tx) => {
    const resolution = getMessageSkillResolution(responseMessage);
    await tx
      .update(generations)
      .set({
        status: "completed",
        ...(resolution ? { skillResolution: resolution } : {}),
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
    await updateInvocationStatuses(
      context,
      generationId,
      ["resolved", "included", "awaiting_approval"],
      hasPendingToolApproval(responseMessage) ? "awaiting_approval" : "completed",
      tx,
    );
  });
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
  await updateInvocationStatuses(
    context,
    generationId,
    ["resolved", "included", "awaiting_approval"],
    "failed",
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
  await updateInvocationStatuses(
    context,
    generationId,
    ["resolved", "included", "awaiting_approval"],
    "stopped",
  );
}
