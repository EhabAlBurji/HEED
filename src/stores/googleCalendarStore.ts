import { create } from "zustand";
import { persist } from "zustand/middleware";

type GoogleCalendarState = {
  clientId: string;
  clientSecret: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null; // Unix ms
  isConnected: boolean;
  lastSyncAt: string | null;
  syncedCount: number;

  setCredentials: (clientId: string, clientSecret: string) => void;
  setTokens: (access: string, refresh: string | null, expiresIn: number) => void;
  clearConnection: () => void;
  setLastSync: (count: number) => void;
};

export const useGoogleCalendarStore = create<GoogleCalendarState>()(
  persist(
    (set) => ({
      clientId: "",
      clientSecret: "",
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      isConnected: false,
      lastSyncAt: null,
      syncedCount: 0,

      setCredentials: (clientId, clientSecret) =>
        set({ clientId, clientSecret }),

      setTokens: (access, refresh, expiresIn) =>
        set((s) => ({
          accessToken: access,
          // Only update refreshToken if a new one was returned
          refreshToken: refresh ?? s.refreshToken,
          tokenExpiry: Date.now() + expiresIn * 1000,
          isConnected: true,
        })),

      clearConnection: () =>
        set({
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
          isConnected: false,
          lastSyncAt: null,
          syncedCount: 0,
        }),

      setLastSync: (count) =>
        set({ lastSyncAt: new Date().toISOString(), syncedCount: count }),
    }),
    { name: "heed:google-calendar", version: 1 }
  )
);
