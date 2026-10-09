import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import { isSkillLibraryEnabled } from "@/server/skills/config";
import { upgradeCatalogSkill } from "@/server/skills/store";

const upgradeSchema = z.object({
  catalogVersion: z.string().trim().min(1).max(40),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSkillLibraryEnabled()) {
    return Response.json({ code: "SKILL_FEATURE_DISABLED" }, { status: 503 });
  }
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  const parsed = upgradeSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  const skill = await upgradeCatalogSkill(
    context,
    (await params).id,
    parsed.data.catalogVersion,
  );
  if (!skill) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ skill });
}
