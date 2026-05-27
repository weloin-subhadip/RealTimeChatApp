import { create } from "zustand";

interface PresenceState {
  /** Set of currently-online user ids. Replaced on change so React re-renders. */
  online: Set<string>;
  setOnline: (ids: string[]) => void;
  addOnline: (id: string) => void;
  removeOnline: (id: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  online: new Set(),
  setOnline: (ids) => set({ online: new Set(ids) }),
  addOnline: (id) =>
    set((s) => {
      const online = new Set(s.online);
      online.add(id);
      return { online };
    }),
  removeOnline: (id) =>
    set((s) => {
      const online = new Set(s.online);
      online.delete(id);
      return { online };
    }),
}));
