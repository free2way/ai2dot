import "server-only";

import { auth } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/server/auth/config";

export type RequestIdentity = {
  externalAuthId: string;
};

export async function getRequestIdentity(): Promise<RequestIdentity | null> {
  if (!isClerkConfigured()) return null;

  const { userId } = await auth();
  return userId ? { externalAuthId: userId } : null;
}
