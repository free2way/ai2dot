import { redirect } from "next/navigation";
import { NotebookStudio } from "@/components/notebooks/notebook-studio";
import { FEATURED_MODELS } from "@/lib/models";
import { isAiGatewayConfigured } from "@/server/ai/gateway";
import { isAuthConfigured } from "@/server/auth/config";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { describeGoogleNotebookProvider } from "@/server/notebooks/google-provider";
import { listNotebooks } from "@/server/notebooks/store";
import { listEnabledChatModels } from "@/server/providers/store";

export const dynamic = "force-dynamic";

export default async function NotebooksPage() {
  if (!isAuthConfigured() || !isPersistenceConfigured()) redirect("/");
  const context = await getWorkspaceContext();
  if (!context) redirect("/sign-in");
  const [notebooks, models] = await Promise.all([
    listNotebooks(context),
    listEnabledChatModels(context),
  ]);
  return (
    <NotebookStudio
      initialNotebooks={notebooks}
      models={
        models.length > 0
          ? models
          : isAiGatewayConfigured()
            ? FEATURED_MODELS
            : []
      }
      googleStatus={describeGoogleNotebookProvider()}
    />
  );
}
