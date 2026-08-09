import {
  deleteAssistant,
  updateAssistant,
} from "@/server/assistants/store";
import { assistantInputSchema } from "@/server/assistants/validation";
import { getWorkspaceContext } from "@/server/db/workspace";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const parsed = assistantInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ message: "助手配置不正确。" }, { status: 400 });
  }
  const { id } = await params;
  const assistant = await updateAssistant(context, id, parsed.data);
  if (!assistant) return Response.json({ message: "助手不存在。" }, { status: 404 });
  return Response.json({ assistant });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteAssistant(context, id);
  if (!deleted) return Response.json({ message: "助手不存在。" }, { status: 404 });
  return Response.json({ deleted: true });
}
