import { z } from "zod";
import {
  deleteConversation,
  getConversation,
  listConversationBranches,
  loadConversationMessages,
  updateConversation,
} from "@/server/chat/store";
import { getWorkspaceContext } from "@/server/db/workspace";

const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.archived !== undefined);

async function getAuthorizedContext() {
  return getWorkspaceContext();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthorizedContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const conversation = await getConversation(context, id);
  if (!conversation) return Response.json({ code: "NOT_FOUND" }, { status: 404 });

  const url = new URL(_request.url);
  const branchId = url.searchParams.get("branch") ?? undefined;
  const chatMessages = await loadConversationMessages(context, id, branchId);
  if (!chatMessages) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({
    conversation,
    messages: chatMessages,
    branches: await listConversationBranches(context, id),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthorizedContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const parsed = updateConversationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }

  const { id } = await params;
  const conversation = await updateConversation(context, id, parsed.data);
  if (!conversation) return Response.json({ code: "NOT_FOUND" }, { status: 404 });

  return Response.json({ conversation });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthorizedContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteConversation(context, id);
  return new Response(null, { status: deleted ? 204 : 404 });
}
