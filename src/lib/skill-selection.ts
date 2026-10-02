import { z } from "zod";

export const MAX_EXPLICIT_SKILLS = 3;
export const MAX_SKILL_PROMPT_TOKENS = 6_000;
export const DEFAULT_UNKNOWN_CONTEXT_WINDOW = 32_000;

export const skillModeSchema = z.enum(["auto", "manual", "hybrid"]);
export const skillContextTargetSchema = z.enum([
  "current_message",
  "recent_messages",
  "conversation",
]);
export const skillReferenceSchema = z.object({
  skillId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const skillSelectionSchema = z
  .object({
    mode: skillModeSchema,
    refs: z.array(skillReferenceSchema).max(MAX_EXPLICIT_SKILLS),
    contextTarget: skillContextTargetSchema,
  })
  .superRefine((selection, context) => {
    if (selection.mode === "auto" && selection.refs.length > 0) {
      context.addIssue({
        code: "custom",
        message: "自动模式不能包含显式 Skill 引用。",
        path: ["refs"],
      });
    }
    const keys = selection.refs.map(
      (reference) => `${reference.skillId}:${reference.versionId}`,
    );
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "Skill 引用不能重复。",
        path: ["refs"],
      });
    }
  });

export type SkillMode = z.infer<typeof skillModeSchema>;
export type SkillContextTarget = z.infer<typeof skillContextTargetSchema>;
export type SkillReference = z.infer<typeof skillReferenceSchema>;
export type SkillSelection = z.infer<typeof skillSelectionSchema>;

export type SkillDependency = {
  capability: "web_search" | "technical_docs" | "github_read";
  requirement: "required" | "optional";
  alternatives: string[];
};

export type ResolvedSkillSnapshot = {
  skillId: string;
  versionId: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  instructions: string;
  keywords: string[];
  dependencies: SkillDependency[];
  contentHash: string;
  trigger: "message" | "branch" | "assistant" | "auto";
};

export type SkillInvocationStatus =
  | "resolved"
  | "included"
  | "omitted"
  | "blocked"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "stopped";

export type SkillResolutionItem = {
  id: string;
  versionId: string;
  name: string;
  version: string;
  trigger: ResolvedSkillSnapshot["trigger"];
  status: SkillInvocationStatus;
  statusReason?: string;
  estimatedInputTokens: number;
};

export type SkillResolution = {
  generationId?: string;
  mode: SkillMode;
  contextTarget: SkillContextTarget;
  estimator: "ai2dot-char-v1";
  budgetTokens: number;
  skills: SkillResolutionItem[];
};

export const DEFAULT_SKILL_SELECTION: SkillSelection = {
  mode: "auto",
  refs: [],
  contextTarget: "recent_messages",
};

export function estimateSkillTokens(value: string) {
  // Deliberately conservative for mixed Chinese, English, and code. This is an
  // allocation estimate, never presented as provider-billed token usage.
  return Math.max(1, Math.ceil(value.length / 3));
}

export function getSkillTokenBudget({
  contextWindow,
  reservedOutputTokens = 4_096,
  safetyTokens = 2_048,
}: {
  contextWindow?: number | null;
  reservedOutputTokens?: number;
  safetyTokens?: number;
}) {
  const safeContextWindow =
    contextWindow && contextWindow > 0
      ? contextWindow
      : DEFAULT_UNKNOWN_CONTEXT_WINDOW;
  const inputBudget = Math.max(
    0,
    safeContextWindow - reservedOutputTokens - safetyTokens,
  );
  return Math.max(
    0,
    Math.min(MAX_SKILL_PROMPT_TOKENS, Math.floor(inputBudget * 0.2)),
  );
}

export function allocateSkillBudget({
  skills,
  budgetTokens,
  explicitVersionIds,
}: {
  skills: ResolvedSkillSnapshot[];
  budgetTokens: number;
  explicitVersionIds: Set<string>;
}) {
  const included: Array<ResolvedSkillSnapshot & { estimatedInputTokens: number }> = [];
  const omitted: Array<{
    skill: ResolvedSkillSnapshot;
    estimatedInputTokens: number;
    reason: "budget";
  }> = [];
  let usedTokens = 0;

  for (const skill of skills) {
    const estimatedInputTokens = estimateSkillTokens(
      JSON.stringify({
        name: skill.name,
        version: skill.version,
        description: skill.description,
        instructions: skill.instructions,
        dependencies: skill.dependencies,
      }),
    );
    if (usedTokens + estimatedInputTokens <= budgetTokens) {
      included.push({ ...skill, estimatedInputTokens });
      usedTokens += estimatedInputTokens;
      continue;
    }
    if (explicitVersionIds.has(skill.versionId)) {
      return {
        ok: false as const,
        code: "SKILL_CONTEXT_BUDGET_EXCEEDED" as const,
        requiredTokens: usedTokens + estimatedInputTokens,
        budgetTokens,
        skill,
      };
    }
    omitted.push({ skill, estimatedInputTokens, reason: "budget" });
  }

  return {
    ok: true as const,
    included,
    omitted,
    usedTokens,
    budgetTokens,
  };
}

/**
 * Extracts explicit Skill tokens only from ordinary prose. Fenced code,
 * blockquotes, e-mail-like text, and embedded word tokens remain untouched.
 */
export function parseSkillTokens(input: string) {
  const slugs: string[] = [];
  let inFence = false;
  const lines = input.split("\n").map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence || /^\s*>/.test(line)) return line;

    return line.replace(
      /(^|\s)@skill:([a-z0-9][a-z0-9-]{0,79})(?=\s|[，。！？,.!?;；:]|$)/gi,
      (_match, prefix: string, slug: string) => {
        const normalized = slug.toLowerCase();
        if (!slugs.includes(normalized)) slugs.push(normalized);
        return prefix;
      },
    );
  });

  return {
    slugs,
    text: lines
      .join("\n")
      .replace(/[ \t]+([，。！？,.!?;；:])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  };
}
