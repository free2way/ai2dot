import { redirect } from "next/navigation";
import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";
import { isClerkConfigured } from "@/server/auth/config";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { listKnowledgeBases } from "@/server/knowledge/store";

export default async function KnowledgePage() {
  if (!isClerkConfigured() || !isPersistenceConfigured()) redirect("/");
  const context = await getWorkspaceContext();
  if (!context) redirect("/sign-in");
  return <KnowledgeManager initialKnowledgeBases={await listKnowledgeBases(context)} />;
}
