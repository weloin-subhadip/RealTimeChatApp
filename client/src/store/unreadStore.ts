import { create } from "zustand";

interface UnreadState {
  /** conversationId -> unread message count. */
  counts: Record<string, number>;
  setAll: (counts: Record<string, number>) => void;
  set: (conversationId: string, count: number) => void;
  reset: (conversationId: string) => void;
}

export const useUnreadStore = create<UnreadState>((set) => ({
  counts: {},
  setAll: (counts) => set({ counts }),
  set: (conversationId, count) =>
    set((s) => ({ counts: { ...s.counts, [conversationId]: count } })),
  reset: (conversationId) =>
    set((s) => {
      if (!s.counts[conversationId]) return s;
      const counts = { ...s.counts };
      delete counts[conversationId];
      return { counts };
    }),
}));
