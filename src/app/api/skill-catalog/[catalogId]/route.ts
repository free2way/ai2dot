import { getWorkspaceContext } from "@/server/db/workspace";
import { isSkillLibraryEnabled } from "@/server/skills/config";
import { getCatalogSkill } from "@/server/skills/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  if (!isSkillLibraryEnabled()) {
    return Response.json({ code: "SKILL_FEATURE_DISABLED" }, { status: 503 });
  }
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const skill = await getCatalogSkill(context, (await params).catalogId);
  if (!skill) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ skill });
}
