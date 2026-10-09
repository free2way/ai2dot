import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { MCP_PRESETS } from "@/lib/mcp-presets";
import {
  BUILT_IN_SKILL_PRESETS,
  getSkillCatalogEntry,
  SKILL_CATALOG,
  type SkillCatalogEntry,
} from "@/lib/skill-presets";
import type {
  ResolvedSkillSnapshot,
  SkillDependency,
  SkillReference,
} from "@/lib/skill-selection";
import {
  MAX_SKILL_COUNT_PER_WORKSPACE,
  buildSkillPrompt,
  normalizeSkillSlug,
  parseSkillMarkdown,
  selectRelevantSkills,
  type SkillDocument,
  type SkillSummary,
} from "@/lib/skills";
import { getDb } from "@/server/db";
import { mcpSources, skills, skillVersions } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/db/workspace";
import { assertSafeProviderBaseUrl } from "@/server/providers/catalog";

const MAX_SKILL_SOURCE_BYTES = 120_000;
const ALLOWED_SKILL_SOURCE_HOSTS = new Set([
  "raw.githubusercontent.com",
  "gist.githubusercontent.com",
]);

type SkillRow = typeof skills.$inferSelect;
type SkillVersionRow = typeof skillVersions.$inferSelect;

async function sha256(content: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Buffer.from(digest).toString("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function hashSkillVersion(input: {
  document: SkillDocument;
  dependencies: SkillDependency[];
}) {
  return sha256(
    stableJson({
      name: input.document.name,
      description: input.document.description,
      version: input.document.version,
      instructions: input.document.instructions,
      keywords: input.document.keywords,
      requiredMcp: input.document.requiredMcp,
      dependencies: input.dependencies,
    }),
  );
}

function sourceTypeForUrl(sourceUrl?: string | null) {
  if (!sourceUrl) return "manual" as const;
  return sourceUrl.includes("github.com") ||
    sourceUrl.includes("raw.githubusercontent.com")
    ? ("github" as const)
    : ("url" as const);
}

function toSummary(skill: SkillRow, version?: SkillVersionRow | null): SkillSummary {
  return {
    id: skill.id,
    name: version?.name ?? skill.name,
    description: version?.description ?? skill.description,
    version: version?.version ?? skill.version,
    sourceUrl: skill.sourceUrl,
    builtIn: skill.sourceType === "builtin",
    enabled: skill.enabled && !skill.archivedAt,
    autoLoad: skill.autoLoad,
    keywords: version?.keywords ?? skill.keywords ?? [],
    requiredMcp: version?.legacyRequiredMcp ?? skill.requiredMcp ?? [],
    contentHash: version?.contentHash ?? skill.contentHash,
    slug: skill.slug,
    category: skill.category,
    catalogId: skill.catalogId,
    versionId: version?.id ?? skill.currentVersionId,
    dependencies: version?.dependencyManifest ?? [],
    updatedAt: skill.updatedAt.toISOString(),
  };
}

async function loadCurrentVersions(rows: SkillRow[]) {
  const versionIds = rows.flatMap((row) =>
    row.currentVersionId ? [row.currentVersionId] : [],
  );
  if (versionIds.length === 0) return new Map<string, SkillVersionRow>();
  const versions = await getDb()
    .select()
    .from(skillVersions)
    .where(inArray(skillVersions.id, versionIds));
  return new Map(versions.map((version) => [version.id, version]));
}

async function createImmutableVersion({
  skill,
  document,
  dependencies,
  createdByUserId,
  changeNotes,
}: {
  skill: SkillRow;
  document: SkillDocument;
  dependencies: SkillDependency[];
  createdByUserId?: string | null;
  changeNotes?: string | null;
}) {
  const contentHash = await hashSkillVersion({ document, dependencies });
  const db = getDb();
  await db
    .insert(skillVersions)
    .values({
      skillId: skill.id,
      version: document.version,
      name: document.name,
      description: document.description,
      instructions: document.instructions,
      keywords: document.keywords,
      dependencyManifest: dependencies,
      legacyRequiredMcp: document.requiredMcp,
      contentHash,
      createdByUserId: createdByUserId || null,
      changeNotes: changeNotes || null,
    })
    .onConflictDoNothing({
      target: [skillVersions.skillId, skillVersions.contentHash],
    });
  const [version] = await db
    .select()
    .from(skillVersions)
    .where(
      and(
        eq(skillVersions.skillId, skill.id),
        eq(skillVersions.contentHash, contentHash),
      ),
    )
    .limit(1);
  if (!version) throw new Error("Skill 版本无法创建。");
  return version;
}

