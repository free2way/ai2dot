import { after } from "next/server";
import { z } from "zod";
import { buildVideoKnowledgeMarkdown, normalizeVideoTranscript } from "@/lib/video-sources";
import { getWorkspaceContext } from "@/server/db/workspace";
import { processKnowledgeEmbeddingJobs } from "@/server/knowledge/embedding-jobs";
import { failKnowledgeDocument, indexKnowledgeDocument } from "@/server/knowledge/store";
import { logServerEvent } from "@/server/observability/log";
import { createNotebookVideoSource } from "@/server/notebooks/store";
import { inspectVideoUrl } from "@/server/notebooks/video-metadata";

export const maxDuration = 300;

const createSchema = z.object({
  url: z.string().trim().url().max(2_000),
  transcript: z.string().trim().min(20).max(450_000),
  transcriptOrigin: z.enum(["pasted", "subtitle_upload"]),
  language: z.string().trim().max(40).optional(),
  rightsConfirmed: z.literal(true),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { message: "请输入有效的视频地址和字幕，并确认你有权处理这些内容。" },
      { status: 400 },
    );
  }
  const { id } = await params;

  try {
    const metadata = await inspectVideoUrl(parsed.data.url);
    const transcript = normalizeVideoTranscript(parsed.data.transcript);
    if (transcript.length < 20) {
      return Response.json({ message: "字幕或逐字稿内容过短。" }, { status: 400 });
    }
    const markdown = buildVideoKnowledgeMarkdown({
      ...metadata,
      language: parsed.data.language,
      transcript,
    });
    const created = await createNotebookVideoSource(context, id, {
      platform: metadata.platform,
      externalId: metadata.externalId,
      sourceUrl: metadata.sourceUrl,
      canonicalUrl: metadata.canonicalUrl,
      title: metadata.title,
      authorName: metadata.authorName,
      thumbnailUrl: metadata.thumbnailUrl,
      durationSeconds: metadata.durationSeconds,
      language: parsed.data.language || null,
      transcriptOrigin: parsed.data.transcriptOrigin,
      rightsConfirmed: true,
      metadata: metadata.metadata,
      byteSize: new TextEncoder().encode(markdown).byteLength,
    });
    if (created.status === "not_found") {
      return Response.json({ message: "研究空间不存在。" }, { status: 404 });
    }
    if (created.status === "duplicate") {
      return Response.json({ message: "这个视频已经添加到当前研究空间。" }, { status: 409 });
    }

    try {
      await indexKnowledgeDocument(context, {
        knowledgeBaseId: created.knowledgeBaseId,
        documentId: created.documentId,
        content: markdown,
      });
    } catch (error) {
      await failKnowledgeDocument(context, {
        knowledgeBaseId: created.knowledgeBaseId,
        documentId: created.documentId,
        error,
      });
      throw error;
    }

    after(async () => {
      const startedAt = Date.now();
      const embeddingResult = await processKnowledgeEmbeddingJobs({
        maxJobs: 1,
        maxChunksPerJob: 512,
        preferredDocumentId: created.documentId,
      });
      logServerEvent("info", "notebook.video_source_embedded", {
        workspaceId: context.workspaceId,
        notebookId: id,
        documentId: created.documentId,
        platform: metadata.platform,
        ...embeddingResult,
        latencyMs: Date.now() - startedAt,
      });
    });

    return Response.json(
      { source: created.source, documentId: created.documentId },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "视频来源导入失败。" },
      { status: 400 },
    );
  }
}
