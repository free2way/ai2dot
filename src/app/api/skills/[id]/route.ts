import { getWorkspaceContext } from "@/server/db/workspace";
import { isExplicitSkillsEnabled } from "@/server/skills/config";
import { getSkillDocument } from "@/server/skills/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isExplicitSkillsEnabled()) {
    return Response.json({ code: "SKILL_FEATURE_DISABLED" }, { status: 503 });
  }
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const skill = await getSkillDocument(context, (await params).id);
  if (!skill) return Response.json({ code: "SKILL_NOT_AVAILABLE" }, { status: 404 });
  return Response.json({ skill });
}
