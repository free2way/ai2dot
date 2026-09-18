import "server-only";

import { and, desc, eq } from "drizzle-orm";
import {
  buildSkillPrompt,
  MAX_SKILL_COUNT_PER_WORKSPACE,
  normalizeSkillSlug,
  parseSkillMarkdown,
  selectRelevantSkills,
  type SkillDocument,
  type SkillSummary,
} from "@/lib/skills";
import { getDb } from "@/server/db";
import { skills } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";
import { assertSafeProviderBaseUrl } from "@/server/providers/catalog";

const MAX_SKILL_SOURCE_BYTES = 120_000;
const ALLOWED_SKILL_SOURCE_HOSTS = new Set([
  "raw.githubusercontent.com",
  "gist.githubusercontent.com",
]);

async function hashContent(content: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Buffer.from(digest).toString("hex");
}

function sourceTypeForUrl(sourceUrl?: string | null) {
  if (!sourceUrl) return "manual" as const;
  return sourceUrl.includes("github.com") || sourceUrl.includes("raw.githubusercontent.com")
    ? ("github" as const)
    : ("url" as const);
}

function toSummary(skill: typeof skills.$inferSelect): SkillSummary {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    sourceUrl: skill.sourceUrl,
    enabled: skill.enabled,
    autoLoad: skill.autoLoad,
    keywords: skill.keywords ?? [],
    requiredMcp: skill.requiredMcp ?? [],
    contentHash: skill.contentHash,
    updatedAt: skill.updatedAt.toISOString(),
  };
}

function isSkillTableUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('relation "skills" does not exist') || message.includes("42P01");
}

export async function listSkills(
  context: WorkspaceContext,
): Promise<SkillSummary[]> {
  try {
    const rows = await getDb()
      .select()
      .from(skills)
      .where(eq(skills.workspaceId, context.workspaceId))
      .orderBy(desc(skills.updatedAt));
    return rows.map(toSummary);
  } catch (error) {
    // Keep older deployments usable while migration 0010 is rolling out.
    if (isSkillTableUnavailable(error)) return [];
    throw error;
  }
}

