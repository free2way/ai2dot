import "server-only";

import { auth } from "@clerk/nextjs/server";
import { getAuthMode } from "@/server/auth/config";
import { getLocalSessionIdentity } from "@/server/auth/local";

export type RequestIdentity = {
  externalAuthId: string;
  displayName?: string;
};

export async function getRequestIdentity(): Promise<RequestIdentity | null> {
  const mode = getAuthMode();
  if (mode === "local") return getLocalSessionIdentity();
  if (mode !== "clerk") return null;

  const { userId } = await auth();
  return userId ? { externalAuthId: userId } : null;
}
