import "server-only";

import { createHash } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type {
  NotebookArtifactSummary,
  NotebookArtifactType,
  NotebookDetail,
  NotebookSummary,
  NotebookStatus,
  NotebookVideoSourceSummary,
} from "@/lib/notebooks";
import { getDb } from "@/server/db";
import {
  knowledgeBases,
  knowledgeChunks,
  knowledgeDocuments,
  notebookArtifacts,
  notebookVideoSources,
  notebooks,
} from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";
import { addKnowledgeDocument, listKnowledgeDocuments } from "@/server/knowledge/store";

const notebookSelection = {
  id: notebooks.id,
  knowledgeBaseId: notebooks.knowledgeBaseId,
  title: notebooks.title,
  description: notebooks.description,
  status: notebooks.status,
  documentCount: sql<number>`(
    select count(*)::int from ${knowledgeDocuments}
    where ${knowledgeDocuments.knowledgeBaseId} = ${notebooks.knowledgeBaseId}
  )`,
  chunkCount: sql<number>`(
    select count(*)::int from ${knowledgeChunks}
    where ${knowledgeChunks.knowledgeBaseId} = ${notebooks.knowledgeBaseId}
  )`,
  semanticChunkCount: sql<number>`(
    select count(${knowledgeChunks.embedding})::int from ${knowledgeChunks}
    where ${knowledgeChunks.knowledgeBaseId} = ${notebooks.knowledgeBaseId}
  )`,
  artifactCount: sql<number>`(
    select count(*)::int from ${notebookArtifacts}
    where ${notebookArtifacts.notebookId} = ${notebooks.id}
  )`,
  updatedAt: notebooks.updatedAt,
};

type NotebookSelectionRow = {
  id: string;
  knowledgeBaseId: string;
  title: string;
  description: string | null;
  status: NotebookStatus;
  documentCount: number;
  chunkCount: number;
  semanticChunkCount: number;
  artifactCount: number;
  updatedAt: Date;
};

function serializeNotebook(value: NotebookSelectionRow) {
  return {
    ...value,
    description: value.description ?? "",
    updatedAt: value.updatedAt.toISOString(),
  } satisfies NotebookSummary;
}

