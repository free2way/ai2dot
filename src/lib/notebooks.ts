import type { KnowledgeDocumentSummary, KnowledgeSearchResult } from "@/lib/knowledge";

export type NotebookStatus = "active" | "archived";
export type NotebookArtifactType =
  | "summary"
  | "faq"
  | "timeline"
  | "study_guide"
  | "mind_map";
export type NotebookArtifactStatus = "pending" | "running" | "ready" | "failed";

export type NotebookSummary = {
  id: string;
  knowledgeBaseId: string;
  title: string;
  description: string;
  status: NotebookStatus;
  documentCount: number;
  chunkCount: number;
  semanticChunkCount: number;
  artifactCount: number;
  updatedAt: string;
};

export type NotebookArtifactSummary = {
  id: string;
  notebookId: string;
  type: NotebookArtifactType;
  title: string;
  contentMarkdown: string;
  status: NotebookArtifactStatus;
  modelId: string | null;
  sourceSnapshotHash: string | null;
  publishedDocumentId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotebookVideoSourceSummary = {
  id: string;
  notebookId: string;
  knowledgeDocumentId: string;
  platform: "youtube" | "bilibili";
  externalId: string;
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  authorName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  language: string | null;
  transcriptOrigin: "pasted" | "subtitle_upload";
  createdAt: string;
  updatedAt: string;
};

export type NotebookDetail = NotebookSummary & {
  documents: KnowledgeDocumentSummary[];
  artifacts: NotebookArtifactSummary[];
  videoSources: NotebookVideoSourceSummary[];
};

export type NotebookSearchResult = KnowledgeSearchResult;

export type GoogleNotebookProviderStatus = {
  enabled: boolean;
  configured: boolean;
  deploymentRegion: string;
  dataLocation: string | null;
  projectConfigured: boolean;
  credentialsConfigured: boolean;
  regionSupported: boolean;
  mainlandChinaDeployment: boolean;
  network: "not_checked" | "reachable" | "unreachable";
  authorization: "not_checked" | "required" | "unknown";
  checkedAt: string | null;
  message: string;
};
