import { z } from "zod";
import { getWorkspaceContext } from "@/server/db/workspace";
import { createNotebook, listNotebooks } from "@/server/notebooks/store";

const createSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const includeArchived = new URL(request.url).searchParams.get("archived") === "true";
  return Response.json({ notebooks: await listNotebooks(context, { includeArchived }) });
}

export async function POST(request: Request) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { message: "名称不能为空，且不能超过 100 个字符。" },
      { status: 400 },
    );
  }
  const notebook = await createNotebook(context, parsed.data);
  return Response.json({ notebook }, { status: 201 });
}
