import { z } from "zod";
import { getWorkspaceContext } from "@/server/db/workspace";
import {
  deleteNotebook,
  getNotebook,
  updateNotebook,
} from "@/server/notebooks/store";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const notebook = await getNotebook(context, id);
  if (!notebook) return Response.json({ message: "研究空间不存在。" }, { status: 404 });
  return Response.json({ notebook });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ message: "更新内容不正确。" }, { status: 400 });
  const { id } = await params;
  const updated = await updateNotebook(context, id, parsed.data);
  if (!updated) return Response.json({ message: "研究空间不存在。" }, { status: 404 });
  return Response.json({ updated: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteNotebook(context, id);
  if (!deleted) return Response.json({ message: "研究空间不存在。" }, { status: 404 });
  return Response.json({ deleted: true });
}
