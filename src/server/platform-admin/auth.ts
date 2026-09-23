import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/server/db";
import {
  platformAdminAuditLogs,
  platformAdmins,
  platformAdminSessions,
} from "@/server/db/schema";
import { verifyPlatformAdminPassword } from "@/server/platform-admin/password";

const SESSION_COOKIE = "ai2dot_admin_session";
const LOGIN_ATTEMPT_LIMIT = 5;
const LOCK_DURATION_MS = 15 * 60 * 1_000;

export type PlatformAdminIdentity = {
  id: string;
  username: string;
  displayName: string;
  role: "super_admin" | "operator" | "auditor";
};

function sessionLifetimeMs() {
  const configuredHours = Number(process.env.AI2DOT_ADMIN_SESSION_TTL_HOURS);
  const hours = Number.isInteger(configuredHours)
    ? Math.min(Math.max(configuredHours, 1), 24)
    : 8;
  return hours * 60 * 60 * 1_000;
}

function cookieSecure() {
  return (
    process.env.AI2DOT_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production"
  );
}

export function normalizePlatformAdminUsername(username: string) {
  return username.trim().toLowerCase();
}

export function hashPlatformAdminSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function setSessionCookie(token: string, maxAge: number) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge,
    path: "/console",
    sameSite: "strict",
    secure: cookieSecure(),
  });
}

export async function authenticatePlatformAdmin(
  username: string,
  password: string,
) {
  const db = getDb();
  const normalizedUsername = normalizePlatformAdminUsername(username);
  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.username, normalizedUsername))
    .limit(1);

  if (!admin || admin.status === "disabled") return null;

  const now = new Date();
  if (
    admin.status === "locked" &&
    admin.lockedUntil &&
    admin.lockedUntil > now
  ) {
    return null;
  }

  const passwordValid = verifyPlatformAdminPassword(
    password,
    admin.passwordHash,
  );
  if (!passwordValid) {
    const failedLoginCount = admin.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= LOGIN_ATTEMPT_LIMIT;
    await db
      .update(platformAdmins)
      .set({
        failedLoginCount,
        lockedUntil: shouldLock
          ? new Date(now.getTime() + LOCK_DURATION_MS)
          : null,
        status: shouldLock ? "locked" : "active",
        updatedAt: now,
      })
      .where(eq(platformAdmins.id, admin.id));
    await db.insert(platformAdminAuditLogs).values({
      adminId: admin.id,
      action: shouldLock ? "auth.locked" : "auth.failed",
      resourceType: "platform_admin",
      resourceId: admin.id,
      metadata: { failedLoginCount },
    });
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs());
  await db
    .delete(platformAdminSessions)
    .where(lt(platformAdminSessions.expiresAt, now));
  await db.insert(platformAdminSessions).values({
    adminId: admin.id,
    tokenHash: hashPlatformAdminSessionToken(token),
    expiresAt,
  });
  await db
    .update(platformAdmins)
    .set({
      failedLoginCount: 0,
      lastLoginAt: now,
      lockedUntil: null,
      status: "active",
      updatedAt: now,
    })
    .where(eq(platformAdmins.id, admin.id));
  await db.insert(platformAdminAuditLogs).values({
    adminId: admin.id,
    action: "auth.signed_in",
    resourceType: "platform_admin",
    resourceId: admin.id,
  });
  await setSessionCookie(token, Math.floor(sessionLifetimeMs() / 1_000));

  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    role: admin.role,
  } satisfies PlatformAdminIdentity;
}

export async function getPlatformAdminSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const now = new Date();
  const [session] = await db
    .select({
      id: platformAdminSessions.id,
      adminId: platformAdmins.id,
      username: platformAdmins.username,
      displayName: platformAdmins.displayName,
      role: platformAdmins.role,
    })
    .from(platformAdminSessions)
    .innerJoin(
      platformAdmins,
      eq(platformAdmins.id, platformAdminSessions.adminId),
    )
    .where(
      and(
        eq(
          platformAdminSessions.tokenHash,
          hashPlatformAdminSessionToken(token),
        ),
        gt(platformAdminSessions.expiresAt, now),
        eq(platformAdmins.status, "active"),
      ),
    )
    .limit(1);

  if (!session) return null;

  await db
    .update(platformAdminSessions)
    .set({ lastSeenAt: now })
    .where(eq(platformAdminSessions.id, session.id));

  return {
    id: session.adminId,
    username: session.username,
    displayName: session.displayName,
    role: session.role,
  } satisfies PlatformAdminIdentity;
}

export async function destroyPlatformAdminSession(adminId?: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    await db
      .delete(platformAdminSessions)
      .where(
        eq(
          platformAdminSessions.tokenHash,
          hashPlatformAdminSessionToken(token),
        ),
      );
    if (adminId) {
      await db.insert(platformAdminAuditLogs).values({
        adminId,
        action: "auth.signed_out",
        resourceType: "platform_admin",
        resourceId: adminId,
      });
    }
  }
  await setSessionCookie("", 0);
}

export function canManageUsers(admin: PlatformAdminIdentity) {
  return admin.role === "super_admin" || admin.role === "operator";
}