function serializeArtifact(row: typeof notebookArtifacts.$inferSelect): NotebookArtifactSummary {
  return {
    id: row.id,
    notebookId: row.notebookId,
    type: row.type,
    title: row.title,
    contentMarkdown: row.contentMarkdown ?? "",
    status: row.status,
    modelId: row.modelId,
    sourceSnapshotHash: row.sourceSnapshotHash,
    publishedDocumentId: row.publishedDocumentId,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeVideoSource(
  row: typeof notebookVideoSources.$inferSelect,
): NotebookVideoSourceSummary {
  return {
    id: row.id,
    notebookId: row.notebookId,
    knowledgeDocumentId: row.knowledgeDocumentId,
    platform: row.platform,
    externalId: row.externalId,
    sourceUrl: row.sourceUrl,
    canonicalUrl: row.canonicalUrl,
    title: row.title,
    authorName: row.authorName,
    thumbnailUrl: row.thumbnailUrl,
    durationSeconds: row.durationSeconds,
    language: row.language,
    transcriptOrigin: row.transcriptOrigin,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listNotebooks(
  context: WorkspaceContext,
  options: { includeArchived?: boolean } = {},
): Promise<NotebookSummary[]> {
  const condition = options.includeArchived
    ? eq(notebooks.workspaceId, context.workspaceId)
    : and(
        eq(notebooks.workspaceId, context.workspaceId),
        eq(notebooks.status, "active"),
      );
  const rows = await getDb()
    .select(notebookSelection)
    .from(notebooks)
    .where(condition)
    .orderBy(desc(notebooks.updatedAt));
  return rows.map((row) => serializeNotebook(row));
}

export async function getNotebook(
  context: WorkspaceContext,
  notebookId: string,
): Promise<NotebookDetail | null> {
  const [row] = await getDb()
    .select(notebookSelection)
    .from(notebooks)
    .where(
      and(
        eq(notebooks.id, notebookId),
        eq(notebooks.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const notebook = serializeNotebook(row);
  const [documents, artifacts, videoSources] = await Promise.all([
    listKnowledgeDocuments(context, notebook.knowledgeBaseId),
    getDb()
      .select()
      .from(notebookArtifacts)
      .where(eq(notebookArtifacts.notebookId, notebook.id))
      .orderBy(desc(notebookArtifacts.createdAt)),
    getDb()
      .select()
      .from(notebookVideoSources)
      .where(eq(notebookVideoSources.notebookId, notebook.id))
      .orderBy(desc(notebookVideoSources.createdAt)),
  ]);
  return {
    ...notebook,
    documents: documents ?? [],
    artifacts: artifacts.map(serializeArtifact),
    videoSources: videoSources.map(serializeVideoSource),
  };
}

export async function createNotebookVideoSource(
  context: WorkspaceContext,
  notebookId: string,
  input: {
    platform: "youtube" | "bilibili";
    externalId: string;
    sourceUrl: string;
    canonicalUrl: string;
    title: string;
    authorName: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    language: string | null;
    transcriptOrigin: "pasted" | "subtitle_upload";
    rightsConfirmed: boolean;
    metadata: Record<string, unknown>;
    byteSize: number;
  },
) {
  return getDb().transaction(async (tx) => {
    const [notebook] = await tx
      .select({ id: notebooks.id, knowledgeBaseId: notebooks.knowledgeBaseId })
      .from(notebooks)
      .where(
        and(
          eq(notebooks.id, notebookId),
          eq(notebooks.workspaceId, context.workspaceId),
        ),
      )
      .limit(1);
    if (!notebook) return { status: "not_found" as const };

    const [duplicate] = await tx
      .select({ id: notebookVideoSources.id })
      .from(notebookVideoSources)
      .where(
        and(
          eq(notebookVideoSources.notebookId, notebookId),
          eq(notebookVideoSources.platform, input.platform),
          eq(notebookVideoSources.externalId, input.externalId),
        ),
      )
      .limit(1);
    if (duplicate) return { status: "duplicate" as const };

    const { byteSize, ...sourceInput } = input;
    const [document] = await tx
      .insert(knowledgeDocuments)
      .values({
        knowledgeBaseId: notebook.knowledgeBaseId,
        name: `${input.title.slice(0, 130)} · 视频逐字稿`,
        mimeType: "text/markdown",
        byteSize,
        characterCount: 0,
        status: "processing",
      })
      .returning({ id: knowledgeDocuments.id });
    const [source] = await tx
      .insert(notebookVideoSources)
      .values({
        notebookId,
        knowledgeDocumentId: document.id,
        createdByUserId: context.userId,
        ...sourceInput,
      })
      .returning();
    return {
      status: "created" as const,
      knowledgeBaseId: notebook.knowledgeBaseId,
      documentId: document.id,
      source: serializeVideoSource(source),
    };
  });
}

export async function createNotebook(
  context: WorkspaceContext,
  input: { title: string; description?: string },
) {
  return getDb().transaction(async (tx) => {
    const [knowledgeBase] = await tx
      .insert(knowledgeBases)
      .values({
        workspaceId: context.workspaceId,
        name: input.title,
        description: input.description || null,
      })
      .returning({ id: knowledgeBases.id });
    const [notebook] = await tx
      .insert(notebooks)
      .values({
        workspaceId: context.workspaceId,
        knowledgeBaseId: knowledgeBase.id,
        title: input.title,
        description: input.description || null,
      })
      .returning({ id: notebooks.id, knowledgeBaseId: notebooks.knowledgeBaseId });
    return notebook;
  });
}

export async function updateNotebook(
  context: WorkspaceContext,
  notebookId: string,
  input: { title?: string; description?: string; status?: NotebookStatus },
) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: notebooks.id, knowledgeBaseId: notebooks.knowledgeBaseId })
      .from(notebooks)
      .where(
        and(
          eq(notebooks.id, notebookId),
          eq(notebooks.workspaceId, context.workspaceId),
        ),
      )
      .limit(1);
    if (!current) return null;

    const now = new Date();
    const [updated] = await tx
      .update(notebooks)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description || null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: now,
      })
      .where(eq(notebooks.id, current.id))
      .returning({ id: notebooks.id });
    if (input.title !== undefined || input.description !== undefined) {
      await tx
        .update(knowledgeBases)
        .set({
          ...(input.title !== undefined ? { name: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description || null }
            : {}),
          updatedAt: now,
        })
        .where(eq(knowledgeBases.id, current.knowledgeBaseId));
    }
    return updated;
  });
}

