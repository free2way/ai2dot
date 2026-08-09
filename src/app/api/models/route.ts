import { FEATURED_MODELS } from "@/lib/models";
import { isClerkConfigured } from "@/server/auth/config";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { listEnabledChatModels } from "@/server/providers/store";

export async function GET() {
  const context =
    isClerkConfigured() && isPersistenceConfigured()
      ? await getWorkspaceContext()
      : null;
  const workspaceModels = context ? await listEnabledChatModels(context) : [];

  return Response.json({
    data: workspaceModels.length > 0 ? workspaceModels : FEATURED_MODELS,
    source: workspaceModels.length > 0 ? "workspace" : "featured",
    refreshedAt: new Date().toISOString(),
  });
}
