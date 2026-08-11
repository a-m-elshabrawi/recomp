export type MessageRole = "user" | "assistant";

export type ConversationMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  updated_at: string;
};
