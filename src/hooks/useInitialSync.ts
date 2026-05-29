import { useEffect, useRef } from "react";
import { useAuthStore } from "../stores/authStore";
import { pullAll, subscribeRealtime } from "../lib/sync";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSyncStatusStore } from "../stores/syncStatusStore";

// Pulls all data from Supabase on auth, then keeps the local stores in sync
// via realtime. No-op for guest users / unconfigured Supabase.
export function useInitialSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !userId || userId === "guest") {
      useSyncStatusStore.getState().setState("offline");
      return;
    }
    if (lastSyncedRef.current === userId) return;
    lastSyncedRef.current = userId;

    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      try {
        await pullAll();
        if (cancelled) return;
        unsubscribe = subscribeRealtime();
      } catch (e) {
        useSyncStatusStore.getState().noteError((e as Error).message);
        // eslint-disable-next-line no-console
        console.warn("[sync] initial pull failed:", (e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);
}