async function ensureBuiltInSkills(context: WorkspaceContext) {
  for (const preset of BUILT_IN_SKILL_PRESETS) {
    const catalog = getSkillCatalogEntry(preset.id)!;
    const legacyHash = await sha256(preset.instructions);
    await getDb()
      .insert(skills)
      .values({
        workspaceId: context.workspaceId,
        name: preset.name,
        slug: `builtin-${preset.id}`,
        catalogId: preset.id,
        category: catalog.category,
        description: preset.description,
        version: preset.version,
        sourceType: "builtin",
        sourceUrl: catalog.sourceUrl,
        instructions: preset.instructions,
        keywords: preset.keywords,
        requiredMcp: preset.requiredMcp,
        contentHash: legacyHash,
        enabled: true,
        autoLoad: true,
      })
      .onConflictDoNothing({ target: [skills.workspaceId, skills.slug] });

    const [installed] = await getDb()
      .select()
      .from(skills)
      .where(
        and(
          eq(skills.workspaceId, context.workspaceId),
          eq(skills.slug, `builtin-${preset.id}`),
        ),
      )
      .limit(1);
    if (!installed) continue;

    const version = await createImmutableVersion({
      skill: installed,
      document: preset,
      dependencies: catalog.dependencies,
      changeNotes: catalog.changeNotes,
    });
    const [boundVersion] = installed.currentVersionId
      ? await getDb()
          .select({ contentHash: skillVersions.contentHash })
          .from(skillVersions)
          .where(eq(skillVersions.id, installed.currentVersionId))
          .limit(1)
      : [];
    const shouldBindCatalogVersion =
      !installed.currentVersionId ||
      boundVersion?.contentHash === installed.contentHash;
    await getDb()
      .update(skills)
      .set({
        catalogId: preset.id,
        category: catalog.category,
        sourceUrl: installed.sourceUrl ?? catalog.sourceUrl,
        currentVersionId: shouldBindCatalogVersion
          ? version.id
          : installed.currentVersionId,
        updatedAt: shouldBindCatalogVersion ? new Date() : installed.updatedAt,
      })
      .where(eq(skills.id, installed.id));
  }
}

function isSkillSchemaUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('relation "skills" does not exist') ||
    message.includes('relation "skill_versions" does not exist') ||
    message.includes('column "current_version_id" does not exist') ||
    message.includes("42P01") ||
    message.includes("42703")
  );
}

export async function listSkills(
  context: WorkspaceContext,
): Promise<SkillSummary[]> {
  try {
    await ensureBuiltInSkills(context);
    const rows = await getDb()
      .select()
      .from(skills)
      .where(
        and(
          eq(skills.workspaceId, context.workspaceId),
          isNull(skills.archivedAt),
        ),
      )
      .orderBy(desc(skills.updatedAt));
    const versions = await loadCurrentVersions(rows);
    return rows.map((row) =>
      toSummary(
        row,
        row.currentVersionId ? versions.get(row.currentVersionId) : undefined,
      ),
    );
  } catch (error) {
    if (isSkillSchemaUnavailable(error)) return [];
    throw error;
  }
}

async function getOwnedSkill(
  context: WorkspaceContext,
  skillId: string,
  includeArchived = false,
) {
  const conditions = [
    eq(skills.id, skillId),
    eq(skills.workspaceId, context.workspaceId),
  ];
  if (!includeArchived) conditions.push(isNull(skills.archivedAt));
  const [skill] = await getDb()
    .select()
    .from(skills)
    .where(and(...conditions))
    .limit(1);
  return skill ?? null;
}

