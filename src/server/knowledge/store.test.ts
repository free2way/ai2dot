import { describe, expect, it } from "vitest";
import {
  rankKnowledgeResults,
  scoreKnowledgeText,
  splitKnowledgeText,
} from "./store";
import { rerankHybridKnowledgeResults } from "@/lib/knowledge-retrieval";

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

  it("keeps retrieval diverse across documents", () => {
    const common = {
      mimeType: "text/markdown",
      knowledgeBaseId: "base-1",
      knowledgeBaseName: "产品资料",
    };
    const ranked = rankKnowledgeResults(
      [
        { ...common, chunkId: "1", documentId: "doc-a", documentName: "A", content: "Gemini 知识库完整说明" },
        { ...common, chunkId: "2", documentId: "doc-a", documentName: "A", content: "Gemini 知识库配置说明" },
        { ...common, chunkId: "3", documentId: "doc-a", documentName: "A", content: "Gemini 知识库接口说明" },
        { ...common, chunkId: "4", documentId: "doc-b", documentName: "B", content: "Gemini 知识库使用方法" },
      ],
      "Gemini 知识库",
      4,
    );

    expect(ranked.filter((result) => result.documentId === "doc-a")).toHaveLength(2);
    expect(ranked.some((result) => result.documentId === "doc-b")).toBe(true);
  });

  it("fuses semantic and keyword candidates while rewarding overlap", () => {
    const common = {
      documentId: "doc-a",
      documentName: "产品说明",
      mimeType: "text/markdown",
      knowledgeBaseId: "base-1",
      knowledgeBaseName: "产品资料",
    };
    const results = rerankHybridKnowledgeResults(
      [
        { ...common, chunkId: "both", content: "部署方式", keywordScore: 0.8 },
        { ...common, chunkId: "keyword", content: "部署命令", keywordScore: 0.7 },
      ],
      [
        { ...common, chunkId: "both", content: "部署方式", semanticScore: 0.86 },
        { ...common, chunkId: "semantic", content: "上线流程", semanticScore: 0.82 },
      ],
      3,
    );

    expect(results[0]).toMatchObject({
      chunkId: "both",
      retrievalMode: "hybrid",
    });
    expect(results.some((result) => result.retrievalMode === "semantic")).toBe(true);
  });
});
