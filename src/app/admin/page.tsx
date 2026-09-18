import { redirect } from "next/navigation";
import { ProviderManager } from "@/components/admin/provider-manager";
import { isClerkConfigured } from "@/server/auth/config";
import {
  getAdminWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { getWorkspaceOperations } from "@/server/operations/store";
import {
  listProviderConnections,
  listProviderModels,
} from "@/server/providers/store";
import { listMcpSources } from "@/server/mcp/store";
import { listSkills } from "@/server/skills/store";

export default async function AdminPage() {
  const configuration = {
    authReady: isClerkConfigured(),
    databaseReady: isPersistenceConfigured(),
    encryptionReady: Boolean(process.env.PROVIDER_SECRET_ENCRYPTION_KEY),
  };
  const infrastructureReady =
    configuration.authReady &&
    configuration.databaseReady &&
    configuration.encryptionReady;

  if (!infrastructureReady) {
    return (
      <ProviderManager
        infrastructureReady={false}
        configuration={configuration}
      />
    );
  }

  const context = await getAdminWorkspaceContext();
  if (!context) redirect("/sign-in");

  const [providers, models, operations, mcpSources, skills] = await Promise.all([
    listProviderConnections(context),
    listProviderModels(context),
    getWorkspaceOperations(context),
    listMcpSources(context),
    listSkills(context),
  ]);

  return (
    <ProviderManager
      infrastructureReady
      configuration={configuration}
      initialProviders={providers}
      initialModels={models}
      initialOperations={operations}
      initialMcpSources={mcpSources}
      initialSkills={skills}
    />
  );
}
