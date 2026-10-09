"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  authenticatePlatformAdmin,
  canManageUsers,
  destroyPlatformAdminSession,
  getPlatformAdminSession,
} from "@/server/platform-admin/auth";
import { setPlatformUserStatus } from "@/server/platform-admin/store";

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(1).max(1_024),
});

const userStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

export async function signInToConsole(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/console/sign-in?error=invalid");

  const admin = await authenticatePlatformAdmin(
    parsed.data.username,
    parsed.data.password,
  );
  if (!admin) redirect("/console/sign-in?error=invalid");
  redirect("/console");
}

export async function signOutOfConsole() {
  const admin = await getPlatformAdminSession();
  await destroyPlatformAdminSession(admin?.id);
  redirect("/console/sign-in");
}

export async function changePlatformUserStatus(formData: FormData) {
  const admin = await getPlatformAdminSession();
  if (!admin) redirect("/console/sign-in");
  if (!canManageUsers(admin)) throw new Error("Not authorized.");

  const parsed = userStatusSchema.safeParse({
    userId: formData.get("userId"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Invalid user status update.");

  await setPlatformUserStatus(
    admin,
    parsed.data.userId,
    parsed.data.status,
  );
  revalidatePath("/console");
}
