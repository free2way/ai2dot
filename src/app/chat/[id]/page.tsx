import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { FEATURED_MODELS } from "@/lib/models";
import { isClerkConfigured } from "@/server/auth/config";
import { isAiGatewayConfigured } from "@/server/ai/gateway";
import { getAssistant } from "@/server/assistants/store";
import {
  getConversation,
  listConversations,
  listConversationBranches,
  loadConversationMessages,
} from "@/server/chat/store";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { listEnabledChatModels } from "@/server/providers/store";
import { listKnowledgeBases } from "@/server/knowledge/store";
import { listMcpSources } from "@/server/mcp/store";
import { listSkills } from "@/server/skills/store";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ branch?: string }>;
}) {
  if (!isClerkConfigured() || !isPersistenceConfigured()) redirect("/");

  const context = await getWorkspaceContext();
  if (!context) redirect("/sign-in");

  const { id } = await params;
  const [conversation, branches] = await Promise.all([
    getConversation(context, id),
    listConversationBranches(context, id),
  ]);
  if (!conversation || !branches) notFound();
  const requestedBranchId = (await searchParams).branch;
  const activeBranch = requestedBranchId
    ? branches.find((branch) => branch.id === requestedBranchId)
    : branches.find((branch) => branch.isDefault) ?? branches[0];
  if (!activeBranch) notFound();
  const chatMessages = await loadConversationMessages(context, id, activeBranch.id);
  if (!chatMessages) notFound();
  const [workspaceModels, knowledgeBases, conversationList, liveAssistant, user, mcpSources, skills] = await Promise.all([
    listEnabledChatModels(context),
    listKnowledgeBases(context),
    listConversations(context),
    conversation.assistantId
      ? getAssistant(context, conversation.assistantId)
      : Promise.resolve(null),
    currentUser(),
    listMcpSources(context),
    listSkills(context),
  ]);
  const assistant = conversation.assistantSnapshot ?? liveAssistant;
  const assistantIdentity = assistant
    ? "assistantId" in assistant
      ? assistant.assistantId
      : assistant.id
    : undefined;
  const initialMessages = chatMessages.length > 0
    ? chatMessages
    : assistant
      ? [{
          id: `assistant-welcome-${assistantIdentity}`,
          role: "assistant" as const,
          parts: [{
            type: "text" as const,
            text:
              assistant.welcomeMessage ||
              `你好，我是${assistant.name}。请告诉我你希望完成的任务。`,
          }],
        }]
      : chatMessages;

  return (
    <ChatWorkspace
      models={workspaceModels.length > 0 ? workspaceModels : FEATURED_MODELS}
      authEnabled
      gatewayEnabled={workspaceModels.length > 0 || isAiGatewayConfigured()}
      persistenceEnabled
      initialConversationId={id}
      initialBranchId={activeBranch.id}
      initialBranches={branches}
      initialContextCompacted={activeBranch.hasContextSummary}
      initialMessages={initialMessages}
      initialConversations={conversationList}
      initialUserName={user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || null}
      initialModelId={assistant?.defaultModelKey ?? undefined}
      initialKnowledgeBaseIds={assistant?.knowledgeBaseIds ?? []}
      initialAssistant={assistant ? {
        name: assistant.name,
        description: assistant.description,
      } : undefined}
      initialKnowledgeBases={knowledgeBases}
      initialMcpSources={mcpSources.map((source) => ({
        id: source.id,
        name: source.name,
        transport: source.transport,
        enabled: source.enabled,
        toolCount: source.tools.length,
      }))}
      initialSkills={skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        enabled: skill.enabled,
        autoLoad: skill.autoLoad,
      }))}
    />
  );
}
