export type KnowledgeBaseSummary = {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  chunkCount: number;
  updatedAt: string;
};

export type KnowledgeDocumentSummary = {
  id: string;
  knowledgeBaseId: string;
  name: string;
  mimeType: string;
  byteSize: number;
  characterCount: number;
  chunkCount: number;
  status: "processing" | "ready" | "failed";
  errorMessage: string | null;
  updatedAt: string;
};

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  documentName: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  content: string;
  score: number;
};
