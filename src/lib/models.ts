export type ModelCapability = "text" | "image" | "files" | "reasoning";

export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
  capabilities: ModelCapability[];
  accent: string;
};

// Verified against the public Vercel AI Gateway catalog on 2026-08-08.
// The API route remains the source of truth once dynamic model sync is enabled.
export const FEATURED_MODELS: ModelCatalogEntry[] = [
  {
    id: "openai/gpt-5.6-terra",
    name: "GPT 5.6 Terra",
    provider: "OpenAI",
    description: "快速推理与日常协作",
    contextWindow: 1_100_000,
    capabilities: ["text", "image", "files", "reasoning"],
    accent: "#b7f34a",
  },
  {
    id: "anthropic/claude-opus-5",
    name: "Claude Opus 5",
    provider: "Anthropic",
    description: "长文、研究与复杂任务",
    contextWindow: 1_000_000,
    capabilities: ["text", "image", "files", "reasoning"],
    accent: "#f0a26b",
  },
  {
    id: "google/gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "Google",
    description: "低延迟多模态响应",
    contextWindow: 1_000_000,
    capabilities: ["text", "image", "files"],
    accent: "#7db2ff",
  },
];

export const DEFAULT_MODEL_ID = FEATURED_MODELS[0].id;

export function isFeaturedModel(modelId: string) {
  return FEATURED_MODELS.some((model) => model.id === modelId);
}

export function formatContextWindow(tokens: number) {
  if (tokens >= 1_000_000) {
    return `${Number((tokens / 1_000_000).toFixed(1))}M`;
  }

  return `${Math.round(tokens / 1_000)}K`;
}
