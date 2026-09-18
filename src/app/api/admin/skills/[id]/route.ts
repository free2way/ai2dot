import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import {
  deleteSkill,
  getSkillDocument,
  updateSkill,
  updateSkillStatus,
} from "@/server/skills/store";

const updateSkillSchema = z.object({
  markdown: z.string().trim().max(28_000).optional().default(""),
  name: z.string().trim().max(80).optional(),
  description: z.string().trim().max(240).optional(),
  version: z.string().trim().max(40).optional(),
  keywords: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  requiredMcp: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  sourceUrl: z.string().url().max(1_000).optional().or(z.literal("")),
  enabled: z.boolean(),
  autoLoad: z.boolean(),
});

const statusSchema = z.object({
  enabled: z.boolean().optional(),
  autoLoad: z.boolean().optional(),
}).refine((value) => value.enabled !== undefined || value.autoLoad !== undefined);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  const skill = await getSkillDocument(context, (await params).id);
  if (!skill) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ skill });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  const body = await request.json();
  const status = statusSchema.safeParse(body);
  if (status.success && !("markdown" in body)) {
    const skill = await updateSkillStatus(context, (await params).id, status.data);
    if (!skill) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    return Response.json({ skill });
  }
  const parsed = updateSkillSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "Skill 内容或元数据不完整。" },
      { status: 400 },
    );
  }

  try {
    const skill = await updateSkill(context, (await params).id, parsed.data);
    if (!skill) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    return Response.json({ skill });
  } catch (error) {
    return Response.json(
      {
        code: "SKILL_UPDATE_FAILED",
        message: error instanceof Error ? error.message : "Skill 更新失败。",
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
  const deleted = await deleteSkill(context, (await params).id);
  if (!deleted) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
