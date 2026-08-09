import { describe, expect, it } from "vitest";
import { scoreKnowledgeText, splitKnowledgeText } from "./store";

describe("knowledge text processing", () => {
  it("splits long text into overlapping, bounded chunks", () => {
    const chunks = splitKnowledgeText("AI2Dot 是通用助手。\n\n".repeat(180));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 1_200)).toBe(true);
  });

  it("ranks Chinese and Latin keyword matches", () => {
    const relevant = scoreKnowledgeText("AI2Dot 支持 Gemini 模型与知识库检索。", "Gemini 知识库");
    const unrelated = scoreKnowledgeText("今天的天气晴朗。", "Gemini 知识库");
    expect(relevant).toBeGreaterThan(unrelated);
  });

  it("rejects empty documents", () => {
    expect(splitKnowledgeText(" \n ")).toEqual([]);
  });
});
