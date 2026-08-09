import { describe, expect, it } from "vitest";
import { normalizeAssistantAvatar } from "./assistants";
import { assistantInputSchema } from "@/server/assistants/validation";

describe("assistant helpers", () => {
  it("normalizes a short avatar label", () => {
    expect(normalizeAssistantAvatar(" oracle ", "Oracle 专家")).toBe("ORA");
  });

  it("falls back to the assistant name", () => {
    expect(normalizeAssistantAvatar("", "代码助手")).toBe("代码");
  });

  it("limits assistants to three knowledge bases", () => {
    const result = assistantInputSchema.safeParse({
      name: "Oracle 专家",
      avatar: "OR",
      systemPrompt: "生成安全的 Oracle 脚本。",
      knowledgeBaseIds: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000003",
        "00000000-0000-4000-8000-000000000004",
      ],
    });
    expect(result.success).toBe(false);
  });
});
