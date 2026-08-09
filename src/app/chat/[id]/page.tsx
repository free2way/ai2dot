import { notFound, redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { FEATURED_MODELS } from "@/lib/models";
import { isClerkConfigured } from "@/server/auth/config";
import { isAiGatewayConfigured } from "@/server/ai/gateway";
import {
  listConversations,
  listConversationBranches,
  loadConversationMessages,
} from "@/server/chat/store";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { listEnabledChatModels } from "@/server/providers/store";

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
  const branches = await listConversationBranches(context, id);
  if (!branches) notFound();
  const requestedBranchId = (await searchParams).branch;
  const activeBranch = requestedBranchId
    ? branches.find((branch) => branch.id === requestedBranchId)
    : branches.find((branch) => branch.isDefault) ?? branches[0];
  if (!activeBranch) notFound();
  const chatMessages = await loadConversationMessages(context, id, activeBranch.id);
  if (!chatMessages) notFound();
  const workspaceModels = await listEnabledChatModels(context);

  return (
    <ChatWorkspace
      models={workspaceModels.length > 0 ? workspaceModels : FEATURED_MODELS}
      authEnabled
      gatewayEnabled={workspaceModels.length > 0 || isAiGatewayConfigured()}
      persistenceEnabled
      initialConversationId={id}
      initialBranchId={activeBranch.id}
      initialBranches={branches}
      initialMessages={chatMessages}
      initialConversations={await listConversations(context)}
    />
  );
}
