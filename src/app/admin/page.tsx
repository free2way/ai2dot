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
  const infrastructureReady =
    isClerkConfigured() &&
    isPersistenceConfigured() &&
    Boolean(process.env.PROVIDER_SECRET_ENCRYPTION_KEY);

  if (!infrastructureReady) {
    return <ProviderManager infrastructureReady={false} />;
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
      initialProviders={providers}
      initialModels={models}
    />
  );
}
