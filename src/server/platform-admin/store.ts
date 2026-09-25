import "server-only";

import { and, desc, eq, isNull, like, sql } from "drizzle-orm";
import { listClerkUserProfiles } from "@/server/auth/clerk-profile";
import { getDb } from "@/server/db";
import {
  platformAdminAuditLogs,
  platformAdmins,
  users,
} from "@/server/db/schema";
import type { PlatformAdminIdentity } from "@/server/platform-admin/auth";

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asIso(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

type OverviewRow = {
  user_count: number | string;
  active_user_count: number | string;
  suspended_user_count: number | string;
  active_24h_count: number | string;
  new_users_7d: number | string;
  workspace_count: number | string;
  request_count_30d: number | string;
  completed_count_30d: number | string;
  failed_count_30d: number | string;
  input_tokens_30d: number | string;
  output_tokens_30d: number | string;
  cost_usd_30d: number | string;
  conversation_count: number | string;
  message_count: number | string;
  document_count: number | string;
  storage_bytes: number | string;
  chunk_count: number | string;
  provider_count: number | string;
  mcp_count: number | string;
  skill_count: number | string;
  assistant_count: number | string;
  database_bytes: number | string;
};

type DailyUsageRow = {
  day: string;
  requests: number | string;
  tokens: number | string;
};

type UserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  external_auth_id: string;
  status: "active" | "suspended";
  created_at: Date;
  last_seen_at: Date | null;
  workspace_count: number | string;
  request_count_30d: number | string;
  token_count_30d: number | string;
  storage_bytes: number | string;
};

type WorkspaceRow = {
  id: string;
  name: string;
  owner_name: string;
  member_count: number | string;
  request_count_30d: number | string;
  token_count_30d: number | string;
  storage_bytes: number | string;
  document_count: number | string;
  conversation_count: number | string;
  assistant_count: number | string;
  updated_at: Date;
};

