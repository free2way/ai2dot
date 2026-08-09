import {
  createAssistant,
  listAssistants,
} from "@/server/assistants/store";
import { assistantInputSchema } from "@/server/assistants/validation";
import { getWorkspaceContext } from "@/server/db/workspace";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  return Response.json({ assistants: await listAssistants(context) });
}

export async function POST(request: Request) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const parsed = assistantInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { message: "请填写助手名称和系统提示词，并最多选择 3 个知识库。" },
      { status: 400 },
    );
  }
  const assistant = await createAssistant(context, parsed.data);
  return Response.json({ assistant }, { status: 201 });
}
