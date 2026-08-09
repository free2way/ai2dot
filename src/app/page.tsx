import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { FEATURED_MODELS } from "@/lib/models";
import { isClerkConfigured } from "@/server/auth/config";
import { getRequestIdentity } from "@/server/auth/session";
import { isAiGatewayConfigured } from "@/server/ai/gateway";
import { listConversations } from "@/server/chat/store";
import { getWorkspaceContext, isPersistenceConfigured } from "@/server/db/workspace";
import { listEnabledChatModels } from "@/server/providers/store";

export default async function Home() {
  const canPersist = isClerkConfigured() && isPersistenceConfigured();
  const context = canPersist ? await getWorkspaceContext() : null;
  const identity = isClerkConfigured() ? await getRequestIdentity() : null;
  const conversationList = context ? await listConversations(context) : [];
  const workspaceModels = context ? await listEnabledChatModels(context) : [];

  return (
    <ChatWorkspace
      models={workspaceModels.length > 0 ? workspaceModels : FEATURED_MODELS}
      authEnabled={isClerkConfigured()}
      gatewayEnabled={
        isAiGatewayConfigured() &&
        (!isClerkConfigured() || Boolean(identity))
      }
      persistenceEnabled={Boolean(context)}
      initialConversations={conversationList}
    />
  );
}
