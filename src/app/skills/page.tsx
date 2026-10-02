import { redirect } from "next/navigation";
import { SkillLibrary } from "@/components/skills/skill-library";
import { isAuthConfigured } from "@/server/auth/config";
import {
  getWorkspaceContext,
  isPersistenceConfigured,
} from "@/server/db/workspace";
import { isSkillLibraryEnabled } from "@/server/skills/config";
import { listSkillCatalog } from "@/server/skills/store";
import { safeChatReturnPath } from "@/lib/chat-draft";

export const dynamic = "force-dynamic";

export default async function SkillsPage({ searchParams }: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (!isAuthConfigured() || !isPersistenceConfigured()) redirect("/");
  const context = await getWorkspaceContext();
  if (!context) redirect("/sign-in");
  return (
    <SkillLibrary
      enabled={isSkillLibraryEnabled()}
      initialSkills={isSkillLibraryEnabled() ? await listSkillCatalog(context) : []}
      canManage={["owner", "admin"].includes(context.role)}
      returnHref={safeChatReturnPath((await searchParams).returnTo)}
    />
  );
}
