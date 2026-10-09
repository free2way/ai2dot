import { describe, expect, it } from "vitest";
import {
  allocateSkillBudget,
  getSkillTokenBudget,
  parseSkillTokens,
  skillSelectionSchema,
  type ResolvedSkillSnapshot,
} from "@/lib/skill-selection";

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";

function snapshot(
  overrides: Partial<ResolvedSkillSnapshot> = {},
): ResolvedSkillSnapshot {
  return {
    skillId: UUID_A,
    versionId: UUID_B,
    slug: "source-verification",
    name: "来源核验",
    description: "核验来源",
    version: "1.0.0",
    instructions: "按来源逐条核验。",
    keywords: ["核验"],
    dependencies: [],
    contentHash: "hash",
    trigger: "message",
    ...overrides,
  };
}

describe("skill selection", () => {
  it("rejects references in auto mode and duplicate references", () => {
    expect(
      skillSelectionSchema.safeParse({
        mode: "auto",
        refs: [{ skillId: UUID_A, versionId: UUID_B }],
        contextTarget: "recent_messages",
      }).success,
    ).toBe(false);
    expect(
      skillSelectionSchema.safeParse({
        mode: "manual",
        refs: [
          { skillId: UUID_A, versionId: UUID_B },
          { skillId: UUID_A, versionId: UUID_B },
        ],
        contextTarget: "recent_messages",
      }).success,
    ).toBe(false);
  });

  it("extracts prose tokens but preserves code, quotes, and e-mail text", () => {
    const parsed = parseSkillTokens(
      "@skill:source-verification 核验这句话\n" +
        "> @skill:quoted 保留\n" +
        "```txt\n@skill:code\n```\n" +
        "mail@skill:example.com",
    );
    expect(parsed.slugs).toEqual(["source-verification"]);
    expect(parsed.text).not.toContain("@skill:source-verification");
    expect(parsed.text).toContain("@skill:quoted");
    expect(parsed.text).toContain("@skill:code");
    expect(parsed.text).toContain("mail@skill:example.com");
  });

  it("rejects an explicit workflow as a whole when it exceeds budget", () => {
    const skill = snapshot({ instructions: "x".repeat(300) });
    const allocation = allocateSkillBudget({
      skills: [skill],
      budgetTokens: 10,
      explicitVersionIds: new Set([skill.versionId]),
    });
    expect(allocation).toMatchObject({
      ok: false,
      code: "SKILL_CONTEXT_BUDGET_EXCEEDED",
    });
  });

  it("omits an automatic workflow without truncating it", () => {
    const skill = snapshot({ trigger: "auto", instructions: "x".repeat(300) });
    const allocation = allocateSkillBudget({
      skills: [skill],
      budgetTokens: 10,
      explicitVersionIds: new Set(),
    });
    expect(allocation).toMatchObject({
      ok: true,
      included: [],
      omitted: [{ reason: "budget" }],
    });
  });

  it("caps the shared skill budget at 6000 estimated tokens", () => {
    expect(getSkillTokenBudget({ contextWindow: 1_000_000 })).toBe(6_000);
    expect(getSkillTokenBudget({ contextWindow: 10_000 })).toBe(771);
  });
});
