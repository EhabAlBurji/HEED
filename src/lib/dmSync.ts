import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { useAuthStore } from "../stores/authStore";

// =========================================================================
// Heed DM — Supabase sync helpers
// =========================================================================

export type DmMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type DmPartner = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

const canSync = () => {
  if (!isSupabaseConfigured()) return false;
  const u = useAuthStore.getState().user;
  return Boolean(u && u.id !== "guest");
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => getSupabase() as any;

function rowToMsg(r: Record<string, unknown>): DmMessage {
  return {
    id: r.id as string,
    senderId: r.sender_id as string,
    receiverId: r.receiver_id as string,
    content: r.content as string,
    createdAt: r.created_at as string,
    readAt: (r.read_at as string) ?? null,
  };
}

// Fetch all workspace members the current user can DM (excluding self).
export async function fetchDmPartners(): Promise<DmPartner[]> {
  if (!canSync()) return [];
  const me = useAuthStore.getState().user!;
  try {
    const { data } = await sb()
      .from("workspace_members")
      .select("user_id, name, email")
      .not("user_id", "is", null)
      .neq("user_id", me.id);
    if (!data) return [];
    // Deduplicate by user_id (same person in multiple workspaces).
    const seen = new Map<string, DmPartner>();
    for (const r of data as { user_id: string; name: string; email: string }[]) {
      if (!seen.has(r.user_id)) {
        seen.set(r.user_id, { id: r.user_id, name: r.name ?? r.email ?? r.user_id, email: r.email ?? "", avatarUrl: null });
      }
    }
    return [...seen.values()];
  } catch {
    return [];
  }
}

// Load the last N messages between me and a partner.
export async function fetchThread(partnerId: string, limit = 60): Promise<DmMessage[]> {
  if (!canSync()) return [];
  const me = useAuthStore.getState().user!;
  try {
    const { data } = await sb()
      .from("dm_messages")
      .select("*")
      .or(`and(sender_id.eq.${me.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${me.id})`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!data) return [];
    return (data as Record<string, unknown>[]).map(rowToMsg).reverse();
  } catch {
    return [];
  }
}

// Send a message.
export async function sendDm(receiverId: string, content: string): Promise<DmMessage | null> {
  if (!canSync()) return null;
  const me = useAuthStore.getState().user!;
  try {
    const { data } = await sb()
      .from("dm_messages")
      .insert({ sender_id: me.id, receiver_id: receiverId, content: content.trim() })
      .select()
      .single();
    return data ? rowToMsg(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Mark all unread messages in a thread as read.
export async function markThreadRead(partnerId: string): Promise<void> {
  if (!canSync()) return;
  const me = useAuthStore.getState().user!;
  try {
    await sb()
      .from("dm_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("receiver_id", me.id)
      .eq("sender_id", partnerId)
      .is("read_at", null);
  } catch {
    /* best-effort */
  }
}

// Load the last message for each conversation partner (for the sidebar).
export async function fetchLastMessages(): Promise<Record<string, DmMessage>> {
  if (!canSync()) return {};
  const me = useAuthStore.getState().user!;
  try {
    const { data } = await sb()
      .from("dm_messages")
      .select("*")
      .or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data) return {};
    const last: Record<string, DmMessage> = {};
    for (const r of (data as Record<string, unknown>[])) {
      const msg = rowToMsg(r);
      const partner = msg.senderId === me.id ? msg.receiverId : msg.senderId;
      if (!last[partner]) last[partner] = msg;
    }
    return last;
  } catch {
    return {};
  }
}

// Count unread messages per partner.
export async function fetchUnreadCounts(): Promise<Record<string, number>> {
  if (!canSync()) return {};
  const me = useAuthStore.getState().user!;
  try {
    const { data } = await sb()
      .from("dm_messages")
      .select("sender_id")
      .eq("receiver_id", me.id)
      .is("read_at", null);
    if (!data) return {};
    const counts: Record<string, number> = {};
    for (const r of data as { sender_id: string }[]) {
      counts[r.sender_id] = (counts[r.sender_id] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

// Realtime subscription: calls onMessage whenever a DM arrives for me.
let dmChannel: RealtimeChannel | null = null;

export function subscribeDms(onMessage: (msg: DmMessage) => void): () => void {
  if (!canSync()) return () => {};
  const me = useAuthStore.getState().user!;
  const supabase = getSupabase();
  stopDmSubscription();
  dmChannel = supabase
    .channel("dm:" + me.id)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "dm_messages", filter: `receiver_id=eq.${me.id}` },
      (p: { new: Record<string, unknown> }) => onMessage(rowToMsg(p.new))
    )
    .subscribe();
  return stopDmSubscription;
}

export function stopDmSubscription(): void {
  if (dmChannel) {
    try { getSupabase().removeChannel(dmChannel); } catch { /* ignore */ }
    dmChannel = null;
  }
}
