import "server-only";

import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeEmbeddingJobs,
} from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";
import {
  embedKnowledgeChunks,
  isKnowledgeEmbeddingConfigured,
  resolveKnowledgeEmbeddingModel,
} from "@/server/knowledge/embeddings";

const MAX_ATTEMPTS = 5;
const LOCK_TIMEOUT_MS = 10 * 60 * 1_000;

export async function enqueueKnowledgeEmbeddingJob(
  context: WorkspaceContext,
  input: { knowledgeBaseId: string; documentId: string },
) {
  await getDb()
    .insert(knowledgeEmbeddingJobs)
    .values({
      workspaceId: context.workspaceId,
      knowledgeBaseId: input.knowledgeBaseId,
      documentId: input.documentId,
    })
    .onConflictDoUpdate({
      target: knowledgeEmbeddingJobs.documentId,
      set: {
        status: "pending",
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        completedAt: null,
        lastError: null,
        updatedAt: new Date(),
      },
    });
}

async function claimEmbeddingJob(preferredDocumentId?: string) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  return getDb().transaction(async (tx) => {
    const claimable = or(
      and(
        inArray(knowledgeEmbeddingJobs.status, ["pending", "failed"]),
        lte(knowledgeEmbeddingJobs.availableAt, now),
        lt(knowledgeEmbeddingJobs.attempts, MAX_ATTEMPTS),
      ),
      and(
        eq(knowledgeEmbeddingJobs.status, "running"),
        lt(knowledgeEmbeddingJobs.lockedAt, staleBefore),
        lt(knowledgeEmbeddingJobs.attempts, MAX_ATTEMPTS),
      ),
    );
    const where = preferredDocumentId
      ? and(eq(knowledgeEmbeddingJobs.documentId, preferredDocumentId), claimable)
      : claimable;
    const [job] = await tx
      .select()
      .from(knowledgeEmbeddingJobs)
      .where(where)
      .orderBy(asc(knowledgeEmbeddingJobs.availableAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!job) return null;

    const [claimed] = await tx
      .update(knowledgeEmbeddingJobs)
      .set({
        status: "running",
        attempts: job.attempts + 1,
        lockedAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(knowledgeEmbeddingJobs.id, job.id))
      .returning();
    if (!claimed) return null;
    await tx
      .update(knowledgeDocuments)
      .set({
        embeddingStatus: "processing",
        embeddingError: null,
        updatedAt: now,
      })
      .where(eq(knowledgeDocuments.id, claimed.documentId));
    return claimed;
  });
}

async function processClaimedJob(
  job: NonNullable<Awaited<ReturnType<typeof claimEmbeddingJob>>>,
  maxChunks: number,
) {
  const db = getDb();
  const expectedModelId = (
    await resolveKnowledgeEmbeddingModel(job.workspaceId)
  ).modelId;
  const chunks = await db
    .select({ id: knowledgeChunks.id, content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.documentId, job.documentId),
        or(
          isNull(knowledgeChunks.embedding),
          isNull(knowledgeChunks.embeddingModel),
          ne(knowledgeChunks.embeddingModel, expectedModelId),
        ),
      ),
    )
    .orderBy(asc(knowledgeChunks.chunkIndex))
    .limit(maxChunks);

  if (chunks.length > 0) {
    const embedded = await embedKnowledgeChunks(
      job.workspaceId,
      chunks.map((chunk) => chunk.content),
    );
    for (let offset = 0; offset < chunks.length; offset += 64) {
      const batch = chunks.slice(offset, offset + 64);
      const values = batch.map((chunk, batchIndex) => sql`(
        ${chunk.id}::uuid,
        ${JSON.stringify(embedded.embeddings[offset + batchIndex])}::vector,
        ${embedded.modelId}::text
      )`);
      await db.execute(sql`
        UPDATE ${knowledgeChunks} AS chunk
        SET
          embedding = batch.embedding,
          embedding_model = batch.embedding_model,
          embedded_at = now()
        FROM (VALUES ${sql.join(values, sql`, `)})
          AS batch(id, embedding, embedding_model)
        WHERE chunk.id = batch.id
      `);
    }
  }

  const [{ remaining }] = await db
    .select({ remaining: count(knowledgeChunks.id) })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.documentId, job.documentId),
        or(
          isNull(knowledgeChunks.embedding),
          isNull(knowledgeChunks.embeddingModel),
          ne(knowledgeChunks.embeddingModel, expectedModelId),
        ),
      ),
    );
  const [{ embeddedCount }] = await db
    .select({ embeddedCount: count(knowledgeChunks.embedding) })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.documentId, job.documentId));
  const completed = remaining === 0;
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(knowledgeDocuments)
      .set({
        embeddingStatus: completed ? "ready" : "pending",
        embeddingModel: expectedModelId,
        embeddedChunkCount: embeddedCount,
        embeddingError: null,
        updatedAt: now,
      })
      .where(eq(knowledgeDocuments.id, job.documentId));
    await tx
      .update(knowledgeEmbeddingJobs)
      .set({
        status: completed ? "completed" : "pending",
        availableAt: now,
        lockedAt: null,
        completedAt: completed ? now : null,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(knowledgeEmbeddingJobs.id, job.id));
  });

  return { completed, embedded: chunks.length };
}

async function failEmbeddingJob(
  job: NonNullable<Awaited<ReturnType<typeof claimEmbeddingJob>>>,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Embedding 任务失败。";
  const exhausted = job.attempts >= MAX_ATTEMPTS;
  const delayMs = Math.min(15 * 60_000, 2 ** Math.max(0, job.attempts - 1) * 30_000);
  const now = new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .update(knowledgeEmbeddingJobs)
      .set({
        status: exhausted ? "failed" : "pending",
        availableAt: new Date(now.getTime() + delayMs),
        lockedAt: null,
        lastError: message.slice(0, 500),
        updatedAt: now,
      })
      .where(eq(knowledgeEmbeddingJobs.id, job.id));
    await tx
      .update(knowledgeDocuments)
      .set({
        embeddingStatus: exhausted ? "failed" : "pending",
        embeddingError: message.slice(0, 500),
        updatedAt: now,
      })
      .where(eq(knowledgeDocuments.id, job.documentId));
  });
}

export async function processKnowledgeEmbeddingJobs({
  maxJobs = 2,
  maxChunksPerJob = 96,
  preferredDocumentId,
}: {
  maxJobs?: number;
  maxChunksPerJob?: number;
  preferredDocumentId?: string;
} = {}) {
  if (!isKnowledgeEmbeddingConfigured()) {
    return { configured: false, claimed: 0, embedded: 0, completed: 0, failed: 0 };
  }

  const result = { configured: true, claimed: 0, embedded: 0, completed: 0, failed: 0 };
  for (let index = 0; index < Math.max(1, Math.min(maxJobs, 8)); index += 1) {
    const job = await claimEmbeddingJob(index === 0 ? preferredDocumentId : undefined);
    if (!job) break;
    result.claimed += 1;
    try {
      const processed = await processClaimedJob(
        job,
        Math.max(1, Math.min(maxChunksPerJob, 512)),
      );
      result.embedded += processed.embedded;
      if (processed.completed) result.completed += 1;
    } catch (error) {
      result.failed += 1;
      await failEmbeddingJob(job, error);
    }
  }
  return result;
}
