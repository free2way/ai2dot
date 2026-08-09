import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import { setProviderModelEnabled } from "@/server/providers/store";

const updateModelSchema = z.object({ enabled: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const parsed = updateModelSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });

  const { id } = await params;
  const model = await setProviderModelEnabled(context, id, parsed.data.enabled);
  if (!model) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ model });
}
