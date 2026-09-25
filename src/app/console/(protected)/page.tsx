import { redirect } from "next/navigation";
import { ConsoleDashboard } from "@/components/console/console-dashboard";
import {
  canManageUsers,
  getPlatformAdminSession,
} from "@/server/platform-admin/auth";
import { getPlatformConsoleData } from "@/server/platform-admin/store";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const admin = await getPlatformAdminSession();
  if (!admin) redirect("/console/sign-in");
  const data = await getPlatformConsoleData();

  return (
    <ConsoleDashboard
      canManageUsers={canManageUsers(admin)}
      data={data}
    />
  );
}
