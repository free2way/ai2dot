import { getWorkspaceContext } from "@/server/db/workspace";
import { deleteKnowledgeDocument } from "@/server/knowledge/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id, documentId } = await params;
  const deleted = await deleteKnowledgeDocument(context, id, documentId);
  if (!deleted) return Response.json({ message: "文档不存在。" }, { status: 404 });
  return Response.json({ deleted: true });
}
