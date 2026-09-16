import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import {
  deleteMcpSource,
  updateMcpSource,
} from "@/server/mcp/store";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  transport: z.enum(["http", "sse"]),
  url: z.string().url(),
  secret: z.string().trim().max(4_000).optional(),
  enabled: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ code: "INVALID_REQUEST", message: "MCP 配置不完整。" }, { status: 400 });
  }
  try {
    const { id } = await params;
    const source = await updateMcpSource(context, id, parsed.data);
    if (!source) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    return Response.json({ source });
  } catch (error) {
    return Response.json(
      { code: "MCP_UPDATE_FAILED", message: error instanceof Error ? error.message : "MCP 来源更新失败。" },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const source = await deleteMcpSource(context, id);
  if (!source) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ source });
}
