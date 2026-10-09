import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { getMessageSkillResolution, hasPendingToolApproval, isSkillApprovalContinuation, replayToolChunks, withFinalSkillResolution } from "./skill-execution";
import type { SkillResolution } from "./skill-selection";

const resolution: SkillResolution = {
  generationId: "generation-1", mode: "hybrid", contextTarget: "current_message",
  estimator: "ai2dot-char-v1", budgetTokens: 6000,
  skills: [{ id: "skill-1", versionId: "version-1", name: "Workflow", version: "1",
    trigger: "auto", status: "included", estimatedInputTokens: 10 }],
};
const parent = {
  id: "response-1", role: "assistant",
  parts: [
    { type: "data-skill-resolution", data: resolution },
    { type: "dynamic-tool", toolName: "write", toolCallId: "call-1",
      input: { text: "test" }, state: "approval-requested", approval: { id: "approval-1" } },
  ],
} as unknown as UIMessage;

function responded(approved = true): UIMessage {
  return {
    ...parent,
    parts: parent.parts.map((part) => part.type === "dynamic-tool"
      ? { ...part, state: "approval-responded", approval: { id: "approval-1", approved } } : part),
  } as UIMessage;
}

describe("Skill execution continuation", () => {
  it("uses the newest generation metadata after multiple approval rounds", () => {
    const continued = {
      ...parent,
      parts: [...parent.parts, { type: "data-skill-resolution", data: { ...resolution, generationId: "generation-2" } }],
    } as UIMessage;
    expect(getMessageSkillResolution(continued)?.generationId).toBe("generation-2");
  });

  it("accepts approval and rejection only for the persisted parent response", () => {
    expect(isSkillApprovalContinuation(parent, [responded()])).toBe(true);
    expect(isSkillApprovalContinuation(parent, [responded(false)])).toBe(true);
    expect(isSkillApprovalContinuation(parent, [{ ...responded(), id: "other-response" }])).toBe(false);
    expect(isSkillApprovalContinuation(null, [responded()])).toBe(false);
  });

  it("rejects changed input, unrelated approvals and missing responses", () => {
    const changed = responded();
    changed.parts = changed.parts.map((part) => part.type === "dynamic-tool"
      ? { ...part, input: { text: "changed" } } : part);
    expect(isSkillApprovalContinuation(parent, [changed])).toBe(false);
    expect(isSkillApprovalContinuation(parent, [parent])).toBe(false);
    expect(isSkillApprovalContinuation(parent, [{ ...responded(), role: "user" }])).toBe(false);
  });

  it("freezes awaiting-approval metadata rather than claiming completion", () => {
    const final = withFinalSkillResolution(parent);
    expect(hasPendingToolApproval(final)).toBe(true);
    expect(getMessageSkillResolution(final)?.skills[0].status).toBe("awaiting_approval");
    expect(resolution.skills[0].status).toBe("included");
    const completed = withFinalSkillResolution(responded());
    expect(getMessageSkillResolution(completed)?.skills[0].status).toBe("completed");
  });

  it("replays the original tool request so its approval survives a retry", () => {
    expect(replayToolChunks(parent)).toEqual([
      { type: "tool-input-available", toolCallId: "call-1", toolName: "write", input: { text: "test" }, dynamic: true },
      { type: "tool-approval-request", approvalId: "approval-1", toolCallId: "call-1", isAutomatic: undefined, signature: undefined },
    ]);
  });
});
