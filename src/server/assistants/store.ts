import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { AssistantInput, AssistantSummary } from "@/lib/assistants";
import { normalizeAssistantAvatar } from "@/lib/assistants";
import { getDb } from "@/server/db";
import {
  assistantKnowledgeBases,
  assistantMcpSources,
  assistantSkills,
  assistants,
  knowledgeBases,
  mcpSources,
  skills,
  skillVersions,
} from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";

type AssistantDb = Pick<ReturnType<typeof getDb>, "select" | "insert" | "update" | "delete">;

async function ownedKnowledgeBaseIds(
  context: WorkspaceContext,
  knowledgeBaseIds: string[],
  db: AssistantDb,
) {
  if (knowledgeBaseIds.length === 0) return [];
  const rows = await db
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
  db: AssistantDb,
) {
  if (sourceIds.length === 0) return [];
  const rows = await db
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
  const [links, mcpLinks, skillLinks] = await Promise.all([
    db
      .select()
      .from(assistantKnowledgeBases)
      .where(inArray(assistantKnowledgeBases.assistantId, assistantIds)),
    db
      .select()
      .from(assistantMcpSources)
      .where(inArray(assistantMcpSources.assistantId, assistantIds)),
    db
      .select()
      .from(assistantSkills)
      .where(inArray(assistantSkills.assistantId, assistantIds))
      .orderBy(asc(assistantSkills.position)),
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
  const skillsByAssistant = new Map<
    string,
    Array<{ skillId: string; versionId: string }>
  >();
  for (const link of skillLinks) {
    skillsByAssistant.set(link.assistantId, [
      ...(skillsByAssistant.get(link.assistantId) ?? []),
      { skillId: link.skillId, versionId: link.skillVersionId },
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
    skillSelection: {
      mode: row.skillMode,
      contextTarget: row.skillContextTarget,
      refs: skillsByAssistant.get(row.id) ?? [],
    },
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

  const [links, mcpLinks, skillLinks] = await Promise.all([
    getDb()
      .select({ knowledgeBaseId: assistantKnowledgeBases.knowledgeBaseId })
      .from(assistantKnowledgeBases)
      .where(eq(assistantKnowledgeBases.assistantId, assistantId)),
    getDb()
      .select({ mcpSourceId: assistantMcpSources.mcpSourceId })
      .from(assistantMcpSources)
      .where(eq(assistantMcpSources.assistantId, assistantId)),
    getDb()
      .select({
        skillId: assistantSkills.skillId,
        versionId: assistantSkills.skillVersionId,
      })
      .from(assistantSkills)
      .where(eq(assistantSkills.assistantId, assistantId))
      .orderBy(asc(assistantSkills.position)),
  ]);
  return {
    ...assistant,
    knowledgeBaseIds: links.map((link) => link.knowledgeBaseId),
    mcpSourceIds: mcpLinks.map((link) => link.mcpSourceId),
    skillSelection: {
      mode: assistant.skillMode,
      contextTarget: assistant.skillContextTarget,
      refs: skillLinks,
    },
  };
}

async function replaceKnowledgeBases(
  context: WorkspaceContext,
  assistantId: string,
  requestedIds: string[],
  db: AssistantDb,
) {
  const knowledgeBaseIds = await ownedKnowledgeBaseIds(
    context,
    [...new Set(requestedIds)].slice(0, 3),
    db,
  );
  await db
    .delete(assistantKnowledgeBases)
    .where(eq(assistantKnowledgeBases.assistantId, assistantId));
  if (knowledgeBaseIds.length > 0) {
    await db.insert(assistantKnowledgeBases).values(
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
  db: AssistantDb,
) {
  const mcpSourceIds = await ownedEnabledMcpSourceIds(
    context,
    [...new Set(requestedIds)].slice(0, 10),
    db,
  );
  await db
    .delete(assistantMcpSources)
    .where(eq(assistantMcpSources.assistantId, assistantId));
  if (mcpSourceIds.length > 0) {
    await db.insert(assistantMcpSources).values(
      mcpSourceIds.map((mcpSourceId) => ({ assistantId, mcpSourceId })),
    );
  }
  return mcpSourceIds;
}

async function validateSkillSelection(
  context: WorkspaceContext,
  input: AssistantInput["skillSelection"],
  db: AssistantDb,
) {
  const refs = input.refs.slice(0, 3);
  if (refs.length > 0) {
    const rows = await db
      .select({ skillId: skills.id, versionId: skillVersions.id })
      .from(skillVersions)
      .innerJoin(skills, eq(skills.id, skillVersions.skillId))
      .where(
        and(
          eq(skills.workspaceId, context.workspaceId),
          eq(skills.enabled, true),
          isNull(skills.archivedAt),
          isNull(skillVersions.revokedAt),
          inArray(skills.id, refs.map((reference) => reference.skillId)),
          inArray(
            skillVersions.id,
            refs.map((reference) => reference.versionId),
          ),
        ),
      )
      .for("share");
    const valid = new Set(
      rows.map((row) => `${row.skillId}:${row.versionId}`),
    );
    if (
      refs.some(
        (reference) =>
          !valid.has(`${reference.skillId}:${reference.versionId}`),
      )
    ) {
      throw new Error("助手引用了不可用的 Skill 版本。");
    }
  }
  return refs;
}

async function replaceSkills(
  context: WorkspaceContext,
  assistantId: string,
  input: AssistantInput["skillSelection"],
  db: AssistantDb,
) {
  const refs = await validateSkillSelection(context, input, db);
  await db
    .delete(assistantSkills)
    .where(eq(assistantSkills.assistantId, assistantId));
  if (refs.length > 0) {
    await db.insert(assistantSkills).values(
      refs.map((reference, position) => ({
        assistantId,
        skillId: reference.skillId,
        skillVersionId: reference.versionId,
        position,
      })),
    );
  }
  return { ...input, refs };
}

export async function createAssistant(
  context: WorkspaceContext,
  input: AssistantInput,
) {
  return getDb().transaction(async (tx) => {
    await validateSkillSelection(context, input.skillSelection, tx);
    const [assistant] = await tx
      .insert(assistants)
      .values({
        workspaceId: context.workspaceId,
        name: input.name,
        avatar: normalizeAssistantAvatar(input.avatar, input.name),
        description: input.description || null,
        systemPrompt: input.systemPrompt,
        welcomeMessage: input.welcomeMessage || null,
        defaultModelKey: input.defaultModelKey || null,
        skillMode: input.skillSelection.mode,
        skillContextTarget: input.skillSelection.contextTarget,
      })
      .returning();
    const knowledgeBaseIds = await replaceKnowledgeBases(context, assistant.id, input.knowledgeBaseIds, tx);
    const mcpSourceIds = await replaceMcpSources(context, assistant.id, input.mcpSourceIds, tx);
    const skillSelection = await replaceSkills(context, assistant.id, input.skillSelection, tx);
    return { ...assistant, knowledgeBaseIds, mcpSourceIds, skillSelection };
  });
}

export async function updateAssistant(
  context: WorkspaceContext,
  assistantId: string,
  input: AssistantInput,
) {
  return getDb().transaction(async (tx) => {
    const [assistant] = await tx
      .update(assistants)
      .set({
        name: input.name,
        avatar: normalizeAssistantAvatar(input.avatar, input.name),
        description: input.description || null,
        systemPrompt: input.systemPrompt,
        welcomeMessage: input.welcomeMessage || null,
        defaultModelKey: input.defaultModelKey || null,
        skillMode: input.skillSelection.mode,
        skillContextTarget: input.skillSelection.contextTarget,
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
    const knowledgeBaseIds = await replaceKnowledgeBases(context, assistantId, input.knowledgeBaseIds, tx);
    const mcpSourceIds = await replaceMcpSources(context, assistantId, input.mcpSourceIds, tx);
    const skillSelection = await replaceSkills(context, assistantId, input.skillSelection, tx);
    return { ...assistant, knowledgeBaseIds, mcpSourceIds, skillSelection };
  });
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
