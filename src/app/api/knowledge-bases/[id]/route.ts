import { getWorkspaceContext } from "@/server/db/workspace";
import {
  deleteKnowledgeBase,
  listKnowledgeDocuments,
} from "@/server/knowledge/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const documents = await listKnowledgeDocuments(context, id);
  if (!documents) return Response.json({ message: "知识库不存在。" }, { status: 404 });
  return Response.json({ documents });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteKnowledgeBase(context, id);
  if (!deleted) return Response.json({ message: "知识库不存在。" }, { status: 404 });
  return Response.json({ deleted: true });
}
