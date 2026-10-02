import { currentUser } from "@clerk/nextjs/server";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { FEATURED_MODELS } from "@/lib/models";
import { getAuthMode, isAuthConfigured } from "@/server/auth/config";
import { clerkUserToProfile } from "@/server/auth/clerk-profile";
import { getRequestIdentity } from "@/server/auth/session";
import { isAiGatewayConfigured } from "@/server/ai/gateway";
import { listConversations } from "@/server/chat/store";
import { getWorkspaceContext, isPersistenceConfigured } from "@/server/db/workspace";
import { listEnabledChatModels } from "@/server/providers/store";
import { listKnowledgeBases } from "@/server/knowledge/store";
import { listMcpSources } from "@/server/mcp/store";
import { listSkills } from "@/server/skills/store";
import { isExplicitSkillsEnabled } from "@/server/skills/config";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const authMode = getAuthMode();
  const authConfigured = isAuthConfigured();
  const canPersist = authConfigured && isPersistenceConfigured();
  const [context, identity, clerkUser] = await Promise.all([
    canPersist ? getWorkspaceContext() : Promise.resolve(null),
    authConfigured ? getRequestIdentity() : Promise.resolve(null),
    authMode === "clerk" ? currentUser() : Promise.resolve(null),
  ]);
  const userName = clerkUser
    ? clerkUserToProfile(clerkUser).displayName
    : identity?.displayName;
  const [conversationList, workspaceModels, knowledgeBases, mcpSources, skills] = context
    ? await Promise.all([
        listConversations(context),
        listEnabledChatModels(context),
        listKnowledgeBases(context),
        listMcpSources(context),
        listSkills(context),
      ])
    : [[], [], [], [], []];

  return (
    <ChatWorkspace
      models={workspaceModels.length > 0 ? workspaceModels : FEATURED_MODELS}
      authEnabled={authConfigured}
      authProvider={authMode}
      signedIn={Boolean(identity)}
      gatewayEnabled={
        workspaceModels.length > 0 ||
        (isAiGatewayConfigured() &&
          (!authConfigured || Boolean(identity)))
      }
      persistenceEnabled={Boolean(context)}
      storageIdentity={context ? `${context.workspaceId}:${context.userId}` : undefined}
      explicitSkillsEnabled={isExplicitSkillsEnabled()}
      initialUserName={userName}
      initialConversations={conversationList}
      initialKnowledgeBases={knowledgeBases}
      initialMcpSources={mcpSources.map((source) => ({
        id: source.id,
        name: source.name,
        transport: source.transport,
        enabled: source.enabled,
        toolCount: source.tools.length,
        templateId: source.templateId,
      }))}
      initialSkills={skills.flatMap((skill) =>
        skill.versionId
          ? [{
              id: skill.id,
              versionId: skill.versionId,
              name: skill.name,
              description: skill.description,
              slug: skill.slug,
              catalogId: skill.catalogId,
              category: skill.category,
              version: skill.version,
              enabled: skill.enabled,
              autoLoad: skill.autoLoad,
              dependencies: skill.dependencies,
            }]
          : [],
      )}
    />
  );
}
