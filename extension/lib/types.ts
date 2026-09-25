export type SummaryTemplate = "concise" | "structured" | "detailed";

export type ModelOption = {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
  capabilities: string[];
};

export type KnowledgeBaseOption = {
  id: string;
  name: string;
  description: string;
  documentCount: number;
};

export type BootstrapResponse = {
  user: { id: string; displayName: string | null };
  workspace: { id: string; role: "owner" | "admin" | "member" };
  models: ModelOption[];
  knowledgeBases: KnowledgeBaseOption[];
  limits: {
    maxPageCharacters: number;
    maxSummaryCharacters: number;
  };
};

export type ExtractedPage = {
  version: 1;
  mode: "selection" | "article" | "fallback";
  title: string;
  url: string;
  canonicalUrl: string | null;
  siteName: string | null;
  author: string | null;
  publishedAt: string | null;
  language: string | null;
  excerpt: string | null;
  markdown: string;
  characterCount: number;
  extractedAt: string;
};

export type SyncedPreferences = {
  defaultModelId?: string;
  defaultKnowledgeBaseId?: string;
  summaryTemplate: SummaryTemplate;
};
