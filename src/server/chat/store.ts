import "server-only";

import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import type { UIMessage } from "ai";
import type {
  ConversationBranch,
  ConversationListItem,
} from "@/lib/conversations";
import { getDb } from "@/server/db";
import {
  conversationBranches,
  conversations,
  messages,
} from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";

function firstUserText(chatMessages: UIMessage[]) {
  const message = chatMessages.find((item) => item.role === "user");
  return (
    message?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim() ?? ""
  );
}

export async function listConversations(context: WorkspaceContext) {
  const rows = await getDb()
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
      archived: conversations.archived,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, context.workspaceId),
        eq(conversations.userId, context.userId),
        eq(conversations.archived, false),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(50);

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  })) satisfies ConversationListItem[];
}

export async function createConversation(
  context: WorkspaceContext,
  title = "新对话",
) {
  const db = getDb();
  const [conversation] = await db
    .insert(conversations)
    .values({
      workspaceId: context.workspaceId,
      userId: context.userId,
      title,
    })
    .returning({ id: conversations.id, title: conversations.title });

  const [branch] = await db
    .insert(conversationBranches)
    .values({
      conversationId: conversation.id,
      name: "主分支",
      isDefault: true,
    })
    .returning({ id: conversationBranches.id });

  return { ...conversation, branchId: branch.id };
}

export async function getConversation(
  context: WorkspaceContext,
  conversationId: string,
) {
  const [conversation] = await getDb()
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, context.workspaceId),
        eq(conversations.userId, context.userId),
      ),
    )
    .limit(1);

  return conversation ?? null;
}

/**
 * Gives pre-branch conversations a default branch on first access. This keeps
 * the schema migration deployable without a blocking data backfill.
 */
export async function ensureDefaultBranch(
  context: WorkspaceContext,
  conversationId: string,
) {
  const conversation = await getConversation(context, conversationId);
  if (!conversation) return null;

  const db = getDb();
  const [existing] = await db
    .select()
    .from(conversationBranches)
    .where(
      and(
        eq(conversationBranches.conversationId, conversationId),
        eq(conversationBranches.isDefault, true),
      ),
    )
    .limit(1);

  let branch = existing;
  if (!branch) {
    try {
      [branch] = await db
        .insert(conversationBranches)
        .values({ conversationId, name: "主分支", isDefault: true })
        .returning();
    } catch {
      [branch] = await db
        .select()
        .from(conversationBranches)
        .where(
          and(
            eq(conversationBranches.conversationId, conversationId),
            eq(conversationBranches.isDefault, true),
          ),
        )
        .limit(1);
    }
  }

  if (!branch) return null;

  await db
    .update(messages)
    .set({ branchId: branch.id, updatedAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        isNull(messages.branchId),
      ),
    );

  return branch;
}

export async function getConversationBranch(
  context: WorkspaceContext,
  conversationId: string,
  branchId?: string,
) {
  if (!branchId) return ensureDefaultBranch(context, conversationId);

  const conversation = await getConversation(context, conversationId);
  if (!conversation) return null;

  const [branch] = await getDb()
    .select()
    .from(conversationBranches)
    .where(
      and(
        eq(conversationBranches.id, branchId),
        eq(conversationBranches.conversationId, conversationId),
      ),
    )
    .limit(1);

  return branch ?? null;
}

export async function listConversationBranches(
  context: WorkspaceContext,
  conversationId: string,
): Promise<ConversationBranch[] | null> {
  const defaultBranch = await ensureDefaultBranch(context, conversationId);
  if (!defaultBranch) return null;

  const rows = await getDb()
    .select({
      id: conversationBranches.id,
      conversationId: conversationBranches.conversationId,
      parentBranchId: conversationBranches.parentBranchId,
      forkedFromClientMessageId:
        conversationBranches.forkedFromClientMessageId,
      name: conversationBranches.name,
      isDefault: conversationBranches.isDefault,
      createdAt: conversationBranches.createdAt,
      messageCount: count(messages.id),
    })
    .from(conversationBranches)
    .leftJoin(messages, eq(messages.branchId, conversationBranches.id))
    .where(eq(conversationBranches.conversationId, conversationId))
    .groupBy(conversationBranches.id)
    .orderBy(asc(conversationBranches.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    messageCount: Number(row.messageCount),
  }));
}

export async function loadConversationMessages(
  context: WorkspaceContext,
  conversationId: string,
  branchId?: string,
): Promise<UIMessage[] | null> {
  const branch = await getConversationBranch(context, conversationId, branchId);
  if (!branch) return null;

  const rows = await getDb()
    .select({
      id: messages.clientMessageId,
      role: messages.role,
      parts: messages.parts,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.branchId, branch.id),
      ),
    )
    .orderBy(asc(messages.sequence));

  return rows
    .filter((row) => row.role !== "tool")
    .map((row) => ({
      id: row.id,
      role: row.role as UIMessage["role"],
      parts: row.parts as UIMessage["parts"],
    }));
}