export async function deleteNotebook(context: WorkspaceContext, notebookId: string) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: notebooks.id, knowledgeBaseId: notebooks.knowledgeBaseId })
      .from(notebooks)
      .where(
        and(
          eq(notebooks.id, notebookId),
          eq(notebooks.workspaceId, context.workspaceId),
        ),
      )
      .limit(1);
    if (!current) return null;
    await tx.delete(notebooks).where(eq(notebooks.id, current.id));
    await tx.delete(knowledgeBases).where(eq(knowledgeBases.id, current.knowledgeBaseId));
    return { id: current.id };
  });
}

export async function createNotebookArtifact(
  context: WorkspaceContext,
  notebookId: string,
  input: { type: NotebookArtifactType; title: string; modelId: string },
) {
  const notebook = await getNotebook(context, notebookId);
  if (!notebook) return null;
  const [artifact] = await getDb()
    .insert(notebookArtifacts)
    .values({
      notebookId,
      createdByUserId: context.userId,
      type: input.type,
      title: input.title,
      modelId: input.modelId,
      status: "pending",
    })
    .returning();
  return { artifact, notebook };
}

export async function markNotebookArtifactRunning(artifactId: string) {
  await getDb()
    .update(notebookArtifacts)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(notebookArtifacts.id, artifactId));
}

export async function completeNotebookArtifact(
  artifactId: string,
  input: { contentMarkdown: string; sourceSnapshotHash: string },
) {
  const [artifact] = await getDb()
    .update(notebookArtifacts)
    .set({
      contentMarkdown: input.contentMarkdown,
      sourceSnapshotHash: input.sourceSnapshotHash,
      status: "ready",
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(notebookArtifacts.id, artifactId))
    .returning();
  return serializeArtifact(artifact);
}

export async function failNotebookArtifact(artifactId: string, error: unknown) {
  await getDb()
    .update(notebookArtifacts)
    .set({
      status: "failed",
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : "生成失败。",
      updatedAt: new Date(),
    })
    .where(eq(notebookArtifacts.id, artifactId));
}

export async function deleteNotebookArtifact(
  context: WorkspaceContext,
  notebookId: string,
  artifactId: string,
) {
  const [deleted] = await getDb()
    .delete(notebookArtifacts)
    .where(
      and(
        eq(notebookArtifacts.id, artifactId),
        eq(notebookArtifacts.notebookId, notebookId),
        sql`exists (
          select 1 from ${notebooks}
          where ${notebooks.id} = ${notebookArtifacts.notebookId}
            and ${notebooks.workspaceId} = ${context.workspaceId}
        )`,
      ),
    )
    .returning({ id: notebookArtifacts.id });
  return deleted ?? null;
}

export async function updateNotebookArtifact(
  context: WorkspaceContext,
  notebookId: string,
  artifactId: string,
  input: { title?: string; contentMarkdown?: string },
) {
  const [updated] = await getDb()
    .update(notebookArtifacts)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(notebookArtifacts.id, artifactId),
        eq(notebookArtifacts.notebookId, notebookId),
        eq(notebookArtifacts.status, "ready"),
        sql`exists (
          select 1 from ${notebooks}
          where ${notebooks.id} = ${notebookArtifacts.notebookId}
            and ${notebooks.workspaceId} = ${context.workspaceId}
        )`,
      ),
    )
    .returning();
  return updated ? serializeArtifact(updated) : null;
}

