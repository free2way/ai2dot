import { after } from "next/server";
import { getWorkspaceContext } from "@/server/db/workspace";
import { processKnowledgeEmbeddingJobs } from "@/server/knowledge/embedding-jobs";
import { publishNotebookArtifact } from "@/server/notebooks/store";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; artifactId: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id, artifactId } = await params;
  const published = await publishNotebookArtifact(context, id, artifactId);
  if (!published) {
    return Response.json({ message: "研究产物不存在或尚未生成完成。" }, { status: 404 });
  }
  if (!published.alreadyPublished) {
    after(() =>
      processKnowledgeEmbeddingJobs({
        maxJobs: 1,
        maxChunksPerJob: 512,
        preferredDocumentId: published.documentId,
      }),
    );
  }
  return Response.json(published, { status: published.alreadyPublished ? 200 : 201 });
}
