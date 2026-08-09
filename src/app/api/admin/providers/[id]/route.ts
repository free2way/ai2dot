import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import {
  deleteProviderConnection,
  updateProviderConnection,
} from "@/server/providers/store";

const updateProviderSchema = z.object({
  name: z.string().trim().min(2).max(80),
  baseUrl: z.string().url(),
  secret: z.string().trim().max(4_000).optional(),
  enabled: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const parsed = updateProviderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "供应商配置不完整。" },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const connection = await updateProviderConnection(context, id, parsed.data);
    if (!connection) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    return Response.json({ connection });
  } catch (error) {
    return Response.json(
      {
        code: "PROVIDER_UPDATE_FAILED",
        message: error instanceof Error ? error.message : "供应商更新失败。",
      },
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
  const connection = await deleteProviderConnection(context, id);
  if (!connection) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ connection });
}
