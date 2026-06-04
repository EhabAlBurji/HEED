import { getSupabase } from "./supabase";
import { useChatStore } from "../stores/chatStore";
import { useAuthStore } from "../stores/authStore";

// =========================================================================
// Heed Chat — cloud sync
// Pushes / pulls the user's conversation list to `user_chat_data` so Heed
// Chat is the same on all devices. Runs on:
//  • App start (pull once after auth)
//  • Every new/updated conversation (debounced push, 3 s)
//  • Window focus (pull, throttled 30 s)
// =========================================================================

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPull = 0;

function canSync() {
  const user = useAuthStore.getState().user;
  return user && user.id !== "guest";
}

// ── Push ──────────────────────────────────────────────────────────────────
export function scheduleChatPush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void doPush(), 3_000);
}

async function doPush() {
  if (!canSync()) return;
  const uid = useAuthStore.getState().user!.id;
  const convs = useChatStore.getState().conversations;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (getSupabase() as any)
    .from("user_chat_data")
    .upsert({ user_id: uid, conversations: convs, updated_at: new Date().toISOString() });
}

// ── Pull ──────────────────────────────────────────────────────────────────
export async function pullChatData(force = false) {
  if (!canSync()) return;
  const now = Date.now();
  if (!force && now - lastPull < 30_000) return;
  lastPull = now;

  const uid = useAuthStore.getState().user!.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabase() as any)
    .from("user_chat_data")
    .select("conversations, updated_at")
    .eq("user_id", uid)
    .maybeSingle() as { data: { conversations: unknown; updated_at: string } | null };

  const localConvs = useChatStore.getState().conversations;
  const localLatest = localConvs.reduce(
    (max, c) => (c.updatedAt > max ? c.updatedAt : max), 0
  );

  if (!data?.conversations) {
    // No server data yet — seed it from local so other devices can pull it.
    if (localConvs.length > 0) void doPush();
    return;
  }

  const serverTs = new Date(data.updated_at).getTime();
  if (serverTs > localLatest) {
    // Server is newer — replace local.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useChatStore.setState({ conversations: data.conversations as any });
  } else if (localLatest > serverTs && localConvs.length > 0) {
    // Local is newer — push immediately without waiting for a change event.
    void doPush();
  }
}

// ── Wire into chatStore changes ───────────────────────────────────────────
// Subscribe after auth so we push whenever conversations mutate.
let unsubChatSync: (() => void) | null = null;

export function startChatSync() {
  if (unsubChatSync) return;
  void pullChatData(true);
  const unsubStore = useChatStore.subscribe((state, prev) => {
    if (state.conversations !== prev.conversations) scheduleChatPush();
  });
  const onFocus = () => void pullChatData();
  window.addEventListener("focus", onFocus);
  unsubChatSync = () => {
    unsubStore();
    window.removeEventListener("focus", onFocus);
    unsubChatSync = null;
  };
}

export function stopChatSync() {
  unsubChatSync?.();
  unsubChatSync = null;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
}