async function backfillMissingClerkProfiles() {
  const db = getDb();
  const missingUsers = await db
    .select({
      id: users.id,
      externalAuthId: users.externalAuthId,
    })
    .from(users)
    .where(
      and(
        isNull(users.email),
        like(users.externalAuthId, "user\\_%"),
      ),
    )
    .limit(100);

  if (!missingUsers.length) return;

  try {
    const profiles = await listClerkUserProfiles(
      missingUsers.map((user) => user.externalAuthId),
    );
    const userIdByExternalId = new Map(
      missingUsers.map((user) => [user.externalAuthId, user.id]),
    );
    await db.transaction(async (transaction) => {
      for (const profile of profiles) {
        const userId = userIdByExternalId.get(profile.externalAuthId);
        if (!userId) continue;
        await transaction
          .update(users)
          .set({
            avatarUrl: profile.avatarUrl,
            displayName: profile.displayName,
            email: profile.email,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      }
    });
  } catch (error) {
    console.warn("Unable to backfill Clerk user profiles.", error);
  }
}

export async function getPlatformConsoleData() {
  const db = getDb();
  await backfillMissingClerkProfiles();
  const [overviewRows, dailyRows, userRows, workspaceRows, auditRows] =
    await Promise.all([
      db.execute(sql<OverviewRow>`
        select
          (select count(*) from users) as user_count,
          (select count(*) from users where status = 'active') as active_user_count,
          (select count(*) from users where status = 'suspended') as suspended_user_count,
          (select count(*) from users where last_seen_at >= now() - interval '24 hours') as active_24h_count,
          (select count(*) from users where created_at >= now() - interval '7 days') as new_users_7d,
          (select count(*) from workspaces) as workspace_count,
          (select count(*) from generations where created_at >= now() - interval '30 days' and status in ('completed', 'failed')) as request_count_30d,
          (select count(*) from generations where created_at >= now() - interval '30 days' and status = 'completed') as completed_count_30d,
          (select count(*) from generations where created_at >= now() - interval '30 days' and status = 'failed') as failed_count_30d,
          (select coalesce(sum(input_tokens), 0) from usage_events where created_at >= now() - interval '30 days') as input_tokens_30d,
          (select coalesce(sum(output_tokens), 0) from usage_events where created_at >= now() - interval '30 days') as output_tokens_30d,
          (select coalesce(sum(cost_usd), 0) from usage_events where created_at >= now() - interval '30 days') as cost_usd_30d,
          (select count(*) from conversations) as conversation_count,
          (select count(*) from messages) as message_count,
          (select count(*) from knowledge_documents) as document_count,
          (select coalesce(sum(byte_size), 0) from knowledge_documents) as storage_bytes,
          (select count(*) from knowledge_chunks) as chunk_count,
          (select count(*) from provider_connections) as provider_count,
          (select count(*) from mcp_sources) as mcp_count,
          (select count(*) from skills) as skill_count,
          (select count(*) from assistants) as assistant_count,
          pg_database_size(current_database()) as database_bytes
      `).then((rows) => Array.from(rows) as unknown as OverviewRow[]),
      db.execute(sql<DailyUsageRow>`
        with days as (
          select generate_series(
            current_date - interval '13 days',
            current_date,
            interval '1 day'
          )::date as day
        )
        select
          to_char(days.day, 'YYYY-MM-DD') as day,
          count(usage_events.id) as requests,
          coalesce(sum(usage_events.input_tokens + usage_events.output_tokens), 0) as tokens
        from days
        left join usage_events
          on usage_events.created_at >= days.day
         and usage_events.created_at < days.day + interval '1 day'
        group by days.day
        order by days.day
      `).then((rows) => Array.from(rows) as unknown as DailyUsageRow[]),
      db.execute(sql<UserRow>`
        with member_stats as (
          select user_id, count(distinct workspace_id) as workspace_count
          from workspace_members
          group by user_id
        ), user_usage as (
          select
            user_id,
            count(*) as request_count,
            coalesce(sum(input_tokens + output_tokens), 0) as token_count
          from usage_events
          where created_at >= now() - interval '30 days'
          group by user_id
        ), user_storage as (
          select wm.user_id, coalesce(sum(workspace_storage.bytes), 0) as storage_bytes
          from workspace_members wm
          left join (
            select kb.workspace_id, coalesce(sum(kd.byte_size), 0) as bytes
            from knowledge_bases kb
            left join knowledge_documents kd on kd.knowledge_base_id = kb.id
            group by kb.workspace_id
          ) workspace_storage on workspace_storage.workspace_id = wm.workspace_id
          group by wm.user_id
        )
        select
          u.id,
          u.display_name,
          u.email,
          u.external_auth_id,
          u.status,
          u.created_at,
          u.last_seen_at,
          coalesce(member_stats.workspace_count, 0) as workspace_count,
          coalesce(user_usage.request_count, 0) as request_count_30d,
          coalesce(user_usage.token_count, 0) as token_count_30d,
          coalesce(user_storage.storage_bytes, 0) as storage_bytes
        from users u
        left join member_stats on member_stats.user_id = u.id
        left join user_usage on user_usage.user_id = u.id
        left join user_storage on user_storage.user_id = u.id
        order by u.last_seen_at desc nulls last, u.created_at desc
        limit 100
      `).then((rows) => Array.from(rows) as unknown as UserRow[]),
      db.execute(sql<WorkspaceRow>`
        with members as (
          select workspace_id, count(*) as member_count
          from workspace_members
          group by workspace_id
        ), workspace_usage as (
          select
            workspace_id,
            count(*) as request_count,
            coalesce(sum(input_tokens + output_tokens), 0) as token_count
          from usage_events
          where created_at >= now() - interval '30 days'
          group by workspace_id
        ), storage as (
          select
            kb.workspace_id,
            count(kd.id) as document_count,
            coalesce(sum(kd.byte_size), 0) as storage_bytes
          from knowledge_bases kb
          left join knowledge_documents kd on kd.knowledge_base_id = kb.id
          group by kb.workspace_id
        ), conversation_counts as (
          select workspace_id, count(*) as conversation_count
          from conversations
          group by workspace_id
        ), assistant_counts as (
          select workspace_id, count(*) as assistant_count
          from assistants
          group by workspace_id
        )
        select
          w.id,
          w.name,
          coalesce(owner.email, owner.display_name, owner.external_auth_id) as owner_name,
          coalesce(members.member_count, 0) as member_count,
          coalesce(workspace_usage.request_count, 0) as request_count_30d,
          coalesce(workspace_usage.token_count, 0) as token_count_30d,
          coalesce(storage.storage_bytes, 0) as storage_bytes,
          coalesce(storage.document_count, 0) as document_count,
          coalesce(conversation_counts.conversation_count, 0) as conversation_count,
          coalesce(assistant_counts.assistant_count, 0) as assistant_count,
          w.updated_at
        from workspaces w
        join users owner on owner.id = w.owner_id
        left join members on members.workspace_id = w.id
        left join workspace_usage on workspace_usage.workspace_id = w.id
        left join storage on storage.workspace_id = w.id
        left join conversation_counts on conversation_counts.workspace_id = w.id
        left join assistant_counts on assistant_counts.workspace_id = w.id
        order by w.updated_at desc
        limit 100
      `).then((rows) => Array.from(rows) as unknown as WorkspaceRow[]),
      db
        .select({
          id: platformAdminAuditLogs.id,
          action: platformAdminAuditLogs.action,
          resourceType: platformAdminAuditLogs.resourceType,
          resourceId: platformAdminAuditLogs.resourceId,
          metadata: platformAdminAuditLogs.metadata,
          createdAt: platformAdminAuditLogs.createdAt,
          adminUsername: platformAdmins.username,
        })
        .from(platformAdminAuditLogs)
        .leftJoin(
          platformAdmins,
          eq(platformAdmins.id, platformAdminAuditLogs.adminId),
        )
        .orderBy(desc(platformAdminAuditLogs.createdAt))
        .limit(20),
    ]);

  const row = overviewRows[0];
  const requestCount = asNumber(row?.request_count_30d);
  const completedCount = asNumber(row?.completed_count_30d);
  const failedCount = asNumber(row?.failed_count_30d);

  return {
    overview: {
      users: asNumber(row?.user_count),
      activeUsers: asNumber(row?.active_user_count),
      suspendedUsers: asNumber(row?.suspended_user_count),
      activeUsers24h: asNumber(row?.active_24h_count),
      newUsers7d: asNumber(row?.new_users_7d),
      workspaces: asNumber(row?.workspace_count),
      requestCount,
      completedCount,
      failedCount,
      successRate:
        completedCount + failedCount > 0
          ? (completedCount / (completedCount + failedCount)) * 100
          : 100,
      inputTokens: asNumber(row?.input_tokens_30d),
      outputTokens: asNumber(row?.output_tokens_30d),
      estimatedCostUsd: asNumber(row?.cost_usd_30d),
      conversations: asNumber(row?.conversation_count),
      messages: asNumber(row?.message_count),
      documents: asNumber(row?.document_count),
      storageBytes: asNumber(row?.storage_bytes),
      chunks: asNumber(row?.chunk_count),
      providers: asNumber(row?.provider_count),
      mcpSources: asNumber(row?.mcp_count),
      skills: asNumber(row?.skill_count),
      assistants: asNumber(row?.assistant_count),
      databaseBytes: asNumber(row?.database_bytes),
    },
    dailyUsage: dailyRows.map((item) => ({
      day: item.day,
      requests: asNumber(item.requests),
      tokens: asNumber(item.tokens),
    })),
    users: userRows.map((item) => ({
      id: item.id,
      displayName: item.display_name,
      email: item.email,
      externalAuthId: item.external_auth_id,
      status: item.status,
      createdAt: asIso(item.created_at)!,
      lastSeenAt: asIso(item.last_seen_at),
      workspaceCount: asNumber(item.workspace_count),
      requestCount30d: asNumber(item.request_count_30d),
      tokenCount30d: asNumber(item.token_count_30d),
      storageBytes: asNumber(item.storage_bytes),
    })),
    workspaces: workspaceRows.map((item) => ({
      id: item.id,
      name: item.name,
      ownerName: item.owner_name,
      memberCount: asNumber(item.member_count),
      requestCount30d: asNumber(item.request_count_30d),
      tokenCount30d: asNumber(item.token_count_30d),
      storageBytes: asNumber(item.storage_bytes),
      documentCount: asNumber(item.document_count),
      conversationCount: asNumber(item.conversation_count),
      assistantCount: asNumber(item.assistant_count),
      updatedAt: asIso(item.updated_at)!,
    })),
    auditLogs: auditRows.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function setPlatformUserStatus(
  admin: PlatformAdminIdentity,
  userId: string,
  status: "active" | "suspended",
) {
  const db = getDb();
  const now = new Date();
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({
        status,
        suspendedAt: status === "suspended" ? now : null,
        suspendedReason:
          status === "suspended" ? "由平台管理员暂停" : null,
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning({ id: users.id, externalAuthId: users.externalAuthId });

    if (!updated) return null;
    await tx.insert(platformAdminAuditLogs).values({
      adminId: admin.id,
      action: status === "suspended" ? "user.suspended" : "user.restored",
      resourceType: "user",
      resourceId: updated.id,
      metadata: { externalAuthId: updated.externalAuthId },
    });
    return updated;
  });
}
