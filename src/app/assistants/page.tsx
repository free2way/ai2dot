import { redirect } from "next/navigation";
import { AssistantManager } from "@/components/assistants/assistant-manager";
import { FEATURED_MODELS } from "@/lib/models";
import { isAuthConfigured } from "@/server/auth/config";
import { listAssistants } from "@/server/assistants/store";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { listKnowledgeBases } from "@/server/knowledge/store";
import { listMcpSources } from "@/server/mcp/store";
import { listEnabledChatModels } from "@/server/providers/store";
import { listSkills } from "@/server/skills/store";

export const dynamic = "force-dynamic";

export default async function AssistantsPage() {
  if (!isAuthConfigured() || !isPersistenceConfigured()) redirect("/");
  const context = await getWorkspaceContext();
  if (!context) redirect("/sign-in");
  const [assistants, models, knowledgeBases, mcpSources, skills] = await Promise.all([
    listAssistants(context),
    listEnabledChatModels(context),
    listKnowledgeBases(context),
    listMcpSources(context),
    listSkills(context),
  ]);
  return (
    <AssistantManager
      initialAssistants={assistants}
      models={models.length > 0 ? models : FEATURED_MODELS}
      knowledgeBases={knowledgeBases}
      mcpSources={mcpSources
        .filter((source) => source.enabled)
        .map((source) => ({
          id: source.id,
          name: source.name,
          toolCount: source.tools.length,
        }))}
      skills={skills.flatMap((skill) =>
        skill.versionId
          ? [{
              id: skill.id,
              versionId: skill.versionId,
              name: skill.name,
              description: skill.description,
              version: skill.version,
              enabled: skill.enabled,
            }]
          : [],
      )}
    />
  );
}
