import {
  DEFAULT_SKILL_SELECTION,
  type SkillSelection,
} from "@/lib/skill-selection";

export type AssistantSummary = {
  id: string;
  name: string;
  avatar: string;
  description: string | null;
  systemPrompt: string;
  welcomeMessage: string | null;
  defaultModelKey: string | null;
  knowledgeBaseIds: string[];
  mcpSourceIds: string[];
  skillSelection: SkillSelection;
  updatedAt: string;
};

export type AssistantInput = {
  name: string;
  avatar: string;
  description?: string;
  systemPrompt: string;
  welcomeMessage?: string;
  defaultModelKey?: string;
  knowledgeBaseIds: string[];
  mcpSourceIds: string[];
  skillSelection: SkillSelection;
};

export type ConversationAssistantSnapshot = {
  assistantId: string;
  name: string;
  avatar: string;
  description: string | null;
  systemPrompt: string;
  welcomeMessage: string | null;
  defaultModelKey: string | null;
  knowledgeBaseIds: string[];
  mcpSourceIds: string[];
  skillSelection: SkillSelection;
};

export const ORACLE_ASSISTANT_TEMPLATE: AssistantInput = {
  name: "Oracle 专家",
  avatar: "OR",
  description: "编写、解释和优化 Oracle SQL、PL/SQL 与数据库脚本。",
  // Keep the repository free of role-specific prompt content. Enter instructions
  // in the workspace UI or load them from a private data source.
  systemPrompt: "",
  welcomeMessage: "告诉我 Oracle 版本、目标表结构和你希望脚本完成的任务。",
  defaultModelKey: "",
  knowledgeBaseIds: [],
  mcpSourceIds: [],
  skillSelection: DEFAULT_SKILL_SELECTION,
};

export function normalizeAssistantAvatar(value: string, name: string) {
  const normalized = value.trim().slice(0, 3).toUpperCase();
  return normalized || name.trim().slice(0, 2).toUpperCase() || "AI";
}
