import { getWorkspaceContext } from "@/server/db/workspace";
import { deleteNotebookArtifact, updateNotebookArtifact } from "@/server/notebooks/store";
import { z } from "zod";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    contentMarkdown: z.string().trim().min(1).max(500_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; artifactId: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ message: "研究产物内容不正确。" }, { status: 400 });
  const { id, artifactId } = await params;
  const artifact = await updateNotebookArtifact(context, id, artifactId, parsed.data);
  if (!artifact) return Response.json({ message: "研究产物不存在或暂不可编辑。" }, { status: 404 });
  return Response.json({ artifact });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; artifactId: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id, artifactId } = await params;
  const deleted = await deleteNotebookArtifact(context, id, artifactId);
  if (!deleted) return Response.json({ message: "研究产物不存在。" }, { status: 404 });
  return Response.json({ deleted: true });
}
