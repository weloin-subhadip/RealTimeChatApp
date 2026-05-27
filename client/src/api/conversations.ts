import { api } from "./client";
import type { Conversation, Message } from "../types";

export interface ConversationListResult {
  conversations: Conversation[];
  unread: Record<string, number>;
}

export async function listConversations(): Promise<ConversationListResult> {
  const { data } = await api.get<ConversationListResult>("/conversations");
  return data;
}

export async function createConversation(
  participantId: string
): Promise<Conversation> {
  const { data } = await api.post<{ conversation: Conversation }>(
    "/conversations",
    { participantId }
  );
  return data.conversation;
}

export async function createGroup(
  name: string,
  memberIds: string[]
): Promise<Conversation> {
  const { data } = await api.post<{ conversation: Conversation }>(
    "/conversations/group",
    { name, memberIds }
  );
  return data.conversation;
}

export async function addMember(
  conversationId: string,
  userId: string
): Promise<Conversation> {
  const { data } = await api.post<{ conversation: Conversation }>(
    `/conversations/${conversationId}/members`,
    { userId }
  );
  return data.conversation;
}

export async function removeMember(
  conversationId: string,
  userId: string
): Promise<Conversation> {
  const { data } = await api.delete<{ conversation: Conversation }>(
    `/conversations/${conversationId}/members/${userId}`
  );
  return data.conversation;
}

export interface HistoryPage {
  messages: Message[];
  hasMore: boolean;
  nextBefore: string | null;
}

export async function getHistory(
  conversationId: string,
  before?: string
): Promise<HistoryPage> {
  const { data } = await api.get<HistoryPage>(
    `/conversations/${conversationId}/messages`,
    { params: before ? { before } : {} }
  );
  return data;
}
