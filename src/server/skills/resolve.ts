import "server-only";

import { createHash } from "node:crypto";
import {
  allocateSkillBudget,
  DEFAULT_SKILL_SELECTION,
  getSkillTokenBudget,
  type ResolvedSkillSnapshot,
  type SkillResolution,
  type SkillSelection,
} from "@/lib/skill-selection";
import { buildSkillPrompt } from "@/lib/skills";
import type { WorkspaceContext } from "@/server/db/workspace";
import {
  getAvailableMcpTemplateIds,
  resolveAutoSkillVersions,
  resolveExplicitSkillVersions,
} from "@/server/skills/store";

export class SkillResolutionError extends Error {
  constructor(
    public readonly code:
      | "SKILL_NOT_AVAILABLE"
      | "SKILL_VERSION_REVOKED"
      | "SKILL_DEPENDENCY_UNAVAILABLE"
      | "SKILL_CONTEXT_BUDGET_EXCEEDED",
    public readonly status: 404 | 409 | 422,
    message: string,
  ) {
    super(message);
  }
}

export function selectEffectiveSkillSelection({
  messageSelection,
  branchSelection,
  assistantSelection,
}: {
  messageSelection?: SkillSelection;
  branchSelection?: SkillSelection | null;
  assistantSelection?: SkillSelection | null;
}) {
  if (messageSelection) {
    return { selection: messageSelection, trigger: "message" as const };
  }
  if (branchSelection) {
    return { selection: branchSelection, trigger: "branch" as const };
  }
  if (assistantSelection) {
    return { selection: assistantSelection, trigger: "assistant" as const };
  }
  return { selection: DEFAULT_SKILL_SELECTION, trigger: "auto" as const };
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

export function fingerprintSkillResolution(input: {
  selection: SkillSelection;
  included: ResolvedSkillSnapshot[];
  executionPlanVersion?: number;
}) {
  return createHash("sha256")
    .update(
      stableJson({
        executionPlanVersion: input.executionPlanVersion ?? 1,
        mode: input.selection.mode,
        contextTarget: input.selection.contextTarget,
        skills: input.included.map((skill) => ({
          skillId: skill.skillId,
          versionId: skill.versionId,
          contentHash: skill.contentHash,
          trigger: skill.trigger,
        })),
      }),
    )
    .digest("hex");
}

function dependencySatisfied(
  skill: ResolvedSkillSnapshot,
  availableTemplateIds: Set<string>,
) {
  const missing = skill.dependencies.filter(
    (dependency) =>
      dependency.requirement === "required" &&
      !dependency.alternatives.some((id) => availableTemplateIds.has(id)),
  );
  return { ok: missing.length === 0, missing };
}

export async function resolveSkillsForGeneration({
  context,
  selection,
  trigger,
  query,
  allowedMcpSourceIds,
  contextWindow,
  generationId,
}: {
  context: WorkspaceContext;
  selection: SkillSelection;
  trigger: "message" | "branch" | "assistant" | "auto";
  query: string;
  allowedMcpSourceIds: string[];
  contextWindow?: number | null;
  generationId?: string;
}) {
  const explicitRows = await resolveExplicitSkillVersions(
    context,
    selection.refs,
    trigger === "auto" ? "message" : trigger,
  );
  if (explicitRows.some((row) => row === null)) {
    throw new SkillResolutionError(
      "SKILL_NOT_AVAILABLE",
      404,
      "所选 Skill 不存在、已停用或不属于当前工作区。",
    );
  }
  if (explicitRows.some((row) => row?.revoked)) {
    throw new SkillResolutionError(
      "SKILL_VERSION_REVOKED",
      409,
      "所选 Skill 版本已撤销，请重新选择版本。",
    );
  }

  const explicit = explicitRows.flatMap((row) =>
    row ? [row.snapshot] : [],
  );
  const excludedVersionIds = new Set(
    explicit.map((skill) => skill.versionId),
  );
  const automatic =
    selection.mode === "auto" || selection.mode === "hybrid"
      ? await resolveAutoSkillVersions(context, query, excludedVersionIds)
      : [];
  const candidates = [...explicit, ...automatic].slice(0, 3);
  const explicitVersionIds = new Set(
    selection.refs.map((reference) => reference.versionId),
  );
  const availableMcpTemplateIds = await getAvailableMcpTemplateIds(
    context,
    allowedMcpSourceIds,
  );
  const dependencyOmissions: Array<{
    skill: ResolvedSkillSnapshot;
    reason: string;
  }> = [];
  const dependencyReady: ResolvedSkillSnapshot[] = [];

  for (const skill of candidates) {
    const dependency = dependencySatisfied(skill, availableMcpTemplateIds);
    if (dependency.ok) {
      dependencyReady.push(skill);
      continue;
    }
    const names = dependency.missing
      .map((item) => item.alternatives.join(" / "))
      .join(", ");
    if (explicitVersionIds.has(skill.versionId)) {
      throw new SkillResolutionError(
        "SKILL_DEPENDENCY_UNAVAILABLE",
        422,
        `Skill“${skill.name}”需要先连接并允许 MCP：${names}。`,
      );
    }
    dependencyOmissions.push({
      skill,
      reason: `required_mcp_unavailable:${names}`,
    });
  }

  const budgetTokens = getSkillTokenBudget({ contextWindow });
  const allocation = allocateSkillBudget({
    skills: dependencyReady,
    budgetTokens,
    explicitVersionIds,
  });
  if (!allocation.ok) {
    throw new SkillResolutionError(
      allocation.code,
      422,
      `Skill“${allocation.skill.name}”超出当前模型的上下文预算，请减少选择。`,
    );
  }

  const resolution: SkillResolution = {
    ...(generationId ? { generationId } : {}),
    mode: selection.mode,
    contextTarget: selection.contextTarget,
    estimator: "ai2dot-char-v1",
    budgetTokens,
    skills: [
      ...allocation.included.map((skill) => ({
        id: skill.skillId,
        versionId: skill.versionId,
        name: skill.name,
        version: skill.version,
        trigger: skill.trigger,
        status: "included" as const,
        estimatedInputTokens: skill.estimatedInputTokens,
      })),
      ...dependencyOmissions.map(({ skill, reason }) => ({
        id: skill.skillId,
        versionId: skill.versionId,
        name: skill.name,
        version: skill.version,
        trigger: skill.trigger,
        status: "omitted" as const,
        statusReason: reason,
        estimatedInputTokens: 0,
      })),
      ...allocation.omitted.map(({ skill, estimatedInputTokens }) => ({
        id: skill.skillId,
        versionId: skill.versionId,
        name: skill.name,
        version: skill.version,
        trigger: skill.trigger,
        status: "omitted" as const,
        statusReason: "context_budget",
        estimatedInputTokens,
      })),
    ],
  };
  const included = allocation.included.map((allocatedSkill) => {
    const { estimatedInputTokens, ...skill } = allocatedSkill;
    void estimatedInputTokens;
    return skill;
  });

  return {
    selection,
    included,
    snapshots: candidates,
    resolution,
    selectionHash: fingerprintSkillResolution({ selection, included }),
    prompt: buildSkillPrompt(
      included.map((skill) => ({
        ...skill,
        requiredMcp: [],
      })),
    ),
  };
}
