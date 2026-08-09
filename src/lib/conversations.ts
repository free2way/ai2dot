export type ConversationListItem = {
  id: string;
  title: string;
  updatedAt: string;
  archived: boolean;
};

export type ConversationBranch = {
  id: string;
  conversationId: string;
  parentBranchId: string | null;
  forkedFromClientMessageId: string | null;
  name: string;
  isDefault: boolean;
  createdAt: string;
  messageCount: number;
};

type ConversationTextMessage = {
  role: "system" | "user" | "assistant";
  parts: Array<{ type: string; text?: string }>;
};

export function conversationToKnowledgeText(
  title: string,
  messages: ConversationTextMessage[],
) {
  const roleLabels = {
    system: "系统",
    user: "用户",
    assistant: "助手",
  } as const;
  const turns = messages.flatMap((message) => {
    const text = message.parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text?.trim())
      .filter(Boolean)
      .join("\n\n");
    return text ? [`## ${roleLabels[message.role]}\n\n${text}`] : [];
  });

  return [`# ${title}`, ...turns].join("\n\n");
}
