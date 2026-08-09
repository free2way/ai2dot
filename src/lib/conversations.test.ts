import { describe, expect, it } from "vitest";
import { conversationToKnowledgeText } from "./conversations";

describe("conversationToKnowledgeText", () => {
  it("exports every text turn in order", () => {
    const result = conversationToKnowledgeText("部署讨论", [
      { role: "user", parts: [{ type: "text", text: "怎么部署？" }] },
      { role: "assistant", parts: [{ type: "text", text: "使用 Vercel。" }] },
      { role: "user", parts: [{ type: "text", text: "数据库呢？" }] },
    ]);

    expect(result).toContain("# 部署讨论");
    expect(result).toContain("## 用户\n\n怎么部署？");
    expect(result).toContain("## 助手\n\n使用 Vercel。");
    expect(result.indexOf("怎么部署？")).toBeLessThan(result.indexOf("数据库呢？"));
  });

  it("ignores non-text parts", () => {
    expect(
      conversationToKnowledgeText("空会话", [
        { role: "assistant", parts: [{ type: "file" }] },
      ]),
    ).toBe("# 空会话");
  });
});
