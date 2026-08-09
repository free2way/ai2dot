import { z } from "zod";
import {
  createConversation,
  listConversations,
} from "@/server/chat/store";
import { getWorkspaceContext } from "@/server/db/workspace";

const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) {
    return Response.json(
      { code: "UNAUTHORIZED", message: "请登录后查看云端会话。" },
      { status: 401 },
    );
  }

  return Response.json({ conversations: await listConversations(context) });
}

export async function POST(request: Request) {
  const context = await getWorkspaceContext();
  if (!context) {
    return Response.json(
      { code: "UNAUTHORIZED", message: "请登录后创建云端会话。" },
      { status: 401 },
    );
  }

  const parsed = createConversationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "会话参数不正确。" },
      { status: 400 },
    );
  }

  const conversation = await createConversation(context, parsed.data.title);
  return Response.json({ conversation }, { status: 201 });
}
