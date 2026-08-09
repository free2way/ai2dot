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
