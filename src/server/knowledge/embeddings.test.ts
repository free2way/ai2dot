import { describe, expect, it } from "vitest";
import {
  DEFAULT_KNOWLEDGE_EMBEDDING_MODEL,
  getKnowledgeEmbeddingModelId,
  isKnowledgeEmbeddingConfigured,
} from "./embeddings";

describe("knowledge embedding configuration", () => {
  it("uses Vercel AI Gateway credentials by default", () => {
    expect(isKnowledgeEmbeddingConfigured({ AI_GATEWAY_API_KEY: "gateway-key" })).toBe(true);
    expect(getKnowledgeEmbeddingModelId({})).toBe(
      DEFAULT_KNOWLEDGE_EMBEDDING_MODEL,
    );
  });

  it("supports a dedicated OpenAI-compatible embedding endpoint", () => {
    const environment = {
      AI2DOT_EMBEDDING_BASE_URL: "https://embedding.example.com/v1",
      AI2DOT_EMBEDDING_MODEL: "text-embedding-3-small",
    };
    expect(isKnowledgeEmbeddingConfigured(environment)).toBe(true);
    expect(getKnowledgeEmbeddingModelId(environment)).toBe(
      "text-embedding-3-small",
    );
  });

  it("supports an encrypted provider connection from the workspace", () => {
    const environment = {
      AI2DOT_EMBEDDING_PROVIDER_NAME: "Google Gemini",
      AI2DOT_EMBEDDING_MODEL: "models/gemini-embedding-2",
    };
    expect(isKnowledgeEmbeddingConfigured(environment)).toBe(true);
    expect(getKnowledgeEmbeddingModelId(environment)).toBe(
      "models/gemini-embedding-2",
    );
  });

  it("stays disabled without gateway or dedicated endpoint credentials", () => {
    expect(isKnowledgeEmbeddingConfigured({})).toBe(false);
  });
});
