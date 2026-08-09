import { getAdminWorkspaceContext } from "@/server/db/workspace";
import { syncProviderConnection } from "@/server/providers/store";

export const maxDuration = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const { id } = await params;
  try {
    const result = await syncProviderConnection(context, id);
    if (!result) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        code: "SYNC_FAILED",
        message: error instanceof Error ? error.message : "模型目录刷新失败。",
      },
      { status: 502 },
    );
  }
}
