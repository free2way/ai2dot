import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import type { AssistantInput, AssistantSummary } from "@/lib/assistants";
import { normalizeAssistantAvatar } from "@/lib/assistants";
import { getDb } from "@/server/db";
import {
  assistantKnowledgeBases,
  assistantMcpSources,
  assistants,
  knowledgeBases,
  mcpSources,
} from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";

async function ownedKnowledgeBaseIds(
  context: WorkspaceContext,
  knowledgeBaseIds: string[],
) {
  if (knowledgeBaseIds.length === 0) return [];
  const rows = await getDb()
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(
      and(
        eq(knowledgeBases.workspaceId, context.workspaceId),
        inArray(knowledgeBases.id, knowledgeBaseIds),
      ),
    );
  return rows.map((row) => row.id);
}

async function ownedEnabledMcpSourceIds(
  context: WorkspaceContext,
  sourceIds: string[],
) {
  if (sourceIds.length === 0) return [];
  const rows = await getDb()
    .select({ id: mcpSources.id })
    .from(mcpSources)
    .where(
      and(
        eq(mcpSources.workspaceId, context.workspaceId),
        eq(mcpSources.enabled, true),
        inArray(mcpSources.id, sourceIds),
      ),
    );
  return rows.map((row) => row.id);
}

export async function listAssistants(
  context: WorkspaceContext,
): Promise<AssistantSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(assistants)
    .where(eq(assistants.workspaceId, context.workspaceId))
    .orderBy(desc(assistants.updatedAt));
  if (rows.length === 0) return [];

  const assistantIds = rows.map((row) => row.id);
  const [links, mcpLinks] = await Promise.all([
    db
      .select()
      .from(assistantKnowledgeBases)
      .where(inArray(assistantKnowledgeBases.assistantId, assistantIds)),
    db
      .select()
      .from(assistantMcpSources)
      .where(inArray(assistantMcpSources.assistantId, assistantIds)),
  ]);
  const knowledgeByAssistant = new Map<string, string[]>();
  for (const link of links) {
    knowledgeByAssistant.set(link.assistantId, [
      ...(knowledgeByAssistant.get(link.assistantId) ?? []),
      link.knowledgeBaseId,
    ]);
  }
  const mcpByAssistant = new Map<string, string[]>();
  for (const link of mcpLinks) {
    mcpByAssistant.set(link.assistantId, [
      ...(mcpByAssistant.get(link.assistantId) ?? []),
      link.mcpSourceId,
    ]);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    description: row.description,
    systemPrompt: row.systemPrompt,
    welcomeMessage: row.welcomeMessage,
    defaultModelKey: row.defaultModelKey,
    knowledgeBaseIds: knowledgeByAssistant.get(row.id) ?? [],
    mcpSourceIds: mcpByAssistant.get(row.id) ?? [],
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getAssistant(
  context: WorkspaceContext,
  assistantId: string,
) {
  const [assistant] = await getDb()
    .select()
    .from(assistants)
    .where(
      and(
        eq(assistants.id, assistantId),
        eq(assistants.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  if (!assistant) return null;

  const [links, mcpLinks] = await Promise.all([
    getDb()
      .select({ knowledgeBaseId: assistantKnowledgeBases.knowledgeBaseId })
      .from(assistantKnowledgeBases)
      .where(eq(assistantKnowledgeBases.assistantId, assistantId)),
    getDb()
      .select({ mcpSourceId: assistantMcpSources.mcpSourceId })
      .from(assistantMcpSources)
      .where(eq(assistantMcpSources.assistantId, assistantId)),
  ]);
  return {
    ...assistant,
    knowledgeBaseIds: links.map((link) => link.knowledgeBaseId),
    mcpSourceIds: mcpLinks.map((link) => link.mcpSourceId),
  };
}

async function replaceKnowledgeBases(
  context: WorkspaceContext,
  assistantId: string,
  requestedIds: string[],
) {
  const knowledgeBaseIds = await ownedKnowledgeBaseIds(
    context,
    [...new Set(requestedIds)].slice(0, 3),
  );
  await getDb()
    .delete(assistantKnowledgeBases)
    .where(eq(assistantKnowledgeBases.assistantId, assistantId));
  if (knowledgeBaseIds.length > 0) {
    await getDb().insert(assistantKnowledgeBases).values(
      knowledgeBaseIds.map((knowledgeBaseId) => ({
        assistantId,
        knowledgeBaseId,
      })),
    );
  }
  return knowledgeBaseIds;
}

async function replaceMcpSources(
  context: WorkspaceContext,
  assistantId: string,
  requestedIds: string[],
) {
  const mcpSourceIds = await ownedEnabledMcpSourceIds(
    context,
    [...new Set(requestedIds)].slice(0, 10),
  );
  await getDb()
    .delete(assistantMcpSources)
    .where(eq(assistantMcpSources.assistantId, assistantId));
  if (mcpSourceIds.length > 0) {
    await getDb().insert(assistantMcpSources).values(
      mcpSourceIds.map((mcpSourceId) => ({ assistantId, mcpSourceId })),
    );
  }
  return mcpSourceIds;
}

export async function createAssistant(
  context: WorkspaceContext,
  input: AssistantInput,
) {
  const [assistant] = await getDb()
    .insert(assistants)
    .values({
      workspaceId: context.workspaceId,
      name: input.name,
      avatar: normalizeAssistantAvatar(input.avatar, input.name),
      description: input.description || null,
      systemPrompt: input.systemPrompt,
      welcomeMessage: input.welcomeMessage || null,
      defaultModelKey: input.defaultModelKey || null,
    })
    .returning();
  const [knowledgeBaseIds, mcpSourceIds] = await Promise.all([
    replaceKnowledgeBases(context, assistant.id, input.knowledgeBaseIds),
    replaceMcpSources(context, assistant.id, input.mcpSourceIds),
  ]);
  return { ...assistant, knowledgeBaseIds, mcpSourceIds };
}

export async function updateAssistant(
  context: WorkspaceContext,
  assistantId: string,
  input: AssistantInput,
) {
  const [assistant] = await getDb()
    .update(assistants)
    .set({
      name: input.name,
      avatar: normalizeAssistantAvatar(input.avatar, input.name),
      description: input.description || null,
      systemPrompt: input.systemPrompt,
      welcomeMessage: input.welcomeMessage || null,
      defaultModelKey: input.defaultModelKey || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(assistants.id, assistantId),
        eq(assistants.workspaceId, context.workspaceId),
      ),
    )
    .returning();
  if (!assistant) return null;
  const [knowledgeBaseIds, mcpSourceIds] = await Promise.all([
    replaceKnowledgeBases(context, assistantId, input.knowledgeBaseIds),
    replaceMcpSources(context, assistantId, input.mcpSourceIds),
  ]);
  return { ...assistant, knowledgeBaseIds, mcpSourceIds };
}

export async function deleteAssistant(
  context: WorkspaceContext,
  assistantId: string,
) {
  const [deleted] = await getDb()
    .delete(assistants)
    .where(
      and(
        eq(assistants.id, assistantId),
        eq(assistants.workspaceId, context.workspaceId),
      ),
    )
    .returning({ id: assistants.id });
  return Boolean(deleted);
}
