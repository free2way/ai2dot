import { getWorkspaceContext } from "@/server/db/workspace";
import { searchKnowledge } from "@/server/knowledge/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return Response.json({ results: [] });
  return Response.json({ results: await searchKnowledge(context, [id], query, 8) });
}
