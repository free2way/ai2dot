import { processKnowledgeEmbeddingJobs } from "@/server/knowledge/embedding-jobs";
import { logServerEvent } from "@/server/observability/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json(
      { code: "UNAUTHORIZED", message: "Unauthorized." },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  const result = await processKnowledgeEmbeddingJobs({
    maxJobs: 4,
    maxChunksPerJob: 128,
  });
  logServerEvent("info", "knowledge.embedding_cron_completed", {
    ...result,
    latencyMs: Date.now() - startedAt,
  });
  return Response.json({ ok: true, ...result });
}
