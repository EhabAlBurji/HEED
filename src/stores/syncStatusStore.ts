import { create } from "zustand";

export type SyncState = "offline" | "idle" | "syncing" | "synced" | "error";

type SyncStatusState = {
  state: SyncState;
  pending: number;
  lastSyncedAt: number | null;
  lastError: string | null;

  setState: (s: SyncState) => void;
  noteError: (msg: string) => void;
  trackPending: <T>(p: Promise<T>) => Promise<T>;
};

export const useSyncStatusStore = create<SyncStatusState>((set, get) => ({
  state: "offline",
  pending: 0,
  lastSyncedAt: null,
  lastError: null,

  setState: (s) => {
    set({ state: s });
    if (s === "synced") set({ lastSyncedAt: Date.now(), lastError: null });
  },

  noteError: (msg) => set({ state: "error", lastError: msg }),

  trackPending: async (p) => {
    set({ pending: get().pending + 1, state: "syncing" });
    try {
      const r = await p;
      const next = get().pending - 1;
      set({ pending: next });
      if (next === 0) set({ state: "synced", lastSyncedAt: Date.now() });
      return r;
    } catch (e) {
      const next = get().pending - 1;
      set({ pending: next, state: "error", lastError: (e as Error)?.message ?? String(e) });
      throw e;
    }
  },
}));
