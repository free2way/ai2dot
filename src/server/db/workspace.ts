import "server-only";

import { eq } from "drizzle-orm";
import { getClerkUserProfile } from "@/server/auth/clerk-profile";
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
  const now = new Date();
  const [user] = await db
    .insert(users)
    .values({
      externalAuthId: identity.externalAuthId,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: users.externalAuthId,
      set: { lastSeenAt: now, updatedAt: now },
    })
    .returning({
      id: users.id,
      status: users.status,
      email: users.email,
    });

  if (user.status !== "active") return null;

  if (!user.email && identity.externalAuthId.startsWith("user_")) {
    try {
      const profile = await getClerkUserProfile(identity.externalAuthId);
      await db
        .update(users)
        .set({
          avatarUrl: profile.avatarUrl,
          displayName: profile.displayName,
          email: profile.email,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
    } catch (error) {
      console.warn("Unable to synchronize Clerk user profile.", error);
    }
  }

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
