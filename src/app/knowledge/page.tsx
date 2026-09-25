import { redirect } from "next/navigation";
import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";
import { isAuthConfigured } from "@/server/auth/config";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { listKnowledgeBases } from "@/server/knowledge/store";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  if (!isAuthConfigured() || !isPersistenceConfigured()) redirect("/");
  const context = await getWorkspaceContext();
  if (!context) redirect("/sign-in");
  return <KnowledgeManager initialKnowledgeBases={await listKnowledgeBases(context)} />;
}
