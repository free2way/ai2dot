import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import { createSkill, listSkills } from "@/server/skills/store";

const skillSchema = z.object({
  markdown: z.string().trim().max(28_000).optional().default(""),
  name: z.string().trim().max(80).optional(),
  description: z.string().trim().max(240).optional(),
  version: z.string().trim().max(40).optional(),
  keywords: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  requiredMcp: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  sourceUrl: z.string().url().max(1_000).optional().or(z.literal("")),
  enabled: z.boolean().optional(),
  autoLoad: z.boolean().optional(),
});

export async function GET() {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  return Response.json({ skills: await listSkills(context) });
}

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const parsed = skillSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "Skill 内容或元数据不完整。" },
      { status: 400 },
    );
  }

  try {
    const skill = await createSkill(context, parsed.data);
    return Response.json({ skill }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        code: "SKILL_SETUP_FAILED",
        message: error instanceof Error ? error.message : "Skill 保存失败。",
      },
      { status: 503 },
    );
  }
}