/** Append-only persistence: existing completed messages are never deleted. */
export async function saveConversationMessages({
  context,
  conversationId,
  branchId,
  chatMessages,
  modelId,
}: {
  context: WorkspaceContext;
  conversationId: string;
  branchId?: string;
  chatMessages: UIMessage[];
  modelId: string;
}) {
  const branch = await getConversationBranch(context, conversationId, branchId);
  if (!branch) throw new Error("Conversation branch not found.");

  const db = getDb();
  const existingRows = await db
    .select({ clientMessageId: messages.clientMessageId, sequence: messages.sequence })
    .from(messages)
    .where(eq(messages.branchId, branch.id));
  const existingIds = new Set(existingRows.map((row) => row.clientMessageId));
  let sequence = existingRows.reduce((max, row) => Math.max(max, row.sequence), -1) + 1;

  for (const message of chatMessages) {
    if (existingIds.has(message.id)) continue;

    await db.insert(messages).values({
      conversationId,
      branchId: branch.id,
      clientMessageId: message.id,
      role: message.role,
      parts: message.parts,
      modelSnapshot:
        message.role === "assistant" ? { providerModelId: modelId } : null,
      status: "completed",
      sequence,
    });
    existingIds.add(message.id);
    sequence += 1;
  }

  const conversation = await getConversation(context, conversationId);
  const title = firstUserText(chatMessages).slice(0, 48) || conversation?.title;
  await db
    .update(conversations)
    .set({ ...(title ? { title } : {}), updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return branch;
}

export async function forkConversationBranch({
  context,
  conversationId,
  sourceBranchId,
  fromMessageId,
}: {
  context: WorkspaceContext;
  conversationId: string;
  sourceBranchId: string;
  fromMessageId: string;
}) {
  const sourceBranch = await getConversationBranch(
    context,
    conversationId,
    sourceBranchId,
  );
  if (!sourceBranch) return null;

  const db = getDb();
  const sourceMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.branchId, sourceBranch.id))
    .orderBy(asc(messages.sequence));
  const forkIndex = sourceMessages.findIndex(
    (message) => message.clientMessageId === fromMessageId,
  );
  if (forkIndex < 0) return null;

  const branchRows = await db
    .select({ id: conversationBranches.id })
    .from(conversationBranches)
    .where(eq(conversationBranches.conversationId, conversationId));
  const [branch] = await db
    .insert(conversationBranches)
    .values({
      conversationId,
      parentBranchId: sourceBranch.id,
      forkedFromClientMessageId: fromMessageId,
      name: `分支 ${branchRows.length}`,
      isDefault: false,
    })
    .returning();

  const prefix = sourceMessages.slice(0, forkIndex + 1);
  if (prefix.length > 0) {
    await db.insert(messages).values(
      prefix.map((message, sequence) => ({
        conversationId,
        branchId: branch.id,
        clientMessageId: message.clientMessageId,
        role: message.role,
        parts: message.parts,
        modelSnapshot: message.modelSnapshot,
        status: message.status,
        sequence,
        errorCode: message.errorCode,
      })),
    );
  }

  return {
    branch: {
      id: branch.id,
      conversationId: branch.conversationId,
      parentBranchId: branch.parentBranchId,
      forkedFromClientMessageId: branch.forkedFromClientMessageId,
      name: branch.name,
      isDefault: branch.isDefault,
      createdAt: branch.createdAt.toISOString(),
      messageCount: prefix.length,
    } satisfies ConversationBranch,
    messages: prefix
      .filter((row) => row.role !== "tool")
      .map((row) => ({
        id: row.clientMessageId,
        role: row.role as UIMessage["role"],
        parts: row.parts as UIMessage["parts"],
      })),
  };
}

export async function updateConversation(
  context: WorkspaceContext,
  conversationId: string,
  values: { title?: string; archived?: boolean },
) {
  const [updated] = await getDb()
    .update(conversations)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, context.workspaceId),
        eq(conversations.userId, context.userId),
      ),
    )
    .returning({ id: conversations.id, title: conversations.title });

  return updated ?? null;
}

export async function deleteConversation(
  context: WorkspaceContext,
  conversationId: string,
) {
  const [deleted] = await getDb()
    .delete(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, context.workspaceId),
        eq(conversations.userId, context.userId),
      ),
    )
    .returning({ id: conversations.id });

  return Boolean(deleted);
}
