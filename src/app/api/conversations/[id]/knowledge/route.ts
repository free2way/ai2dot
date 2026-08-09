import { z } from "zod";
import { conversationToKnowledgeText } from "@/lib/conversations";
import {
  getConversation,
  loadConversationMessages,
} from "@/server/chat/store";
import { getWorkspaceContext } from "@/server/db/workspace";
import { addKnowledgeDocument } from "@/server/knowledge/store";

const saveSchema = z.object({
  knowledgeBaseId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) {
    return Response.json(
      { code: "UNAUTHORIZED", message: "请登录后保存会话。" },
      { status: 401 },
    );
  }

  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "请选择目标知识库。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const [conversation, chatMessages] = await Promise.all([
    getConversation(context, id),
    loadConversationMessages(context, id, parsed.data.branchId),
  ]);
  if (!conversation || !chatMessages) {
    return Response.json(
      { code: "NOT_FOUND", message: "会话不存在。" },
      { status: 404 },
    );
  }
  const content = conversationToKnowledgeText(conversation.title, chatMessages);
  if (content === `# ${conversation.title}`) {
    return Response.json(
      { code: "EMPTY_CONVERSATION", message: "空会话不能保存到知识库。" },
      { status: 400 },
    );
  }

  try {
    const document = await addKnowledgeDocument(context, {
      knowledgeBaseId: parsed.data.knowledgeBaseId,
      name: `会话：${conversation.title}.md`,
      mimeType: "text/markdown",
      byteSize: new TextEncoder().encode(content).byteLength,
      content,
    });
    if (!document) {
      return Response.json(
        { code: "KNOWLEDGE_BASE_NOT_FOUND", message: "知识库不存在。" },
        { status: 404 },
      );
    }
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        code: "SAVE_FAILED",
        message: error instanceof Error ? error.message : "保存失败。",
      },
      { status: 400 },
    );
  }
}
