import { getAdminWorkspaceContext } from "@/server/db/workspace";
import { syncMcpSource } from "@/server/mcp/store";

export const maxDuration = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  try {
    const source = await syncMcpSource(context, id);
    if (!source) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    return Response.json({ source });
  } catch (error) {
    return Response.json(
      { code: "MCP_SYNC_FAILED", message: error instanceof Error ? error.message : "MCP 工具同步失败。" },
      { status: 502 },
    );
  }
}
