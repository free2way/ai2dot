import { z } from "zod";

export const EXTENSION_PAGE_CHARACTER_LIMIT = 120_000;
export const EXTENSION_SUMMARY_CHARACTER_LIMIT = 20_000;

export const extensionSummaryRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  modelId: z.string().trim().min(1).max(160),
  template: z.enum(["concise", "structured", "detailed"]),
  locale: z.enum(["zh-CN", "en"]).default("zh-CN"),
  page: z.object({
    title: z.string().trim().min(1).max(500),
    url: z.string().url().max(4_000),
    siteName: z.string().trim().max(200).nullable().optional(),
    author: z.string().trim().max(200).nullable().optional(),
    publishedAt: z.string().trim().max(100).nullable().optional(),
    markdown: z
      .string()
      .trim()
      .min(20)
      .max(EXTENSION_PAGE_CHARACTER_LIMIT),
  }),
});

export type ExtensionSummaryRequest = z.infer<
  typeof extensionSummaryRequestSchema
>;

export type ExtensionBootstrapResponse = {
  user: {
    id: string;
    displayName: string | null;
  };
  workspace: {
    id: string;
    role: "owner" | "admin" | "member";
  };
  models: Array<{
    id: string;
    name: string;
    provider: string;
    description: string;
    contextWindow: number;
    capabilities: string[];
  }>;
  knowledgeBases: Array<{
    id: string;
    name: string;
    description: string;
    documentCount: number;
  }>;
  limits: {
    maxPageCharacters: number;
    maxSummaryCharacters: number;
  };
};
