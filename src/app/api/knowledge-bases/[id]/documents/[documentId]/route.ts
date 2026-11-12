import { after } from "next/server";
import { getWorkspaceContext } from "@/server/db/workspace";
import { processKnowledgeEmbeddingJobs } from "@/server/knowledge/embedding-jobs";
import {
  deleteKnowledgeDocument,
  retryKnowledgeDocumentEmbedding,
} from "@/server/knowledge/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id, documentId } = await params;
  const deleted = await deleteKnowledgeDocument(context, id, documentId);
  if (!deleted) return Response.json({ message: "文档不存在。" }, { status: 404 });
  return Response.json({ deleted: true });
}

/** Re-queues semantic indexing for a document whose embedding failed. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id, documentId } = await params;
  const result = await retryKnowledgeDocumentEmbedding(context, {
    knowledgeBaseId: id,
    documentId,
  });
  if (!result) return Response.json({ message: "文档不存在。" }, { status: 404 });
  if (!result.retried) {
    return Response.json(
      { message: "仅支持重试已解析且语义索引失败的文档，请确认语义索引服务已配置。" },
      { status: 409 },
    );
  }
  after(() =>
    processKnowledgeEmbeddingJobs({
      maxJobs: 1,
      maxChunksPerJob: 512,
      preferredDocumentId: documentId,
    }).then(
      () => undefined,
      // The job stays queued and the cron will pick it up; status is visible in the UI.
      () => undefined,
    ),
  );
  return Response.json({ retried: true }, { status: 202 });
}
