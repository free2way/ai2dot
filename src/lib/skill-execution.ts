import { getToolName, isToolUIPart, type UIMessage, type UIMessageChunk } from "ai";
import type { SkillResolution } from "@/lib/skill-selection";

type ApprovalPart = {
  type: string;
  toolName?: string;
  toolCallId: string;
  input?: unknown;
  state: string;
  approval: { id: string; approved?: boolean; isAutomatic?: boolean };
};

export function getMessageSkillResolution(message: UIMessage) {
  const part = [...message.parts].reverse().find((item) => item.type === "data-skill-resolution");
  return part ? (part as unknown as { data: SkillResolution }).data : undefined;
}

function approvalParts(message: UIMessage): ApprovalPart[] {
  return message.parts.filter((part) => {
    const candidate = part as unknown as Partial<ApprovalPart>;
    return (
      (candidate.type === "dynamic-tool" || candidate.type?.startsWith("tool-")) &&
      candidate.toolCallId && candidate.approval &&
      !candidate.approval.isAutomatic &&
      ["approval-requested", "approval-responded"].includes(candidate.state ?? "")
    );
  }) as unknown as ApprovalPart[];
}

export function hasPendingToolApproval(message: UIMessage) {
  return approvalParts(message).some((part) => part.state === "approval-requested");
}

export function hasToolApprovalResponse(message: UIMessage) {
  return approvalParts(message).some((part) => part.state === "approval-responded");
}

// Continuation is bound to the persisted response, in addition to the SDK's
// signed tool approval. Reusing a signature in another conversation is rejected.
export function isSkillApprovalContinuation(
  parentResponse: UIMessage | null,
  messages: UIMessage[],
) {
  if (!parentResponse) return false;
  const last = messages.at(-1);
  if (!last || last.role !== "assistant" || last.id !== parentResponse.id) return false;
  const pending = approvalParts(parentResponse).filter(
    (part) => part.state === "approval-requested",
  );
  const responses = approvalParts(last).filter(
    (part) => part.state === "approval-responded",
  );
  if (pending.length === 0 || pending.length !== responses.length) return false;
  if (new Set(responses.map((part) => part.approval.id)).size !== pending.length) return false;
  return responses.every((response) => pending.some((part) =>
    part.approval.id === response.approval.id &&
    part.toolCallId === response.toolCallId &&
    part.type === response.type &&
    part.toolName === response.toolName &&
    typeof response.approval.approved === "boolean" &&
    JSON.stringify(part.input) === JSON.stringify(response.input),
  ));
}

export function finishSkillResolution(
  resolution: SkillResolution,
  response: UIMessage,
): SkillResolution {
  const status = hasPendingToolApproval(response) ? "awaiting_approval" : "completed";
  return {
    ...resolution,
    skills: resolution.skills.map((skill) =>
      skill.status === "included" ? { ...skill, status } : skill,
    ),
  };
}

export function withFinalSkillResolution(message: UIMessage): UIMessage {
  return {
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "data-skill-resolution") return part;
      const dataPart = part as unknown as { data: SkillResolution };
      return { ...part, data: finishSkillResolution(dataPart.data, message) };
    }),
  };
}

export function replayToolChunks(message: UIMessage): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = [];
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state === "input-streaming") continue;
    chunks.push({ type: "tool-input-available", toolCallId: part.toolCallId,
      toolName: getToolName(part), input: part.input, dynamic: part.type === "dynamic-tool" });
    if (part.approval) {
      chunks.push({ type: "tool-approval-request", approvalId: part.approval.id,
        toolCallId: part.toolCallId, isAutomatic: part.approval.isAutomatic, signature: part.approval.signature });
      if (part.approval.approved !== undefined) {
        chunks.push({ type: "tool-approval-response", approvalId: part.approval.id,
          approved: part.approval.approved, reason: part.approval.reason });
      }
    }
    if (part.state === "output-available") chunks.push({ type: "tool-output-available", toolCallId: part.toolCallId, output: part.output });
    if (part.state === "output-error") chunks.push({ type: "tool-output-error", toolCallId: part.toolCallId, errorText: part.errorText });
    if (part.state === "output-denied") chunks.push({ type: "tool-output-denied", toolCallId: part.toolCallId });
  }
  return chunks;
}
