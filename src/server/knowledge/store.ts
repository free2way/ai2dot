import "server-only";

import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type {
  KnowledgeBaseSummary,
  KnowledgeDocumentSummary,
  KnowledgeSearchResult,
} from "@/lib/knowledge";
import { getDb } from "@/server/db";
import {
  knowledgeBases,
  knowledgeChunks,
  knowledgeDocuments,
} from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";

const MAX_DOCUMENT_CHARACTERS = 500_000;
const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 160;

export function splitKnowledgeText(source: string) {
  const text = source
    .replaceAll("\u0000", "")
    .replaceAll("\r\n", "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return [];
  if (text.length > MAX_DOCUMENT_CHARACTERS) {
    throw new Error("文档正文不能超过 500,000 个字符。");
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      const sentenceBreak = Math.max(
        text.lastIndexOf("。", end - 1),
        text.lastIndexOf(". ", end - 1),
      );
      const preferredBreak = Math.max(paragraphBreak, sentenceBreak);
      if (preferredBreak > start + Math.floor(CHUNK_SIZE * 0.55)) {
        end = preferredBreak + (text[preferredBreak] === "。" ? 1 : 0);
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

export function getKnowledgeSearchTerms(query: string) {
  const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const latinTerms = normalized.split(/\s+/).filter((term) => term.length >= 2);
  const chineseRuns = query.match(/[\p{Script=Han}]+/gu) ?? [];
  const chineseTerms = chineseRuns.flatMap((run) => {
    if (run.length <= 2) return [run];
    return Array.from({ length: run.length - 1 }, (_, index) =>
      run.slice(index, index + 2),
    );
  });
  return [...new Set([...latinTerms, ...chineseTerms])].slice(0, 24);
}

export function scoreKnowledgeText(content: string, query: string) {
  const haystack = content.toLowerCase();
  const terms = getKnowledgeSearchTerms(query);
  if (terms.length === 0) return 0;
  let matches = 0;
  for (const term of terms) {
    if (haystack.includes(term.toLowerCase())) matches += 1;
  }
  const phraseBonus = haystack.includes(query.trim().toLowerCase()) ? 2 : 0;
  return Number(((matches + phraseBonus) / (terms.length + 2)).toFixed(4));
}

export function rankKnowledgeResults(
  rows: Omit<KnowledgeSearchResult, "score">[],
  query: string,
  limit: number,
) {
  const ranked = rows
    .map((row) => ({ ...row, score: scoreKnowledgeText(row.content, query) }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score);
  const selected: KnowledgeSearchResult[] = [];
  const perDocument = new Map<string, number>();

  for (const row of ranked) {
    const documentCount = perDocument.get(row.documentId) ?? 0;
    if (documentCount >= 2) continue;
    selected.push(row);
    perDocument.set(row.documentId, documentCount + 1);
    if (selected.length >= Math.min(limit, 10)) break;
  }

  return selected;
}

export async function listKnowledgeBases(
  context: WorkspaceContext,
): Promise<KnowledgeBaseSummary[]> {
  const db = getDb();
  const bases = await db
    .select({
      id: knowledgeBases.id,
      name: knowledgeBases.name,
      description: knowledgeBases.description,
      updatedAt: knowledgeBases.updatedAt,
    })
    .from(knowledgeBases)
    .where(eq(knowledgeBases.workspaceId, context.workspaceId))
    .orderBy(desc(knowledgeBases.updatedAt));

  if (bases.length === 0) return [];
  const ids = bases.map((base) => base.id);
  const [documentCounts, chunkCounts] = await Promise.all([
    db
      .select({
        knowledgeBaseId: knowledgeDocuments.knowledgeBaseId,
        value: count(knowledgeDocuments.id),
      })
      .from(knowledgeDocuments)
      .where(inArray(knowledgeDocuments.knowledgeBaseId, ids))
      .groupBy(knowledgeDocuments.knowledgeBaseId),
    db
      .select({
        knowledgeBaseId: knowledgeChunks.knowledgeBaseId,
        value: count(knowledgeChunks.id),
      })
      .from(knowledgeChunks)
      .where(inArray(knowledgeChunks.knowledgeBaseId, ids))
      .groupBy(knowledgeChunks.knowledgeBaseId),
  ]);
  const documentsByBase = new Map(
    documentCounts.map((item) => [item.knowledgeBaseId, item.value]),
  );
  const chunksByBase = new Map(
    chunkCounts.map((item) => [item.knowledgeBaseId, item.value]),
  );

  return bases.map((base) => ({
    id: base.id,
    name: base.name,
    description: base.description ?? "",
    documentCount: documentsByBase.get(base.id) ?? 0,
    chunkCount: chunksByBase.get(base.id) ?? 0,
    updatedAt: base.updatedAt.toISOString(),
  }));
}

export async function listKnowledgeDocuments(
  context: WorkspaceContext,
  knowledgeBaseId: string,
): Promise<KnowledgeDocumentSummary[] | null> {
  const [ownedBase] = await getDb()
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(
      and(
        eq(knowledgeBases.id, knowledgeBaseId),
        eq(knowledgeBases.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  if (!ownedBase) return null;

  const rows = await getDb()
    .select({
      id: knowledgeDocuments.id,
      knowledgeBaseId: knowledgeDocuments.knowledgeBaseId,
      name: knowledgeDocuments.name,
      mimeType: knowledgeDocuments.mimeType,
      byteSize: knowledgeDocuments.byteSize,
      characterCount: knowledgeDocuments.characterCount,
      status: knowledgeDocuments.status,
      errorMessage: knowledgeDocuments.errorMessage,
      updatedAt: knowledgeDocuments.updatedAt,
      chunkCount: count(knowledgeChunks.id),
    })
    .from(knowledgeDocuments)
    .leftJoin(
      knowledgeChunks,
      eq(knowledgeChunks.documentId, knowledgeDocuments.id),
    )
    .where(eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId))
    .groupBy(knowledgeDocuments.id)
    .orderBy(desc(knowledgeDocuments.updatedAt));

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createKnowledgeBase(
  context: WorkspaceContext,
  input: { name: string; description?: string },
) {
  const [created] = await getDb()
    .insert(knowledgeBases)
    .values({
      workspaceId: context.workspaceId,
      name: input.name,
      description: input.description || null,
    })
    .returning({ id: knowledgeBases.id });
  return created;
}

export async function deleteKnowledgeBase(
  context: WorkspaceContext,
  knowledgeBaseId: string,
) {
  const [deleted] = await getDb()
    .delete(knowledgeBases)
    .where(
      and(
        eq(knowledgeBases.id, knowledgeBaseId),
        eq(knowledgeBases.workspaceId, context.workspaceId),
      ),
    )
    .returning({ id: knowledgeBases.id });
  return deleted ?? null;
}

export async function addKnowledgeDocument(
  context: WorkspaceContext,
  input: {
    knowledgeBaseId: string;
    name: string;
    mimeType: string;
    byteSize: number;
    content: string;
  },
) {
  const document = await createKnowledgeDocument(context, input);
  if (!document) return null;
  const indexed = await indexKnowledgeDocument(context, {
    knowledgeBaseId: input.knowledgeBaseId,
    documentId: document.id,
    content: input.content,
  });
  return indexed;
}

export async function createKnowledgeDocument(
  context: WorkspaceContext,
  input: {
    knowledgeBaseId: string;
    name: string;
    mimeType: string;
    byteSize: number;
  },
) {
  const db = getDb();
  const [ownedBase] = await db
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(
      and(
        eq(knowledgeBases.id, input.knowledgeBaseId),
        eq(knowledgeBases.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  if (!ownedBase) return null;

  const [document] = await db
    .insert(knowledgeDocuments)
    .values({
      knowledgeBaseId: input.knowledgeBaseId,
      name: input.name,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      characterCount: 0,
      status: "processing",
    })
    .returning({ id: knowledgeDocuments.id });

  return document;
}

export async function indexKnowledgeDocument(
  context: WorkspaceContext,
  input: {
    knowledgeBaseId: string;
    documentId: string;
    content: string;
  },
) {
  const db = getDb();
  const [ownedDocument] = await db
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .innerJoin(
      knowledgeBases,
      eq(knowledgeBases.id, knowledgeDocuments.knowledgeBaseId),
    )
    .where(
      and(
        eq(knowledgeDocuments.id, input.documentId),
        eq(knowledgeDocuments.knowledgeBaseId, input.knowledgeBaseId),
        eq(knowledgeBases.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  if (!ownedDocument) throw new Error("知识库文档不存在。");

  const chunks = splitKnowledgeText(input.content);
  if (chunks.length === 0) throw new Error("文档没有可索引的文本内容。");

  try {
    await db.insert(knowledgeChunks).values(
      chunks.map((content, chunkIndex) => ({
        knowledgeBaseId: input.knowledgeBaseId,
        documentId: input.documentId,
        chunkIndex,
        content,
        tokenEstimate: Math.ceil(content.length / 2.5),
      })),
    );
    await db
      .update(knowledgeDocuments)
      .set({
        characterCount: input.content.length,
        status: "ready",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, input.documentId));
    await db
      .update(knowledgeBases)
      .set({ updatedAt: new Date() })
      .where(eq(knowledgeBases.id, input.knowledgeBaseId));
  } catch (error) {
    await db
      .update(knowledgeDocuments)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "索引失败",
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, input.documentId));
    throw error;
  }

  return { id: input.documentId, chunkCount: chunks.length };
}

export async function failKnowledgeDocument(
  context: WorkspaceContext,
  input: { knowledgeBaseId: string; documentId: string; error: unknown },
) {
  const [ownedDocument] = await getDb()
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .innerJoin(
      knowledgeBases,
      eq(knowledgeBases.id, knowledgeDocuments.knowledgeBaseId),
    )
    .where(
      and(
        eq(knowledgeDocuments.id, input.documentId),
        eq(knowledgeDocuments.knowledgeBaseId, input.knowledgeBaseId),
        eq(knowledgeBases.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  if (!ownedDocument) return null;

  const [updated] = await getDb()
    .update(knowledgeDocuments)
    .set({
      status: "failed",
      errorMessage:
        input.error instanceof Error
          ? input.error.message.slice(0, 500)
          : "文档解析失败。",
      updatedAt: new Date(),
    })
    .where(eq(knowledgeDocuments.id, input.documentId))
    .returning({ id: knowledgeDocuments.id });
  return updated ?? null;
}

export async function deleteKnowledgeDocument(
  context: WorkspaceContext,
  knowledgeBaseId: string,
  documentId: string,
) {
  const [ownedDocument] = await getDb()
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .innerJoin(
      knowledgeBases,
      eq(knowledgeBases.id, knowledgeDocuments.knowledgeBaseId),
    )
    .where(
      and(
        eq(knowledgeDocuments.id, documentId),
        eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId),
        eq(knowledgeBases.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  if (!ownedDocument) return null;
  const [deleted] = await getDb()
    .delete(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, documentId))
    .returning({ id: knowledgeDocuments.id });
  return deleted ?? null;
}

export async function searchKnowledge(
  context: WorkspaceContext,
  knowledgeBaseIds: string[],
  query: string,
  limit = 6,
): Promise<KnowledgeSearchResult[]> {
  if (knowledgeBaseIds.length === 0 || !query.trim()) return [];
  const uniqueIds = [...new Set(knowledgeBaseIds)].slice(0, 3);
  const terms = getKnowledgeSearchTerms(query).slice(0, 16);
  if (terms.length === 0) return [];
  const rows = await getDb()
    .select({
      chunkId: knowledgeChunks.id,
      documentId: knowledgeDocuments.id,
      documentName: knowledgeDocuments.name,
      knowledgeBaseId: knowledgeBases.id,
      knowledgeBaseName: knowledgeBases.name,
      mimeType: knowledgeDocuments.mimeType,
      content: knowledgeChunks.content,
    })
    .from(knowledgeChunks)
    .innerJoin(
      knowledgeDocuments,
      eq(knowledgeDocuments.id, knowledgeChunks.documentId),
    )
    .innerJoin(
      knowledgeBases,
      eq(knowledgeBases.id, knowledgeChunks.knowledgeBaseId),
    )
    .where(
      and(
        eq(knowledgeBases.workspaceId, context.workspaceId),
        eq(knowledgeDocuments.status, "ready"),
        inArray(knowledgeBases.id, uniqueIds),
        or(...terms.map((term) => ilike(knowledgeChunks.content, `%${term}%`))),
      ),
    )
    .limit(1_600);

  return rankKnowledgeResults(rows, query, limit);
}
