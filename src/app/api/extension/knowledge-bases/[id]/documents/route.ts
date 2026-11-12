import { after } from "next/server";
import {
  extensionAuthErrorResponse,
  getChromeExtensionWorkspaceContext,
} from "@/server/extension/auth";
import {
  isKnowledgeRequestTooLarge,
  knowledgeErrorResponse,
  prepareKnowledgeUpload,
  REQUEST_TOO_LARGE_ERROR,
  startKnowledgeIngestion,
} from "@/server/knowledge/ingest";
import { listKnowledgeDocuments } from "@/server/knowledge/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NOT_FOUND = { code: "KNOWLEDGE_BASE_NOT_FOUND", message: "知识库不存在。" };

/** Document status for the extension's post-upload polling. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await getChromeExtensionWorkspaceContext(request);
  if (!authorized.ok) return extensionAuthErrorResponse(authorized);

  const { id } = await params;
  const documents = await listKnowledgeDocuments(authorized.context, id);
  if (!documents) return Response.json(NOT_FOUND, { status: 404 });
  return Response.json(
    {
      documents: documents.map((document) => ({
        id: document.id,
        name: document.name,
        status: document.status,
        errorMessage: document.errorMessage,
        embeddingStatus: document.embeddingStatus,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await getChromeExtensionWorkspaceContext(request);
  if (!authorized.ok) return extensionAuthErrorResponse(authorized);

  if (isKnowledgeRequestTooLarge(request)) {
    return knowledgeErrorResponse(REQUEST_TOO_LARGE_ERROR);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { code: "INVALID_DOCUMENT", message: "上传请求格式不正确。" },
      { status: 400 },
    );
  }
  const upload = await prepareKnowledgeUpload(form);
  if (!upload.ok) return knowledgeErrorResponse(upload);

  const { id } = await params;
  try {
    const started = await startKnowledgeIngestion(
      authorized.context,
      id,
      upload,
      "extension",
    );
    if (!started) return Response.json(NOT_FOUND, { status: 404 });
    after(started.run);
    return Response.json(
      { document: { id: started.document.id, status: "processing" } },
      { status: 202 },
    );
  } catch (error) {
    return Response.json(
      {
        code: "KNOWLEDGE_UPLOAD_FAILED",
        message: error instanceof Error ? error.message : "文档上传失败。",
      },
      { status: 400 },
    );
  }
}
