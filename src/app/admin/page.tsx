import { redirect } from "next/navigation";
import { ProviderManager } from "@/components/admin/provider-manager";
import { isClerkConfigured } from "@/server/auth/config";
import {
  getAdminWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import {
  listProviderConnections,
  listProviderModels,
} from "@/server/providers/store";

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

  const [providers, models] = await Promise.all([
    listProviderConnections(context),
    listProviderModels(context),
  ]);

  return (
    <ProviderManager
      infrastructureReady
      configuration={configuration}
      initialProviders={providers}
      initialModels={models}
    />
  );
}
