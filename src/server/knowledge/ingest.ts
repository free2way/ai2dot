import "server-only";

import type { WorkspaceContext } from "@/server/db/workspace";
import { processKnowledgeEmbeddingJobs } from "@/server/knowledge/embedding-jobs";
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
  MAX_KNOWLEDGE_DOCUMENT_CHARACTERS,
} from "@/server/knowledge/store";
import { logServerEvent } from "@/server/observability/log";

// Multipart framing adds a small overhead on top of the file itself.
export const MAX_KNOWLEDGE_REQUEST_BYTES = MAX_KNOWLEDGE_FILE_SIZE + 1024 * 1024;

export type KnowledgeUploadError = {
  ok: false;
  status: 400 | 413 | 415;
  code: "INVALID_DOCUMENT" | "DOCUMENT_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE";
  message: string;
};

export type PreparedKnowledgeUpload = {
  ok: true;
  name: string;
  mimeType: string;
  byteSize: number;
  content?: string;
  fileBytes?: Uint8Array;
  fileKind: ReturnType<typeof resolveKnowledgeFileKind>;
};

export function knowledgeErrorResponse(error: KnowledgeUploadError) {
  return Response.json(
    { code: error.code, message: error.message },
    { status: error.status },
  );
}

export function isKnowledgeRequestTooLarge(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  return Number.isFinite(declaredLength) && declaredLength > MAX_KNOWLEDGE_REQUEST_BYTES;
}

export const REQUEST_TOO_LARGE_ERROR: KnowledgeUploadError = {
  ok: false,
  status: 413,
  code: "DOCUMENT_TOO_LARGE",
  message: "上传内容不能超过 5MB。",
};

/** Validates either an uploaded file or pasted text from a multipart form. */
export async function prepareKnowledgeUpload(
  form: FormData,
): Promise<PreparedKnowledgeUpload | KnowledgeUploadError> {
  const file = form.get("file");
  const pastedContent = String(form.get("content") ?? "").trim();
  const pastedName = String(form.get("name") ?? "").trim();

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_KNOWLEDGE_FILE_SIZE) {
      return { ok: false, status: 413, code: "DOCUMENT_TOO_LARGE", message: "单个文件不能超过 4MB。" };
    }
    const fileKind = resolveKnowledgeFileKind(file.name, file.type);
    if (!fileKind) {
      return {
        ok: false,
        status: 415,
        code: "UNSUPPORTED_FILE_TYPE",
        message: "当前支持 PDF、DOCX、TXT、Markdown、CSV 和 JSON 文件。",
      };
    }
    return {
      ok: true,
      name: sanitizeKnowledgeFileName(file.name) || "未命名文档",
      mimeType:
        file.type ||
        (fileKind === "pdf"
          ? "application/pdf"
          : fileKind === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "text/plain"),
      byteSize: file.size,
      fileBytes: new Uint8Array(await file.arrayBuffer()),
      fileKind,
    };
  }

  if (!pastedName || !pastedContent) {
    return { ok: false, status: 400, code: "INVALID_DOCUMENT", message: "请输入文档名称和正文。" };
  }
  if (pastedContent.length > MAX_KNOWLEDGE_DOCUMENT_CHARACTERS) {
    return {
      ok: false,
      status: 413,
      code: "DOCUMENT_TOO_LARGE",
      message: "文档正文不能超过 500,000 个字符。",
    };
  }
  return {
    ok: true,
    name: sanitizeKnowledgeFileName(pastedName) || "未命名文档",
    mimeType: /\.(md|markdown)$/i.test(pastedName) ? "text/markdown" : "text/plain",
    byteSize: new TextEncoder().encode(pastedContent).byteLength,
    content: pastedContent,
    fileKind: null,
  };
}

/**
 * Creates the document row and returns a background task that extracts,
 * chunks and embeds it. Callers schedule `run` with `after()`.
 * Returns null when the knowledge base is not in the caller's workspace.
 */
export async function startKnowledgeIngestion(
  context: WorkspaceContext,
  knowledgeBaseId: string,
  upload: PreparedKnowledgeUpload,
  source: "web" | "extension",
) {
  const document = await createKnowledgeDocument(context, {
    knowledgeBaseId,
    name: upload.name,
    mimeType: upload.mimeType,
    byteSize: upload.byteSize,
  });
  if (!document) return null;

  const run = async () => {
    const startedAt = Date.now();
    const fields = {
      source,
      workspaceId: context.workspaceId,
      knowledgeBaseId,
      documentId: document.id,
      mimeType: upload.mimeType,
    };
    try {
      const extractedContent =
        upload.content ??
        (upload.fileBytes && upload.fileKind
          ? await extractKnowledgeFileContent({ bytes: upload.fileBytes, kind: upload.fileKind })
          : "");
      const indexed = await indexKnowledgeDocument(context, {
        knowledgeBaseId,
        documentId: document.id,
        content: extractedContent,
      });
      logServerEvent("info", "knowledge.document_indexed", {
        ...fields,
        chunkCount: indexed.chunkCount,
        latencyMs: Date.now() - startedAt,
      });
      const embeddingResult = await processKnowledgeEmbeddingJobs({
        maxJobs: 1,
        maxChunksPerJob: 512,
        preferredDocumentId: document.id,
      });
      logServerEvent("info", "knowledge.document_embedded", {
        ...fields,
        ...embeddingResult,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      await failKnowledgeDocument(context, {
        knowledgeBaseId,
        documentId: document.id,
        error,
      });
      logServerEvent("error", "knowledge.document_failed", {
        ...fields,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
      });
    }
  };

  return { document, run };
}
