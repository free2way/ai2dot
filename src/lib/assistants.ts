export type AssistantSummary = {
  id: string;
  name: string;
  avatar: string;
  description: string | null;
  systemPrompt: string;
  welcomeMessage: string | null;
  defaultModelKey: string | null;
  knowledgeBaseIds: string[];
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
};

export const ORACLE_ASSISTANT_TEMPLATE: AssistantInput = {
  name: "Oracle 专家",
  avatar: "OR",
  description: "编写、解释和优化 Oracle SQL、PL/SQL 与数据库脚本。",
  systemPrompt: `你是一位资深 Oracle 数据库工程师。
先确认 Oracle 版本、目标对象和执行风险，再提供可运行的 SQL 或 PL/SQL。
脚本必须标注事务边界、权限要求、回滚方式和可能的锁表影响。
涉及生产数据时，优先给出只读检查语句，不得声称已经执行脚本。`,
  welcomeMessage: "告诉我 Oracle 版本、目标表结构和你希望脚本完成的任务。",
  defaultModelKey: "",
  knowledgeBaseIds: [],
};

export function normalizeAssistantAvatar(value: string, name: string) {
  const normalized = value.trim().slice(0, 3).toUpperCase();
  return normalized || name.trim().slice(0, 2).toUpperCase() || "AI";
}
