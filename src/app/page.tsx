import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { currentUser } from "@clerk/nextjs/server";
import { FEATURED_MODELS } from "@/lib/models";
import { isClerkConfigured } from "@/server/auth/config";
import { getRequestIdentity } from "@/server/auth/session";
import { isAiGatewayConfigured } from "@/server/ai/gateway";
import { listConversations } from "@/server/chat/store";
import { getWorkspaceContext, isPersistenceConfigured } from "@/server/db/workspace";
import { listEnabledChatModels } from "@/server/providers/store";
import { listKnowledgeBases } from "@/server/knowledge/store";
import { listMcpSources } from "@/server/mcp/store";

export default async function Home() {
  const canPersist = isClerkConfigured() && isPersistenceConfigured();
  const context = canPersist ? await getWorkspaceContext() : null;
  const [identity, user] = isClerkConfigured()
    ? await Promise.all([getRequestIdentity(), currentUser()])
    : [null, null];
  const [conversationList, workspaceModels, knowledgeBases, mcpSources] = context
    ? await Promise.all([
        listConversations(context),
        listEnabledChatModels(context),
        listKnowledgeBases(context),
        listMcpSources(context),
      ])
    : [[], [], [], []];

  return (
    <ChatWorkspace
      models={workspaceModels.length > 0 ? workspaceModels : FEATURED_MODELS}
      authEnabled={isClerkConfigured()}
      gatewayEnabled={
        workspaceModels.length > 0 ||
        (isAiGatewayConfigured() &&
          (!isClerkConfigured() || Boolean(identity)))
      }
      persistenceEnabled={Boolean(context)}
      initialConversations={conversationList}
      initialUserName={user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || null}
      initialKnowledgeBases={knowledgeBases}
      initialMcpSources={mcpSources.map((source) => ({
        id: source.id,
        name: source.name,
        transport: source.transport,
        enabled: source.enabled,
        toolCount: source.tools.length,
      }))}
    />
  );
}