export async function publishNotebookArtifact(
  context: WorkspaceContext,
  notebookId: string,
  artifactId: string,
) {
  const [row] = await getDb()
    .select({
      artifact: notebookArtifacts,
      knowledgeBaseId: notebooks.knowledgeBaseId,
    })
    .from(notebookArtifacts)
    .innerJoin(notebooks, eq(notebooks.id, notebookArtifacts.notebookId))
    .where(
      and(
        eq(notebookArtifacts.id, artifactId),
        eq(notebookArtifacts.notebookId, notebookId),
        eq(notebooks.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  if (!row || row.artifact.status !== "ready" || !row.artifact.contentMarkdown?.trim()) {
    return null;
  }
  if (row.artifact.publishedDocumentId) {
    return { documentId: row.artifact.publishedDocumentId, alreadyPublished: true };
  }

  const content = [
    `# ${row.artifact.title}`,
    "",
    "> 来源：Notebook Studio 用户确认的研究产物",
    "",
    row.artifact.contentMarkdown.trim(),
  ].join("\n");
  const document = await addKnowledgeDocument(context, {
    knowledgeBaseId: row.knowledgeBaseId,
    name: `${row.artifact.title.slice(0, 140)}.md`,
    mimeType: "text/markdown",
    byteSize: new TextEncoder().encode(content).byteLength,
    content,
  });
  if (!document) return null;
  await getDb()
    .update(notebookArtifacts)
    .set({ publishedDocumentId: document.id, updatedAt: new Date() })
    .where(
      and(
        eq(notebookArtifacts.id, artifactId),
        sql`${notebookArtifacts.publishedDocumentId} is null`,
      ),
    );
  return { documentId: document.id, alreadyPublished: false };
}

export async function getNotebookGenerationContext(
  context: WorkspaceContext,
  notebookId: string,
) {
  const notebook = await getNotebook(context, notebookId);
  if (!notebook) return null;
  const rows = await getDb()
    .select({
      documentId: knowledgeDocuments.id,
      documentName: knowledgeDocuments.name,
      documentUpdatedAt: knowledgeDocuments.updatedAt,
      chunkIndex: knowledgeChunks.chunkIndex,
      content: knowledgeChunks.content,
    })
    .from(knowledgeChunks)
    .innerJoin(
      knowledgeDocuments,
      eq(knowledgeDocuments.id, knowledgeChunks.documentId),
    )
    .where(
      and(
        eq(knowledgeChunks.knowledgeBaseId, notebook.knowledgeBaseId),
        eq(knowledgeDocuments.status, "ready"),
      ),
    )
    .orderBy(asc(knowledgeDocuments.id), asc(knowledgeChunks.chunkIndex))
    .limit(120);

  const snapshotHash = createHash("sha256")
    .update(
      rows
        .map((row) => `${row.documentId}:${row.documentUpdatedAt.toISOString()}`)
        .join("|"),
    )
    .digest("hex");
  let usedCharacters = 0;
  const excerpts: string[] = [];
  const sourceNumbers = new Map<string, number>();
  for (const row of rows) {
    if (usedCharacters >= 60_000) break;
    const sourceNumber =
      sourceNumbers.get(row.documentId) ?? sourceNumbers.size + 1;
    sourceNumbers.set(row.documentId, sourceNumber);
    const remaining = 60_000 - usedCharacters;
    const excerpt = row.content.slice(0, remaining);
    excerpts.push(`## 来源 ${sourceNumber}：${row.documentName}\n${excerpt}`);
    usedCharacters += excerpt.length;
  }
  return { notebook, snapshotHash, sourceText: excerpts.join("\n\n") };
}
