import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import {
  createMcpSource,
  listMcpSources,
} from "@/server/mcp/store";

const mcpSourceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  transport: z.enum(["http", "sse"]).default("http"),
  url: z.string().url(),
  secret: z.string().trim().max(4_000).optional(),
});

export async function GET() {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  return Response.json({ sources: await listMcpSources(context) });
}

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const parsed = mcpSourceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const source = await createMcpSource(context, parsed.data);
    return Response.json({ source }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        code: "MCP_SETUP_FAILED",
        message: error instanceof Error ? error.message : "MCP 来源保存失败。",
      },
      { status: 503 },
    );
  }
}
