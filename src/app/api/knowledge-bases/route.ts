import { z } from "zod";
import { getWorkspaceContext } from "@/server/db/workspace";
import {
  createKnowledgeBase,
  listKnowledgeBases,
} from "@/server/knowledge/store";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
});

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  return Response.json({ knowledgeBases: await listKnowledgeBases(context) });
}

export async function POST(request: Request) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ message: "知识库名称不能为空，且不能超过 80 个字符。" }, { status: 400 });
  }
  const knowledgeBase = await createKnowledgeBase(context, parsed.data);
  return Response.json({ knowledgeBase }, { status: 201 });
}
