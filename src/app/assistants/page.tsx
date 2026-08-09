import { redirect } from "next/navigation";
import { AssistantManager } from "@/components/assistants/assistant-manager";
import { FEATURED_MODELS } from "@/lib/models";
import { isClerkConfigured } from "@/server/auth/config";
import { listAssistants } from "@/server/assistants/store";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { listKnowledgeBases } from "@/server/knowledge/store";
import { listEnabledChatModels } from "@/server/providers/store";

export default async function AssistantsPage() {
  if (!isClerkConfigured() || !isPersistenceConfigured()) redirect("/");
  const context = await getWorkspaceContext();
  if (!context) redirect("/sign-in");
  const [assistants, models, knowledgeBases] = await Promise.all([
    listAssistants(context),
    listEnabledChatModels(context),
    listKnowledgeBases(context),
  ]);
  return (
    <AssistantManager
      initialAssistants={assistants}
      models={models.length > 0 ? models : FEATURED_MODELS}
      knowledgeBases={knowledgeBases}
    />
  );
}