async function getOwnedSkill(context: WorkspaceContext, skillId: string) {
  const [skill] = await getDb()
    .select()
    .from(skills)
    .where(
      and(
        eq(skills.id, skillId),
        eq(skills.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  return skill ?? null;
}

export async function getSkillDocument(context: WorkspaceContext, skillId: string) {
  const skill = await getOwnedSkill(context, skillId);
  if (!skill) return null;
  return {
    ...toSummary(skill),
    markdown: skill.instructions,
  };
}

function normalizeDocument(input: {
  markdown?: string;
  name?: string;
  description?: string;
  version?: string;
  keywords?: string[];
  requiredMcp?: string[];
}): SkillDocument {
  return parseSkillMarkdown(input.markdown ?? "", {
    name: input.name,
    description: input.description,
    version: input.version,
    keywords: input.keywords,
    requiredMcp: input.requiredMcp,
  });
}

async function validateSourceUrl(sourceUrl?: string) {
  if (!sourceUrl) return;
  await assertSafeProviderBaseUrl(sourceUrl);
  const url = new URL(sourceUrl);
  if (!ALLOWED_SKILL_SOURCE_HOSTS.has(url.hostname.toLowerCase()) || !url.pathname.toLowerCase().endsWith(".md")) {
    throw new Error("Skill 来源目前只支持 raw.githubusercontent.com 或 gist.githubusercontent.com 的 HTTPS Markdown 地址。");
  }
}

async function resolveMarkdown(markdown: string | undefined, sourceUrl?: string) {
  if (markdown?.trim()) return markdown.trim();
  if (!sourceUrl) throw new Error("请粘贴 SKILL.md，或填写可公开访问的 GitHub raw Markdown 地址。");
  await validateSourceUrl(sourceUrl);
  const response = await fetch(sourceUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Skill 来源读取失败（HTTP ${response.status}）。`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SKILL_SOURCE_BYTES) throw new Error("Skill 来源文件过大。");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_SKILL_SOURCE_BYTES) {
    throw new Error("Skill 来源文件过大。");
  }
  return text;
}

export async function createSkill(
  context: WorkspaceContext,
  input: {
    markdown?: string;
    name?: string;
    description?: string;
    version?: string;
    keywords?: string[];
    requiredMcp?: string[];
    sourceUrl?: string;
    enabled?: boolean;
    autoLoad?: boolean;
  },
) {
  const existing = await getDb()
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.workspaceId, context.workspaceId));
  if (existing.length >= MAX_SKILL_COUNT_PER_WORKSPACE) {
    throw new Error(`每个工作区最多安装 ${MAX_SKILL_COUNT_PER_WORKSPACE} 个 Skill。`);
  }
  await validateSourceUrl(input.sourceUrl);
  const markdown = await resolveMarkdown(input.markdown, input.sourceUrl);
  const document = normalizeDocument({ ...input, markdown });
  const contentHash = await hashContent(markdown);
  const [created] = await getDb()
    .insert(skills)
    .values({
      workspaceId: context.workspaceId,
      name: document.name,
      slug: `${normalizeSkillSlug(document.name)}-${contentHash.slice(0, 8)}`,
      description: document.description,
      version: document.version,
      sourceType: sourceTypeForUrl(input.sourceUrl),
      sourceUrl: input.sourceUrl || null,
      instructions: document.instructions,
      keywords: document.keywords,
      requiredMcp: document.requiredMcp,
      contentHash,
      enabled: input.enabled ?? true,
      autoLoad: input.autoLoad ?? true,
    })
    .returning();
  return created ? toSummary(created) : null;
}

export async function updateSkill(
  context: WorkspaceContext,
  skillId: string,
  input: {
    markdown?: string;
    name?: string;
    description?: string;
    version?: string;
    keywords?: string[];
    requiredMcp?: string[];
    sourceUrl?: string;
    enabled: boolean;
    autoLoad: boolean;
  },
) {
  const existing = await getOwnedSkill(context, skillId);
  if (!existing) return null;
  await validateSourceUrl(input.sourceUrl);
  const markdown = await resolveMarkdown(input.markdown, input.sourceUrl);
  const document = normalizeDocument({ ...input, markdown });
  const contentHash = await hashContent(markdown);
  const [updated] = await getDb()
    .update(skills)
    .set({
      name: document.name,
      description: document.description,
      version: document.version,
      sourceType: sourceTypeForUrl(input.sourceUrl),
      sourceUrl: input.sourceUrl || null,
      instructions: document.instructions,
      keywords: document.keywords,
      requiredMcp: document.requiredMcp,
      contentHash,
      enabled: input.enabled,
      autoLoad: input.autoLoad,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skillId))
    .returning();
  return updated ? toSummary(updated) : null;
}

export async function deleteSkill(context: WorkspaceContext, skillId: string) {
  const [deleted] = await getDb()
    .delete(skills)
    .where(
      and(
        eq(skills.id, skillId),
        eq(skills.workspaceId, context.workspaceId),
      ),
    )
    .returning({ id: skills.id });
  return Boolean(deleted);
}

export async function updateSkillStatus(
  context: WorkspaceContext,
  skillId: string,
  values: { enabled?: boolean; autoLoad?: boolean },
) {
  const [updated] = await getDb()
    .update(skills)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(skills.id, skillId),
        eq(skills.workspaceId, context.workspaceId),
      ),
    )
    .returning();
  return updated ? toSummary(updated) : null;
}

export async function getEnabledSkillContext(
  context: WorkspaceContext,
  query: string,
) {
  try {
    const rows = await getDb()
      .select({
        name: skills.name,
        description: skills.description,
        version: skills.version,
        keywords: skills.keywords,
        requiredMcp: skills.requiredMcp,
        instructions: skills.instructions,
        autoLoad: skills.autoLoad,
      })
      .from(skills)
      .where(
        and(
          eq(skills.workspaceId, context.workspaceId),
          eq(skills.enabled, true),
        ),
      )
      .orderBy(desc(skills.updatedAt));
    const selected = selectRelevantSkills(rows, query);
    return {
      selected,
      prompt: buildSkillPrompt(selected),
    };
  } catch (error) {
    if (isSkillTableUnavailable(error)) return { selected: [], prompt: "" };
    throw error;
  }
}
