import { create } from "zustand";

interface TypingState {
  /** conversationId -> ids of users currently typing in it. */
  typing: Record<string, string[]>;
  startTyping: (conversationId: string, userId: string) => void;
  stopTyping: (conversationId: string, userId: string) => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  typing: {},
  startTyping: (conversationId, userId) =>
    set((s) => {
      const current = s.typing[conversationId] ?? [];
      if (current.includes(userId)) return s;
      return {
        typing: { ...s.typing, [conversationId]: [...current, userId] },
      };
    }),
  stopTyping: (conversationId, userId) =>
    set((s) => {
      const current = s.typing[conversationId] ?? [];
      return {
        typing: {
          ...s.typing,
          [conversationId]: current.filter((id) => id !== userId),
        },
      };
    }),
}));
