import {
  EXTENSION_PAGE_CHARACTER_LIMIT,
  EXTENSION_SUMMARY_CHARACTER_LIMIT,
  type ExtensionBootstrapResponse,
} from "@/lib/extension";
import { FEATURED_MODELS } from "@/lib/models";
import { isAiGatewayConfigured } from "@/server/ai/gateway";
import {
  extensionAuthErrorResponse,
  getChromeExtensionWorkspaceContext,
} from "@/server/extension/auth";
import { listKnowledgeBases } from "@/server/knowledge/store";
import { listEnabledChatModels } from "@/server/providers/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorized = await getChromeExtensionWorkspaceContext(request);
  if (!authorized.ok) return extensionAuthErrorResponse(authorized);

  const [workspaceModels, knowledgeBases] = await Promise.all([
    listEnabledChatModels(authorized.context),
    listKnowledgeBases(authorized.context),
  ]);
  const models = [
    ...workspaceModels,
    ...(isAiGatewayConfigured() ? FEATURED_MODELS : []),
  ];

  const response: ExtensionBootstrapResponse = {
    user: {
      id: authorized.context.userId,
      displayName: null,
    },
    workspace: {
      id: authorized.context.workspaceId,
      role: authorized.context.role,
    },
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      description: model.description,
      contextWindow: model.contextWindow,
      capabilities: model.capabilities,
    })),
    knowledgeBases: knowledgeBases.map((base) => ({
      id: base.id,
      name: base.name,
      description: base.description,
      documentCount: base.documentCount,
    })),
    limits: {
      maxPageCharacters: EXTENSION_PAGE_CHARACTER_LIMIT,
      maxSummaryCharacters: EXTENSION_SUMMARY_CHARACTER_LIMIT,
    },
  };

  return Response.json(response, {
    headers: { "cache-control": "no-store" },
  });
}
