import "server-only";

import { clerkClient, type User } from "@clerk/nextjs/server";

export type ClerkUserProfile = {
  externalAuthId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type ClerkUserProfileSource = Pick<
  User,
  | "id"
  | "fullName"
  | "username"
  | "primaryEmailAddress"
  | "emailAddresses"
  | "imageUrl"
>;

export function clerkUserToProfile(
  user: ClerkUserProfileSource,
): ClerkUserProfile {
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  return {
    externalAuthId: user.id,
    displayName:
      user.fullName || user.username || email?.split("@")[0] || null,
    email,
    avatarUrl: user.imageUrl || null,
  };
}

export async function getClerkUserProfile(userId: string) {
  const client = await clerkClient();
  return clerkUserToProfile(await client.users.getUser(userId));
}

export async function listClerkUserProfiles(userIds: string[]) {
  if (!userIds.length) return [];
  const client = await clerkClient();
  const result = await client.users.getUserList({
    limit: Math.min(userIds.length, 100),
    userId: userIds.slice(0, 100),
  });
  return result.data.map(clerkUserToProfile);
}
