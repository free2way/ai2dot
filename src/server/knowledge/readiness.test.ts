import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import type { getDb } from "@/server/db";
import type { WorkspaceContext } from "@/server/db/workspace";
import * as schema from "@/server/db/schema";
import { addKnowledgeDocument, listKnowledgeDocuments, searchKnowledge } from "./store";
import { getNotebookGenerationContext } from "@/server/notebooks/store";

const mocks = vi.hoisted(() => ({ db: null as ReturnType<typeof getDb> | null, embeddingConfigured: false }));
vi.mock("@/server/db", () => ({ getDb: () => mocks.db! }));
vi.mock("@/server/knowledge/embeddings", () => ({
  isKnowledgeEmbeddingConfigured: () => mocks.embeddingConfigured,
  embedKnowledgeQuery: async () => null,
}));
const client = new PGlite({ extensions: { vector, pg_trgm } });
const db = drizzle(client, { schema });
let context: WorkspaceContext;
let baseId: string;
let notebookId: string;
let documentId: string;
beforeAll(async () => {
  mocks.db = db as unknown as ReturnType<typeof getDb>;
  await migrate(db, { migrationsFolder: "./drizzle" });
  const [user] = await db.insert(schema.users).values({ externalAuthId: "fixture-readiness" }).returning();
  const [workspace] = await db.insert(schema.workspaces).values({ name: "Fixture", ownerId: user.id }).returning();
  context = { userId: user.id, workspaceId: workspace.id, role: "owner" };
  const [base] = await db.insert(schema.knowledgeBases).values({ workspaceId: workspace.id, name: "Fixture" }).returning();
  baseId = base.id;
  const [notebook] = await db.insert(schema.notebooks).values({ workspaceId: workspace.id, knowledgeBaseId: baseId, title: "Fixture" }).returning();
  notebookId = notebook.id;
  const document = await addKnowledgeDocument(context, { knowledgeBaseId: baseId, name: "Fixture", mimeType: "text/plain", byteSize: 40, content: "fixture retrieval reference" });
  documentId = document!.id;
}, 30_000);
afterAll(async () => client.close());

describe("knowledge readiness without semantic configuration", () => {
  it("reports keyword availability and stops claiming that embeddings are running", async () => {
    const documents = await listKnowledgeDocuments(context, baseId);
    expect(documents).toEqual([expect.objectContaining({ status: "ready", embeddingStatus: "disabled" })]);
    expect(documents![0].embeddingError).toContain("关键词检索");
    const result = await searchKnowledge(context, [baseId], "fixture", 3);
    expect(result).toEqual([expect.objectContaining({ documentId, retrievalMode: "keyword" })]);
  });
  it("preserves queued work so configuration can be enabled later without reimporting", async () => {
    const [job] = await db.select().from(schema.knowledgeEmbeddingJobs).where(eq(schema.knowledgeEmbeddingJobs.documentId, documentId));
    expect(job).toMatchObject({ status: "pending", attempts: 0 });
    mocks.embeddingConfigured = true;
    try {
      expect((await listKnowledgeDocuments(context, baseId))![0].embeddingStatus).toBe("pending");
    } finally { mocks.embeddingConfigured = false; }
  });
  it("includes full notebook sources and rejects overflow rather than silently truncating", async () => {
    expect((await getNotebookGenerationContext(context, notebookId))!.sourceText).toContain("fixture retrieval reference");
    await db.insert(schema.knowledgeChunks).values(Array.from({ length: 120 }, (_, index) => ({
      knowledgeBaseId: baseId, documentId, chunkIndex: index + 1, content: "Additional fixture", tokenEstimate: 5,
    })));
    await expect(getNotebookGenerationContext(context, notebookId)).rejects.toThrow("120");
  });
  it("does not reveal a notebook or knowledge base to another workspace", async () => {
    const other = { ...context, workspaceId: "00000000-0000-4000-8000-000000000001" };
    expect(await getNotebookGenerationContext(other, notebookId)).toBeNull();
    expect(await listKnowledgeDocuments(other, baseId)).toBeNull();
  });
});
