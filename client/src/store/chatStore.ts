import { create } from "zustand";
import type { Conversation, Message, MessageStatus } from "../types";
import { messagePreview } from "../utils/notify";

interface Pagination {
  hasMore: boolean;
  nextBefore: string | null;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  /** Messages cached per conversation id, oldest-first. */
  messagesByConv: Record<string, Message[]>;
  /** Older-history paging state per conversation. */
  paginationByConv: Record<string, Pagination>;

  setConversations: (conversations: Conversation[]) => void;
  upsertConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  setActiveId: (id: string | null) => void;
  setMessages: (
    conversationId: string,
    messages: Message[],
    pagination?: Pagination
  ) => void;
  prependMessages: (
    conversationId: string,
    older: Message[],
    pagination: Pagination
  ) => void;
  addMessage: (message: Message) => void;
  markMessageFailed: (conversationId: string, clientId: string) => void;
  applyReceipt: (
    conversationId: string,
    messageIds: string[],
    status: "delivered" | "read"
  ) => void;
}

const statusRank: Record<MessageStatus, number> = {
  sending: -1,
  failed: -1,
  sent: 0,
  delivered: 1,
  read: 2,
};

const byNewestActivity = (a: Conversation, b: Conversation) =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeId: null,
  messagesByConv: {},
  paginationByConv: {},

  setConversations: (conversations) =>
    set({ conversations: [...conversations].sort(byNewestActivity) }),

  upsertConversation: (conversation) =>
    set((state) => {
      const without = state.conversations.filter((c) => c.id !== conversation.id);
      return { conversations: [conversation, ...without].sort(byNewestActivity) };
    }),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeId: state.activeId === id ? null : state.activeId,
    })),

  setActiveId: (activeId) => set({ activeId }),

  setMessages: (conversationId, messages, pagination) =>
    set((state) => ({
      messagesByConv: { ...state.messagesByConv, [conversationId]: messages },
      paginationByConv: pagination
        ? { ...state.paginationByConv, [conversationId]: pagination }
        : state.paginationByConv,
    })),

  prependMessages: (conversationId, older, pagination) =>
    set((state) => {
      const existing = state.messagesByConv[conversationId] ?? [];
      const seen = new Set(existing.map((m) => m.id));
      const merged = [...older.filter((m) => !seen.has(m.id)), ...existing];
      return {
        messagesByConv: { ...state.messagesByConv, [conversationId]: merged },
        paginationByConv: { ...state.paginationByConv, [conversationId]: pagination },
      };
    }),

  // Appends an incoming/optimistic message. If it carries a clientId, any
  // optimistic placeholder with that id is replaced (reconciliation).
  addMessage: (message) =>
    set((state) => {
      const convId = message.conversationId;
      const existing = state.messagesByConv[convId] ?? [];

      let list = message.clientId
        ? existing.filter((m) => m.id !== message.clientId)
        : existing;

      if (list.some((m) => m.id === message.id)) {
        // Real message already present — just drop any leftover placeholder.
        return { messagesByConv: { ...state.messagesByConv, [convId]: list } };
      }
      list = [...list, message];

      const conversations = state.conversations
        .map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessage: {
                  text: messagePreview(message),
                  senderId: message.senderId,
                  type: message.type,
                  createdAt: message.createdAt,
                },
                updatedAt: message.createdAt,
              }
            : c
        )
        .sort(byNewestActivity);

      return {
        messagesByConv: { ...state.messagesByConv, [convId]: list },
        conversations,
      };
    }),

  markMessageFailed: (conversationId, clientId) =>
    set((state) => {
      const list = state.messagesByConv[conversationId];
      if (!list) return state;
      return {
        messagesByConv: {
          ...state.messagesByConv,
          [conversationId]: list.map((m) =>
            m.id === clientId ? { ...m, status: "failed" as MessageStatus } : m
          ),
        },
      };
    }),

  applyReceipt: (conversationId, messageIds, status) =>
    set((state) => {
      const list = state.messagesByConv[conversationId];
      if (!list) return state;
      const ids = new Set(messageIds);
      const updated = list.map((m) =>
        ids.has(m.id) && statusRank[status] > statusRank[m.status]
          ? { ...m, status }
          : m
      );
      return {
        messagesByConv: { ...state.messagesByConv, [conversationId]: updated },
      };
    }),
}));