export async function getSkillDocument(
  context: WorkspaceContext,
  skillId: string,
) {
  const skill = await getOwnedSkill(context, skillId);
  if (!skill) return null;
  const [version] = skill.currentVersionId
    ? await getDb()
        .select()
        .from(skillVersions)
        .where(eq(skillVersions.id, skill.currentVersionId))
        .limit(1)
    : [];
  return {
    ...toSummary(skill, version),
    markdown: version?.instructions ?? skill.instructions,
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
  if (
    !ALLOWED_SKILL_SOURCE_HOSTS.has(url.hostname.toLowerCase()) ||
    !url.pathname.toLowerCase().endsWith(".md")
  ) {
    throw new Error(
      "Skill 来源目前只支持 raw.githubusercontent.com 或 gist.githubusercontent.com 的 HTTPS Markdown 地址。",
    );
  }
}

async function resolveMarkdown(markdown: string | undefined, sourceUrl?: string) {
  if (markdown?.trim()) return markdown.trim();
  if (!sourceUrl) {
    throw new Error(
      "请粘贴 SKILL.md，或填写可公开访问的 GitHub raw Markdown 地址。",
    );
  }
  await validateSourceUrl(sourceUrl);
  const response = await fetch(sourceUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Skill 来源读取失败（HTTP ${response.status}）。`);
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SKILL_SOURCE_BYTES) {
    throw new Error("Skill 来源文件过大。");
  }
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
    .where(
      and(
        eq(skills.workspaceId, context.workspaceId),
        isNull(skills.archivedAt),
      ),
    );
  if (existing.length >= MAX_SKILL_COUNT_PER_WORKSPACE) {
    throw new Error(
      `每个工作区最多安装 ${MAX_SKILL_COUNT_PER_WORKSPACE} 个 Skill。`,
    );
  }
  await validateSourceUrl(input.sourceUrl);
  const markdown = await resolveMarkdown(input.markdown, input.sourceUrl);
  const document = normalizeDocument({ ...input, markdown });
  const legacyHash = await sha256(markdown);
  const [created] = await getDb()
    .insert(skills)
    .values({
      workspaceId: context.workspaceId,
      name: document.name,
      slug: `${normalizeSkillSlug(document.name)}-${legacyHash.slice(0, 8)}`,
      description: document.description,
      version: document.version,
      sourceType: sourceTypeForUrl(input.sourceUrl),
      sourceUrl: input.sourceUrl || null,
      instructions: document.instructions,
      keywords: document.keywords,
      requiredMcp: document.requiredMcp,
      contentHash: legacyHash,
      enabled: input.enabled ?? true,
      autoLoad: input.autoLoad ?? true,
    })
    .returning();
  const version = await createImmutableVersion({
    skill: created,
    document,
    dependencies: [],
    createdByUserId: context.userId,
    changeNotes: "Workspace import",
  });
  const [updated] = await getDb()
    .update(skills)
    .set({ currentVersionId: version.id, updatedAt: new Date() })
    .where(eq(skills.id, created.id))
    .returning();
  return toSummary(updated, version);
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
  if (existing.sourceType === "builtin" || existing.catalogId) {
    throw new Error("官方 Skill 请通过 Library 升级；正文不能原地覆盖。");
  }
  await validateSourceUrl(input.sourceUrl);
  const markdown = await resolveMarkdown(input.markdown, input.sourceUrl);
  const document = normalizeDocument({ ...input, markdown });
  const version = await createImmutableVersion({
    skill: existing,
    document,
    dependencies: [],
    createdByUserId: context.userId,
    changeNotes: "Workspace update",
  });
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
      contentHash: version.contentHash,
      currentVersionId: version.id,
      enabled: input.enabled,
      autoLoad: input.autoLoad,
      policyRevision: existing.policyRevision + 1,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skillId))
    .returning();
  return toSummary(updated, version);
}

export async function deleteSkill(context: WorkspaceContext, skillId: string) {
  const existing = await getOwnedSkill(context, skillId);
  if (!existing) return false;
  const [archived] = await getDb()
    .update(skills)
    .set({
      archivedAt: new Date(),
      enabled: false,
      policyRevision: existing.policyRevision + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(skills.id, skillId),
        eq(skills.workspaceId, context.workspaceId),
      ),
    )
    .returning({ id: skills.id });
  return Boolean(archived);
}

export async function updateSkillStatus(
  context: WorkspaceContext,
  skillId: string,
  values: { enabled?: boolean; autoLoad?: boolean },
) {
  const existing = await getOwnedSkill(context, skillId);
  if (!existing) return null;
  const [updated] = await getDb()
    .update(skills)
    .set({
      ...values,
      policyRevision: existing.policyRevision + 1,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skillId))
    .returning();
  const [version] = updated.currentVersionId
    ? await getDb()
        .select()
        .from(skillVersions)
        .where(eq(skillVersions.id, updated.currentVersionId))
        .limit(1)
    : [];
  return toSummary(updated, version);
}

function catalogDocument(entry: SkillCatalogEntry): SkillDocument {
  return {
    name: entry.name,
    description: entry.description,
    version: entry.version,
    keywords: entry.keywords,
    requiredMcp: entry.requiredMcp,
    instructions: entry.instructions,
  };
}

export async function installCatalogSkill(
  context: WorkspaceContext,
  catalogId: string,
  catalogVersion: string,
) {
  const entry = getSkillCatalogEntry(catalogId, catalogVersion);
  if (!entry) return null;
  await ensureBuiltInSkills(context);
  const [existing] = await getDb()
    .select()
    .from(skills)
    .where(
      and(
        eq(skills.workspaceId, context.workspaceId),
        eq(skills.catalogId, catalogId),
      ),
    )
    .limit(1);

  if (!existing) {
    const activeRows = await getDb()
      .select({ id: skills.id })
      .from(skills)
      .where(
        and(
          eq(skills.workspaceId, context.workspaceId),
          isNull(skills.archivedAt),
        ),
      );
    if (activeRows.length >= MAX_SKILL_COUNT_PER_WORKSPACE) {
      throw new Error(
        `每个工作区最多安装 ${MAX_SKILL_COUNT_PER_WORKSPACE} 个 Skill。`,
      );
    }
  }

  let skill = existing;
  if (!skill) {
    [skill] = await getDb()
      .insert(skills)
      .values({
        workspaceId: context.workspaceId,
        catalogId: entry.id,
        category: entry.category,
        name: entry.name,
        slug: `catalog-${entry.id}`,
        description: entry.description,
        version: entry.version,
        sourceType: "builtin",
        sourceUrl: entry.sourceUrl,
        instructions: entry.instructions,
        keywords: entry.keywords,
        requiredMcp: entry.requiredMcp,
        contentHash: await sha256(entry.instructions),
        enabled: true,
        autoLoad: false,
      })
      .onConflictDoNothing()
      .returning();
  }
  if (!skill) {
    [skill] = await getDb()
      .select()
      .from(skills)
      .where(
        and(
          eq(skills.workspaceId, context.workspaceId),
          eq(skills.catalogId, catalogId),
        ),
      )
      .limit(1);
  }
  if (!skill) throw new Error("Skill 安装身份无法创建。");
  const version = await createImmutableVersion({
    skill,
    document: catalogDocument(entry),
    dependencies: entry.dependencies,
    createdByUserId: context.userId,
    changeNotes: entry.changeNotes,
  });
  const [updated] = await getDb()
    .update(skills)
    .set({
      currentVersionId: version.id,
      archivedAt: null,
      enabled: true,
      category: entry.category,
      policyRevision: skill.policyRevision + 1,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skill.id))
    .returning();
  return toSummary(updated, version);
}

export async function upgradeCatalogSkill(
  context: WorkspaceContext,
  skillId: string,
  catalogVersion: string,
) {
  const skill = await getOwnedSkill(context, skillId);
  if (!skill?.catalogId) return null;
  const entry = getSkillCatalogEntry(skill.catalogId, catalogVersion);
  if (!entry) return null;
  const version = await createImmutableVersion({
    skill,
    document: catalogDocument(entry),
    dependencies: entry.dependencies,
    createdByUserId: context.userId,
    changeNotes: entry.changeNotes,
  });
  const [updated] = await getDb()
    .update(skills)
    .set({
      currentVersionId: version.id,
      name: entry.name,
      description: entry.description,
      version: entry.version,
      instructions: entry.instructions,
      keywords: entry.keywords,
      requiredMcp: entry.requiredMcp,
      contentHash: version.contentHash,
      category: entry.category,
      policyRevision: skill.policyRevision + 1,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skill.id))
    .returning();
  return toSummary(updated, version);
}

export type CatalogSkillSummary = Omit<SkillCatalogEntry, "instructions"> & {
  preview: string;
  installed: boolean;
  installedSkillId: string | null;
  installedVersionId: string | null;
  installedVersion: string | null;
  enabled: boolean;
};

export async function listSkillCatalog(context: WorkspaceContext) {
  const installed = await listSkills(context);
  const byCatalogId = new Map(
    installed.flatMap((skill) =>
      skill.catalogId ? [[skill.catalogId, skill] as const] : [],
    ),
  );
  return SKILL_CATALOG.map((entry): CatalogSkillSummary => {
    const workspaceSkill = byCatalogId.get(entry.id);
    const { instructions, ...publicEntry } = entry;
    void instructions;
    return {
      ...publicEntry,
      preview: entry.instructions.slice(0, 420),
      installed: Boolean(workspaceSkill),
      installedSkillId: workspaceSkill?.id ?? null,
      installedVersionId: workspaceSkill?.versionId ?? null,
      installedVersion: workspaceSkill?.version ?? null,
      enabled: workspaceSkill?.enabled ?? false,
    };
  });
}

export async function getCatalogSkill(
  context: WorkspaceContext,
  catalogId: string,
) {
  const entry = getSkillCatalogEntry(catalogId);
  if (!entry) return null;
  const installed = (await listSkills(context)).find(
    (skill) => skill.catalogId === catalogId,
  );
  return {
    ...entry,
    installed: Boolean(installed),
    installedSkillId: installed?.id ?? null,
    installedVersionId: installed?.versionId ?? null,
    installedVersion: installed?.version ?? null,
    enabled: installed?.enabled ?? false,
  };
}

function versionToSnapshot(
  skill: SkillRow,
  version: SkillVersionRow,
  trigger: ResolvedSkillSnapshot["trigger"],
): ResolvedSkillSnapshot {
  return {
    skillId: skill.id,
    versionId: version.id,
    slug: skill.slug,
    name: version.name,
    description: version.description,
    version: version.version,
    instructions: version.instructions,
    keywords: version.keywords,
    dependencies: version.dependencyManifest,
    contentHash: version.contentHash,
    trigger,
  };
}

export async function resolveExplicitSkillVersions(
  context: WorkspaceContext,
  refs: SkillReference[],
  trigger: ResolvedSkillSnapshot["trigger"],
) {
  if (refs.length === 0) return [];
  const skillIds = [...new Set(refs.map((reference) => reference.skillId))];
  const versionIds = [...new Set(refs.map((reference) => reference.versionId))];
  const rows = await getDb()
    .select({ skill: skills, version: skillVersions })
    .from(skillVersions)
    .innerJoin(skills, eq(skills.id, skillVersions.skillId))
    .where(
      and(
        eq(skills.workspaceId, context.workspaceId),
        eq(skills.enabled, true),
        isNull(skills.archivedAt),
        inArray(skills.id, skillIds),
        inArray(skillVersions.id, versionIds),
      ),
    );
  const byKey = new Map(
    rows.map(({ skill, version }) => [
      `${skill.id}:${version.id}`,
      { skill, version },
    ]),
  );
  return refs.map((reference) => {
    const row = byKey.get(`${reference.skillId}:${reference.versionId}`);
    if (!row) return null;
    return {
      snapshot: versionToSnapshot(row.skill, row.version, trigger),
      revoked: Boolean(row.version.revokedAt),
    };
  });
}

export async function resolveAutoSkillVersions(
  context: WorkspaceContext,
  query: string,
  excludedVersionIds: Set<string>,
) {
  await ensureBuiltInSkills(context);
  const rows = await getDb()
    .select({ skill: skills, version: skillVersions })
    .from(skills)
    .innerJoin(skillVersions, eq(skillVersions.id, skills.currentVersionId))
    .where(
      and(
        eq(skills.workspaceId, context.workspaceId),
        eq(skills.enabled, true),
        eq(skills.autoLoad, true),
        isNull(skills.archivedAt),
        isNull(skillVersions.revokedAt),
      ),
    );
  const candidates = rows
    .filter(({ version }) => !excludedVersionIds.has(version.id))
    .map(({ skill, version }) => ({
      skill,
      version,
      name: version.name,
      description: version.description,
      keywords: version.keywords,
      autoLoad: skill.autoLoad,
    }))
    .sort((left, right) => left.skill.slug.localeCompare(right.skill.slug));
  return selectRelevantSkills(candidates, query, 3).map(({ skill, version }) =>
    versionToSnapshot(skill, version, "auto"),
  );
}

export async function getAvailableMcpTemplateIds(
  context: WorkspaceContext,
  allowedSourceIds: string[],
) {
  if (allowedSourceIds.length === 0) return new Set<string>();
  const rows = await getDb()
    .select({
      templateId: mcpSources.templateId,
      url: mcpSources.url,
      tools: mcpSources.tools,
      lastError: mcpSources.lastError,
    })
    .from(mcpSources)
    .where(
      and(
        eq(mcpSources.workspaceId, context.workspaceId),
        eq(mcpSources.enabled, true),
        inArray(mcpSources.id, [...new Set(allowedSourceIds)]),
      ),
    );
  const templateByUrl = new Map(
    MCP_PRESETS.flatMap((preset) =>
      preset.url ? [[preset.url.replace(/\/$/, ""), preset.id] as const] : [],
    ),
  );
  return new Set(
    rows.flatMap((row) => {
      if (row.lastError || row.tools.length === 0) return [];
      const mapped =
        row.templateId ?? templateByUrl.get(row.url.replace(/\/$/, ""));
      return mapped ? [mapped] : [];
    }),
  );
}

/** Compatibility path for callers that have not opted into explicit selection. */
export async function getEnabledSkillContext(
  context: WorkspaceContext,
  query: string,
) {
  try {
    const selected = await resolveAutoSkillVersions(context, query, new Set());
    return {
      selected,
      prompt: buildSkillPrompt(
        selected.map((skill) => ({ ...skill, requiredMcp: [] })),
      ),
    };
  } catch (error) {
    if (isSkillSchemaUnavailable(error)) return { selected: [], prompt: "" };
    throw error;
  }
}
