import { getWorkspaceContext } from "@/server/db/workspace";
import { getGenerationSkillDetails } from "@/server/generations/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const details = await getGenerationSkillDetails(
    context,
    (await params).generationId,
  );
  if (!details) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  return Response.json(details);
}
