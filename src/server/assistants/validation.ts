import { z } from "zod";
import { skillSelectionSchema } from "@/lib/skill-selection";

export const assistantInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  avatar: z.string().trim().max(3).default("AI"),
  description: z.string().trim().max(240).optional().default(""),
  systemPrompt: z.string().trim().min(1).max(12_000),
  welcomeMessage: z.string().trim().max(500).optional().default(""),
  defaultModelKey: z.string().trim().max(120).optional().default(""),
  knowledgeBaseIds: z.array(z.string().uuid()).max(3).default([]),
  mcpSourceIds: z.array(z.string().uuid()).max(10).default([]),
  skillSelection: skillSelectionSchema.default({
    mode: "auto",
    refs: [],
    contextTarget: "recent_messages",
  }),
});
