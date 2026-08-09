import { z } from "zod";
import {
  forkConversationBranch,
  listConversationBranches,
} from "@/server/chat/store";
import { getWorkspaceContext } from "@/server/db/workspace";

const forkBranchSchema = z.object({
  sourceBranchId: z.string().uuid(),
  fromMessageId: z.string().min(1).max(160),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const branches = await listConversationBranches(context, id);
  if (!branches) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ branches });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const parsed = forkBranchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "分支参数不正确。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const result = await forkConversationBranch({
    context,
    conversationId: id,
    sourceBranchId: parsed.data.sourceBranchId,
    fromMessageId: parsed.data.fromMessageId,
  });
  if (!result) {
    return Response.json(
      { code: "BRANCH_SOURCE_NOT_FOUND", message: "分支起点不存在。" },
      { status: 404 },
    );
  }

  return Response.json(result, { status: 201 });
}

