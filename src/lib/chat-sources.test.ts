import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  createKnowledgeSourceParts,
  getKnowledgeSourceParts,
} from "./chat-sources";

describe("knowledge source parts", () => {
  it("deduplicates multiple retrieved chunks from the same document", () => {
    const parts = createKnowledgeSourceParts([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentName: "部署手册.pdf",
        mimeType: "application/pdf",
        knowledgeBaseId: "base-1",
        knowledgeBaseName: "产品资料",
        content: "第一段",
        score: 0.9,
      },
      {
        chunkId: "chunk-2",
        documentId: "doc-1",
        documentName: "部署手册.pdf",
        mimeType: "application/pdf",
        knowledgeBaseId: "base-1",
        knowledgeBaseName: "产品资料",
        content: "第二段",
        score: 0.8,
      },
    ]);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      sourceId: "knowledge:doc-1",
      title: "部署手册.pdf",
      mediaType: "application/pdf",
    });
  });

  it("only returns AI2Dot knowledge sources", () => {
    const message: UIMessage = {
      id: "message-1",
      role: "assistant",
      parts: [
        {
          type: "source-document",
          sourceId: "knowledge:doc-1",
          title: "资料.docx",
          mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        {
          type: "source-url",
          sourceId: "web-1",
          title: "网页",
          url: "https://example.com",
        },
      ],
    };

    expect(getKnowledgeSourceParts(message).map((part) => part.title)).toEqual([
      "资料.docx",
    ]);
  });
});
