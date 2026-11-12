import { after } from "next/server";
import { getWorkspaceContext } from "@/server/db/workspace";
import {
  isKnowledgeRequestTooLarge,
  knowledgeErrorResponse,
  prepareKnowledgeUpload,
  REQUEST_TOO_LARGE_ERROR,
  startKnowledgeIngestion,
} from "@/server/knowledge/ingest";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });

  if (isKnowledgeRequestTooLarge(request)) {
    return knowledgeErrorResponse(REQUEST_TOO_LARGE_ERROR);
  }

  const { id } = await params;
  const upload = await prepareKnowledgeUpload(await request.formData());
  if (!upload.ok) return knowledgeErrorResponse(upload);

  try {
    const started = await startKnowledgeIngestion(context, id, upload, "web");
    if (!started) return Response.json({ message: "知识库不存在。" }, { status: 404 });
    after(started.run);
    return Response.json(
      { document: { ...started.document, status: "processing" } },
      { status: 202 },
    );
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "文档索引失败。" },
      { status: 400 },
    );
  }
}
