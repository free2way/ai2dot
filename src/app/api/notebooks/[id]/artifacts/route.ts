import { z } from "zod";
import { getWorkspaceContext } from "@/server/db/workspace";
import { generateNotebookArtifact } from "@/server/notebooks/generate";
import { createNotebookArtifact, getNotebook } from "@/server/notebooks/store";

export const maxDuration = 300;

const labels = {
  summary: "研究摘要",
  faq: "常见问题",
  timeline: "时间线",
  study_guide: "学习指南",
  mind_map: "思维导图",
} as const;

const createSchema = z.object({
  type: z.enum(["summary", "faq", "timeline", "study_guide", "mind_map"]),
  modelId: z.string().trim().min(1).max(160),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const notebook = await getNotebook(context, id);
  if (!notebook) return Response.json({ message: "研究空间不存在。" }, { status: 404 });
  return Response.json({ artifacts: notebook.artifacts });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ message: "产物类型或模型无效。" }, { status: 400 });
  const { id } = await params;
  const created = await createNotebookArtifact(context, id, {
    ...parsed.data,
    title: `${labels[parsed.data.type]} · ${new Date().toLocaleDateString("zh-CN")}`,
  });
  if (!created) return Response.json({ message: "研究空间不存在。" }, { status: 404 });
  try {
    const artifact = await generateNotebookArtifact({
      context,
      notebookId: id,
      artifactId: created.artifact.id,
      ...parsed.data,
    });
    return Response.json({ artifact }, { status: 201 });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "研究产物生成失败。" },
      { status: 502 },
    );
  }
}
