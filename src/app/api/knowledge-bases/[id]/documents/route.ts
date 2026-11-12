import { after } from "next/server";
import { getWorkspaceContext } from "@/server/db/workspace";
import {
  knowledgeErrorResponse,
  readKnowledgeUpload,
  startKnowledgeIngestion,
} from "@/server/knowledge/ingest";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });

  const { id } = await params;
  const upload = await readKnowledgeUpload(request);
  if (!upload.ok) return knowledgeErrorResponse(upload);

  try {
    const started = await startKnowledgeIngestion(context, id, upload, "web");
    if (!started) return Response.json({ message: "知识库不存在。" }, { status: 404 });
    after(started.run);
    return Response.json(
      { document: { ...started.document, status: "processing" } },
      { status: 202 },
    );
  } catch {
    return Response.json(
      { message: "文档上传失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
