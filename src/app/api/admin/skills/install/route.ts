import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import { isSkillLibraryEnabled } from "@/server/skills/config";
import { installCatalogSkill } from "@/server/skills/store";

const installSchema = z.object({
  catalogId: z.string().trim().min(1).max(80),
  catalogVersion: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  if (!isSkillLibraryEnabled()) {
    return Response.json({ code: "SKILL_FEATURE_DISABLED" }, { status: 503 });
  }
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  const parsed = installSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  try {
    const skill = await installCatalogSkill(
      context,
      parsed.data.catalogId,
      parsed.data.catalogVersion,
    );
    if (!skill) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    return Response.json({ skill }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        code: "SKILL_INSTALL_FAILED",
        message: error instanceof Error ? error.message : "Skill 安装失败。",
      },
      { status: 400 },
    );
  }
}
