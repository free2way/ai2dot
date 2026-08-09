import "server-only";

import { eq } from "drizzle-orm";
import { getRequestIdentity } from "@/server/auth/session";
import { getDb, isDatabaseConfigured } from "@/server/db";
import {
  users,
  workspaceMembers,
  workspaces,
  type workspaceRole,
} from "@/server/db/schema";

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: (typeof workspaceRole.enumValues)[number];
};

export function isPersistenceConfigured() {
  return isDatabaseConfigured();
}

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  if (!isDatabaseConfigured()) return null;

  const identity = await getRequestIdentity();
  if (!identity) return null;

  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ externalAuthId: identity.externalAuthId })
    .onConflictDoUpdate({
      target: users.externalAuthId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: users.id });

  const [membership] = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);

  if (membership) {
    return { userId: user.id, ...membership };
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({ name: "个人工作区", ownerId: user.id })
    .returning({ id: workspaces.id });

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  return { userId: user.id, workspaceId: workspace.id, role: "owner" };
}

export async function getAdminWorkspaceContext() {
  const context = await getWorkspaceContext();
  if (!context || !["owner", "admin"].includes(context.role)) return null;
  return context;
}
