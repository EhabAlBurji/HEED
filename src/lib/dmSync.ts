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
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
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
    content: (r.content as string) ?? "",
    createdAt: r.created_at as string,
    readAt: (r.read_at as string) ?? null,
    attachmentUrl: (r.attachment_url as string) ?? null,
    attachmentName: (r.attachment_name as string) ?? null,
    attachmentType: (r.attachment_type as string) ?? null,
  };
}

// Fetch all DM partners:
// 1. Workspace members with linked accounts → get real name from profiles
// 2. Anyone with an existing DM thread
export async function fetchDmPartners(): Promise<DmPartner[]> {
  if (!canSync()) return [];
  const me = useAuthStore.getState().user!;
  try {
    const seen = new Map<string, DmPartner>();

    // Workspace members who have linked auth accounts
    const { data: wsData } = await sb()
      .from("workspace_members")
      .select("user_id, name, email")
      .not("user_id", "is", null)
      .neq("user_id", me.id);

    const wsUserIds: string[] = [];
    const wsNames: Record<string, { name: string; email: string }> = {};
    for (const r of (wsData ?? []) as { user_id: string; name: string; email: string }[]) {
      if (!wsNames[r.user_id]) {
        wsUserIds.push(r.user_id);
        wsNames[r.user_id] = { name: r.name, email: r.email ?? "" };
      }
    }

    // Fetch real profile names + avatars for workspace members
    if (wsUserIds.length > 0) {
      const { data: profileData } = await sb()
        .from("profiles")
        .select("id, name, email, avatar_url")
        .in("id", wsUserIds);
      for (const p of (profileData ?? []) as { id: string; name: string | null; email: string | null; avatar_url: string | null }[]) {
        const ws = wsNames[p.id];
        seen.set(p.id, {
          id: p.id,
          name: p.name ?? ws?.name ?? p.email ?? p.id,
          email: p.email ?? ws?.email ?? "",
          avatarUrl: p.avatar_url ?? null,
        });
      }
      // Fallback for workspace members whose profiles aren't found yet
      for (const id of wsUserIds) {
        if (!seen.has(id)) {
          const ws = wsNames[id];
          seen.set(id, { id, name: ws.name, email: ws.email, avatarUrl: null });
        }
      }
    }

    // Also fetch partners from existing DM threads (so DMs survive workspace changes)
    const { data: dmData } = await sb()
      .from("dm_messages")
      .select("sender_id, receiver_id")
      .or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`)
      .limit(200);

    const extraIds: string[] = [];
    for (const r of (dmData ?? []) as { sender_id: string; receiver_id: string }[]) {
      const pid = r.sender_id === me.id ? r.receiver_id : r.sender_id;
      if (pid !== me.id && !seen.has(pid)) extraIds.push(pid);
    }

    if (extraIds.length > 0) {
      const unique = [...new Set(extraIds)];
      const { data: pData } = await sb()
        .from("profiles")
        .select("id, name, email, avatar_url")
        .in("id", unique);
      for (const p of (pData ?? []) as { id: string; name: string | null; email: string | null; avatar_url: string | null }[]) {
        if (!seen.has(p.id)) {
          seen.set(p.id, {
            id: p.id,
            name: p.name ?? p.email ?? p.id,
            email: p.email ?? "",
            avatarUrl: p.avatar_url ?? null,
          });
        }
      }
    }

    return [...seen.values()];
  } catch (err) {
    console.error("[dmSync] fetchDmPartners:", err);
    return [];
  }
}

// Load the last N messages between me and a partner.
export async function fetchThread(partnerId: string, limit = 80): Promise<DmMessage[]> {
  if (!canSync()) return [];
  const me = useAuthStore.getState().user!;
  try {
    const { data, error } = await sb()
      .from("dm_messages")
      .select("*")
      .or(`and(sender_id.eq.${me.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${me.id})`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!data) return [];
    return (data as Record<string, unknown>[]).map(rowToMsg).reverse();
  } catch (err) {
    console.error("[dmSync] fetchThread:", err);
    return [];
  }
}

// Upload a file to Supabase storage, return the signed URL.
export async function uploadDmAttachment(
  file: File,
  senderId: string
): Promise<{ url: string; name: string; type: string } | null> {
  if (!canSync()) return null;
  const supabase = getSupabase();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${senderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    const { error: upErr } = await supabase.storage
      .from("dm-attachments")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    const { data: signed, error: signErr } = await supabase.storage
      .from("dm-attachments")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7-day signed URL
    if (signErr) throw signErr;
    return { url: signed.signedUrl, name: file.name, type: file.type };
  } catch (err) {
    console.error("[dmSync] uploadDmAttachment:", err);
    return null;
  }
}

// Send a message (optionally with attachment).
// Returns the persisted message or throws so the caller can show an error.
export async function sendDm(
  receiverId: string,
  content: string,
  attachment?: { url: string; name: string; type: string } | null
): Promise<DmMessage | null> {
  if (!canSync()) return null;
  const me = useAuthStore.getState().user!;
  const { data, error } = await sb()
    .from("dm_messages")
    .insert({
      sender_id: me.id,
      receiver_id: receiverId,
      content: content.trim() || (attachment ? "" : ""),
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error("[dmSync] sendDm:", error);
    throw error;
  }
  return data ? rowToMsg(data as Record<string, unknown>) : null;
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
  } catch { /* best-effort */ }
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
    for (const r of data as Record<string, unknown>[]) {
      const msg = rowToMsg(r);
      const partner = msg.senderId === me.id ? msg.receiverId : msg.senderId;
      if (!last[partner]) last[partner] = msg;
    }
    return last;
  } catch (err) {
    console.error("[dmSync] fetchLastMessages:", err);
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
  } catch { return {}; }
}

// Fetch a single partner's profile (used when a message arrives from an unknown sender).
export async function fetchPartnerProfile(userId: string): Promise<DmPartner | null> {
  if (!canSync()) return null;
  try {
    const { data } = await sb()
      .from("profiles")
      .select("id, name, email, avatar_url")
      .eq("id", userId)
      .single();
    if (!data) return null;
    const r = data as { id: string; name: string | null; email: string | null; avatar_url: string | null };
    return { id: r.id, name: r.name ?? r.email ?? r.id, email: r.email ?? "", avatarUrl: r.avatar_url ?? null };
  } catch {
    return null;
  }
}

// Search all active profiles by name/email (for New DM modal).
export async function searchProfiles(query: string): Promise<DmPartner[]> {
  if (!canSync()) return [];
  const me = useAuthStore.getState().user!;
  const q = query.trim();
  if (!q) return [];
  try {
    const { data } = await sb()
      .from("profiles")
      .select("id, name, email, avatar_url")
      .neq("id", me.id)
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(20);
    if (!data) return [];
    return (data as { id: string; name: string | null; email: string | null; avatar_url: string | null }[])
      .map((r) => ({
        id: r.id,
        name: r.name ?? r.email ?? r.id,
        email: r.email ?? "",
        avatarUrl: r.avatar_url ?? null,
      }));
  } catch (err) {
    console.error("[dmSync] searchProfiles:", err);
    return [];
  }
}

// Realtime subscription — fires on any DM INSERT involving me.
let dmChannel: RealtimeChannel | null = null;
let dmReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let dmOnMessage: ((msg: DmMessage) => void) | null = null;

function connectDmChannel() {
  if (!canSync() || !dmOnMessage) return;
  const me = useAuthStore.getState().user!;
  const supabase = getSupabase();
  if (dmChannel) {
    try { supabase.removeChannel(dmChannel); } catch { /* ignore */ }
    dmChannel = null;
  }
  dmChannel = supabase
    .channel("dm:" + me.id)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "dm_messages", filter: `receiver_id=eq.${me.id}` },
      (p: { new: Record<string, unknown> }) => dmOnMessage!(rowToMsg(p.new))
    )
    .subscribe((status: string) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // Exponential-backoff reconnect: 3s → 10s → 30s
        const delay = dmReconnectTimer ? 10_000 : 3_000;
        if (dmReconnectTimer) clearTimeout(dmReconnectTimer);
        dmReconnectTimer = setTimeout(() => {
          dmReconnectTimer = null;
          connectDmChannel();
        }, delay);
      }
    });
}

export function subscribeDms(onMessage: (msg: DmMessage) => void): () => void {
  if (!canSync()) return () => {};
  dmOnMessage = onMessage;
  connectDmChannel();
  return stopDmSubscription;
}

export function stopDmSubscription(): void {
  dmOnMessage = null;
  if (dmReconnectTimer) { clearTimeout(dmReconnectTimer); dmReconnectTimer = null; }
  if (dmChannel) {
    try { getSupabase().removeChannel(dmChannel); } catch { /* ignore */ }
    dmChannel = null;
  }
}
