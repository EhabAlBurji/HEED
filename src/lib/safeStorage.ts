import { createJSONStorage, type StateStorage } from "zustand/middleware";

// localStorage wrapper that never throws. A very large canvas/comment payload
// (base64 media) can exceed the ~5–10 MB quota and make localStorage.setItem
// throw QuotaExceededError — which, under zustand/persist, would otherwise
// bubble up and break the app. Here we swallow write failures: the in-memory
// state stays correct, the write is just skipped for that tick (and synced to
// Supabase Storage when online).
const safeLocal: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[persist] storage write skipped:", name, (e as Error)?.name);
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

// Drop-in replacement for the default zustand persist storage.
export const safeJSONStorage = () => createJSONStorage(() => safeLocal);
