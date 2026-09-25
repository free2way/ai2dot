import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { FEATURED_MODELS } from "@/lib/models";
import { getAuthMode, isAuthConfigured } from "@/server/auth/config";
import { getRequestIdentity } from "@/server/auth/session";
import { isAiGatewayConfigured } from "@/server/ai/gateway";
import { listConversations } from "@/server/chat/store";
import { getWorkspaceContext, isPersistenceConfigured } from "@/server/db/workspace";
import { listEnabledChatModels } from "@/server/providers/store";
import { listKnowledgeBases } from "@/server/knowledge/store";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const authMode = getAuthMode();
  const authConfigured = isAuthConfigured();
  const canPersist = authConfigured && isPersistenceConfigured();
  const context = canPersist ? await getWorkspaceContext() : null;
  const identity = authConfigured ? await getRequestIdentity() : null;
  const [conversationList, workspaceModels, knowledgeBases] = context
    ? await Promise.all([
        listConversations(context),
        listEnabledChatModels(context),
        listKnowledgeBases(context),
      ])
    : [[], [], []];

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
      initialUserName={identity?.displayName}
      initialConversations={conversationList}
      initialKnowledgeBases={knowledgeBases}
    />
  );
}
