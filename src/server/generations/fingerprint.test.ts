import { describe, expect, it } from "vitest";
import { fingerprintGenerationRequest } from "./fingerprint";

const request = {
  conversationId: "conversation",
  branchId: "branch",
  modelId: "openai/gpt-5",
  messages: [
    { id: "user-1", role: "user" as const, parts: [{ type: "text" as const, text: "你好" }] },
  ],
};

describe("fingerprintGenerationRequest", () => {
  it("is stable across object key order", () => {
    expect(fingerprintGenerationRequest(request)).toBe(
      fingerprintGenerationRequest({
        messages: request.messages,
        modelId: request.modelId,
        branchId: request.branchId,
        conversationId: request.conversationId,
      }),
    );
  });

  it("changes when the prompt or branch changes", () => {
    expect(fingerprintGenerationRequest(request)).not.toBe(
      fingerprintGenerationRequest({ ...request, branchId: "another-branch" }),
    );
    expect(fingerprintGenerationRequest(request)).not.toBe(
      fingerprintGenerationRequest({
        ...request,
        messages: [{ ...request.messages[0], parts: [{ type: "text", text: "再见" }] }],
      }),
    );
    expect(fingerprintGenerationRequest(request)).not.toBe(
      fingerprintGenerationRequest({
        ...request,
        knowledgeBaseIds: ["knowledge-base"],
      }),
    );
  });
});
