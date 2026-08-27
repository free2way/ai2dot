import { after } from "next/server";
import { getWorkspaceContext } from "@/server/db/workspace";
import {
  extractKnowledgeFileContent,
  MAX_KNOWLEDGE_FILE_SIZE,
  resolveKnowledgeFileKind,
  sanitizeKnowledgeFileName,
} from "@/server/knowledge/extract";
import {
  createKnowledgeDocument,
  failKnowledgeDocument,
  indexKnowledgeDocument,
} from "@/server/knowledge/store";
import { logServerEvent } from "@/server/observability/log";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const form = await request.formData();
  const file = form.get("file");
  const pastedContent = String(form.get("content") ?? "").trim();
  const pastedName = String(form.get("name") ?? "").trim();

  let name: string;
  let mimeType: string;
  let byteSize: number;
  let content: string | undefined;
  let fileBytes: Uint8Array | undefined;
  let fileKind: ReturnType<typeof resolveKnowledgeFileKind> = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_KNOWLEDGE_FILE_SIZE) {
      return Response.json({ message: "单个文件不能超过 4MB。" }, { status: 413 });
    }
    fileKind = resolveKnowledgeFileKind(file.name, file.type);
    if (!fileKind) {
      return Response.json(
        { message: "当前支持 PDF、DOCX、TXT、Markdown、CSV 和 JSON 文件。" },
        { status: 415 },
      );
    }
    name = sanitizeKnowledgeFileName(file.name) || "未命名文档";
    mimeType =
      file.type ||
      (fileKind === "pdf"
        ? "application/pdf"
        : fileKind === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "text/plain");
    byteSize = file.size;
    fileBytes = new Uint8Array(await file.arrayBuffer());
  } else {
    if (!pastedName || !pastedContent) {
      return Response.json({ message: "请输入文档名称和正文。" }, { status: 400 });
    }
    name = pastedName.slice(0, 160);
    mimeType = "text/plain";
    byteSize = new TextEncoder().encode(pastedContent).byteLength;
    content = pastedContent;
  }

  try {
    const document = await createKnowledgeDocument(context, {
      knowledgeBaseId: id,
      name,
      mimeType,
      byteSize,
    });
    if (!document) return Response.json({ message: "知识库不存在。" }, { status: 404 });

    const indexDocument = async () => {
      const startedAt = Date.now();
      try {
        const extractedContent =
          content ??
          (fileBytes && fileKind
            ? await extractKnowledgeFileContent({ bytes: fileBytes, kind: fileKind })
            : "");
        const indexed = await indexKnowledgeDocument(context, {
          knowledgeBaseId: id,
          documentId: document.id,
          content: extractedContent,
        });
        logServerEvent("info", "knowledge.document_indexed", {
          workspaceId: context.workspaceId,
          knowledgeBaseId: id,
          documentId: document.id,
          mimeType,
          chunkCount: indexed.chunkCount,
          latencyMs: Date.now() - startedAt,
        });
      } catch (error) {
        await failKnowledgeDocument(context, {
          knowledgeBaseId: id,
          documentId: document.id,
          error,
        });
        logServerEvent("error", "knowledge.document_failed", {
          workspaceId: context.workspaceId,
          knowledgeBaseId: id,
          documentId: document.id,
          mimeType,
          error: error instanceof Error ? error.message : String(error),
          latencyMs: Date.now() - startedAt,
        });
      }
    };

    after(indexDocument);
    return Response.json(
      { document: { ...document, status: "processing" } },
      { status: 202 },
    );
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "文档索引失败。" },
      { status: 400 },
    );
  }
}
