import { getWorkspaceContext } from "@/server/db/workspace";
import { isExplicitSkillsEnabled } from "@/server/skills/config";
import { listSkills } from "@/server/skills/store";

export async function GET(request: Request) {
  if (!isExplicitSkillsEnabled()) {
    return Response.json(
      { code: "SKILL_FEATURE_DISABLED", message: "Skill 功能尚未启用。" },
      { status: 503 },
    );
  }
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url);
  const query = (url.searchParams.get("query") ?? "").trim().toLowerCase();
  const category = (url.searchParams.get("category") ?? "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
  const offset = Math.max(Number(url.searchParams.get("cursor")) || 0, 0);
  const filtered = (await listSkills(context)).filter((skill) => {
    if (category && skill.category !== category) return false;
    if (!query) return true;
    return [skill.name, skill.description, skill.slug, skill.category ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const items = filtered.slice(offset, offset + limit);
  return Response.json({
    skills: items,
    nextCursor: offset + items.length < filtered.length ? String(offset + items.length) : null,
  });
}
