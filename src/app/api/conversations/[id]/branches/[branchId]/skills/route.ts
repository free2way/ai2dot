import { z } from "zod";
import { skillSelectionSchema } from "@/lib/skill-selection";
import {
  getEffectiveBranchSkillSelection,
  updateConversationBranchSkillSelection,
} from "@/server/chat/store";
import { getWorkspaceContext } from "@/server/db/workspace";
import { isExplicitSkillsEnabled } from "@/server/skills/config";
import { resolveExplicitSkillVersions } from "@/server/skills/store";

const updateSchema = z.object({
  expectedRevision: z.number().int().min(0),
  selection: skillSelectionSchema.nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; branchId: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const { id, branchId } = await params;
  const state = await getEffectiveBranchSkillSelection(context, id, branchId);
  if (!state) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json(state);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; branchId: string }> },
) {
  if (!isExplicitSkillsEnabled()) {
    return Response.json({ code: "SKILL_FEATURE_DISABLED" }, { status: 503 });
  }
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ code: "INVALID_SKILL_SELECTION" }, { status: 400 });
  }
  const { id, branchId } = await params;
  if (parsed.data.selection?.refs.length) {
    const resolved = await resolveExplicitSkillVersions(
      context,
      parsed.data.selection.refs,
      "branch",
    );
    if (resolved.some((item) => !item)) {
      return Response.json({ code: "SKILL_NOT_AVAILABLE" }, { status: 404 });
    }
    if (resolved.some((item) => item?.revoked)) {
      return Response.json({ code: "SKILL_VERSION_REVOKED" }, { status: 409 });
    }
  }
  const result = await updateConversationBranchSkillSelection({
    context,
    conversationId: id,
    branchId,
    expectedRevision: parsed.data.expectedRevision,
    selection: parsed.data.selection,
  });
  if (result.kind === "not_found") {
    return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return Response.json(
      { code: "SKILL_SELECTION_CONFLICT", message: "配置已被其他窗口更新，请重新加载。" },
      { status: 409 },
    );
  }
  return Response.json(result);
}
