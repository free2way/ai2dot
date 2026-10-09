import { describe, expect, it } from "vitest";
import { DEFAULT_SKILL_SELECTION } from "@/lib/skill-selection";
import {
  fingerprintSkillResolution,
  selectEffectiveSkillSelection,
} from "@/server/skills/resolve";

const manual = {
  mode: "manual" as const,
  refs: [],
  contextTarget: "current_message" as const,
};

describe("skill resolver primitives", () => {
  it("applies message, branch, assistant, then auto precedence", () => {
    expect(
      selectEffectiveSkillSelection({ messageSelection: manual }).trigger,
    ).toBe("message");
    expect(
      selectEffectiveSkillSelection({ branchSelection: manual }).trigger,
    ).toBe("branch");
    expect(
      selectEffectiveSkillSelection({ assistantSelection: manual }).trigger,
    ).toBe("assistant");
    expect(selectEffectiveSkillSelection({})).toEqual({
      selection: DEFAULT_SKILL_SELECTION,
      trigger: "auto",
    });
  });

  it("changes the frozen hash when explicit ordering or target changes", () => {
    const first = {
      skillId: "skill-a",
      versionId: "version-a",
      slug: "a",
      name: "A",
      description: "A",
      version: "1",
      instructions: "A",
      keywords: [],
      dependencies: [],
      contentHash: "hash-a",
      trigger: "message" as const,
    };
    const second = { ...first, skillId: "skill-b", versionId: "version-b" };
    const base = {
      selection: {
        mode: "manual" as const,
        refs: [],
        contextTarget: "recent_messages" as const,
      },
      included: [first, second],
    };
    expect(fingerprintSkillResolution(base)).not.toBe(
      fingerprintSkillResolution({ ...base, included: [second, first] }),
    );
    expect(fingerprintSkillResolution(base)).not.toBe(
      fingerprintSkillResolution({
        ...base,
        selection: { ...base.selection, contextTarget: "conversation" },
      }),
    );
  });
});
