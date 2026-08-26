import { describe, expect, it } from "vitest";
import {
  conversationToKnowledgeText,
  filterConversations,
} from "./conversations";

describe("filterConversations", () => {
  const conversations = [
    { id: "1", title: "Oracle 部署脚本", updatedAt: "2026-08-26", archived: false },
    { id: "2", title: "产品需求梳理", updatedAt: "2026-08-25", archived: false },
  ];

  it("matches titles without case sensitivity and ignores surrounding spaces", () => {
    expect(filterConversations(conversations, "  ORACLE ")).toEqual([
      conversations[0],
    ]);
  });

  it("returns all conversations for an empty query", () => {
    expect(filterConversations(conversations, "   ")).toBe(conversations);
  });
});

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
