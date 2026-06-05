import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { useAuthStore } from "../stores/authStore";
import type { DmPartner } from "./dmSync";

// =========================================================================
// Heed Group DMs — Supabase sync helpers
// =========================================================================

export type DmGroup = {
  id: string;
  workspaceId: string;
  name: string;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: string;
};

export type GroupMessage = {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  reactions: Record<string, string[]>;
};

const canSync = () => {
  if (!isSupabaseConfigured()) return false;
  const u = useAuthStore.getState().user;
  return Boolean(u && u.id !== "guest");
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => getSupabase() as any;

function rowToGroup(r: Record<string, unknown>): DmGroup {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    name: r.name as string,
    avatarUrl: (r.avatar_url as string) ?? null,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
  };
}

function rowToGroupMsg(r: Record<string, unknown>): GroupMessage {
  return {
    id: r.id as string,
    groupId: r.group_id as string,
    senderId: r.sender_id as string,
    content: (r.content as string) ?? "",
    createdAt: r.created_at as string,
    editedAt: (r.edited_at as string) ?? null,
    attachmentUrl: (r.attachment_url as string) ?? null,
    attachmentName: (r.attachment_name as string) ?? null,
    attachmentType: (r.attachment_type as string) ?? null,
    reactions: (r.reactions as Record<string, string[]>) ?? {},
  };
}

// Edit the content of a group message (only sender can edit their own message).
export async function editGroupMessage(messageId: string, newContent: string): Promise<void> {
  if (!canSync()) return;
  const me = useAuthStore.getState().user!;
  try {
    const { error } = await sb()
      .from("dm_group_messages")
      .update({ content: newContent, edited_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("sender_id", me.id);
    if (error) throw error;
  } catch (err) {
    console.error("[groupSync] editGroupMessage:", err);
    throw err;
  }
}

// Delete a group message (only sender can delete their own message).
export async function deleteGroupMessage(messageId: string): Promise<void> {
  if (!canSync()) return;
  const me = useAuthStore.getState().user!;
  try {
    const { error } = await sb()
      .from("dm_group_messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", me.id);
    if (error) throw error;
  } catch (err) {
    console.error("[groupSync] deleteGroupMessage:", err);
    throw err;
  }
}

// Fetch all groups I'm a member of in a given workspace.
export async function fetchGroups(workspaceId: string): Promise<DmGroup[]> {
  if (!canSync()) return [];
  const me = useAuthStore.getState().user!;
  try {
    // Get group IDs I'm a member of
    const { data: memberData, error: memberErr } = await sb()
      .from("dm_group_members")
      .select("group_id")
      .eq("user_id", me.id);
    if (memberErr) throw memberErr;
    if (!memberData || memberData.length === 0) return [];

    const groupIds = (memberData as { group_id: string }[]).map((r) => r.group_id);

    const { data, error } = await sb()
      .from("dm_groups")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("id", groupIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data) return [];
    return (data as Record<string, unknown>[]).map(rowToGroup);
  } catch (err) {
    console.error("[groupSync] fetchGroups:", err);
    return [];
  }
}

// Fetch all members of a group (returns DmPartner shape for reuse in UI).
export async function fetchGroupMembers(groupId: string): Promise<DmPartner[]> {
  if (!canSync()) return [];
  try {
    const { data: memberData, error: memberErr } = await sb()
      .from("dm_group_members")
      .select("user_id")
      .eq("group_id", groupId);
    if (memberErr) throw memberErr;
    if (!memberData || memberData.length === 0) return [];

    const userIds = (memberData as { user_id: string }[]).map((r) => r.user_id);

    const { data: profileData, error: profileErr } = await sb()
      .from("profiles")
      .select("id, name, email, avatar_url")
      .in("id", userIds);
    if (profileErr) throw profileErr;
    if (!profileData) return [];

    return (profileData as { id: string; name: string | null; email: string | null; avatar_url: string | null }[]).map(
      (p) => ({
        id: p.id,
        name: p.name ?? p.email ?? p.id,
        email: p.email ?? "",
        avatarUrl: p.avatar_url ?? null,
      })
    );
  } catch (err) {
    console.error("[groupSync] fetchGroupMembers:", err);
    return [];
  }
}

// Load the last N messages for a group thread.
export async function fetchGroupThread(groupId: string, limit = 80): Promise<GroupMessage[]> {
  if (!canSync()) return [];
  try {
    const { data, error } = await sb()
      .from("dm_group_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!data) return [];
    return (data as Record<string, unknown>[]).map(rowToGroupMsg).reverse();
  } catch (err) {
    console.error("[groupSync] fetchGroupThread:", err);
    return [];
  }
}

// Send a message to a group.
export async function sendGroupMessage(
  groupId: string,
  content: string,
  attachment?: { url: string; name: string; type: string } | null
): Promise<GroupMessage | null> {
  if (!canSync()) return null;
  const me = useAuthStore.getState().user!;
  try {
    const { data, error } = await sb()
      .from("dm_group_messages")
      .insert({
        group_id: groupId,
        sender_id: me.id,
        content: content.trim() || "",
        attachment_url: attachment?.url ?? null,
        attachment_name: attachment?.name ?? null,
        attachment_type: attachment?.type ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data ? rowToGroupMsg(data as Record<string, unknown>) : null;
  } catch (err) {
    console.error("[groupSync] sendGroupMessage:", err);
    throw err;
  }
}

// Create a new group and add members.
export async function createGroup(
  workspaceId: string,
  name: string,
  memberIds: string[]
): Promise<DmGroup | null> {
  if (!canSync()) return null;
  const me = useAuthStore.getState().user!;
  try {
    // Create the group
    const { data: groupData, error: groupErr } = await sb()
      .from("dm_groups")
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        created_by: me.id,
      })
      .select()
      .single();
    if (groupErr) throw groupErr;
    if (!groupData) return null;

    const group = rowToGroup(groupData as Record<string, unknown>);

    // Add all members (including creator)
    const allMembers = [...new Set([me.id, ...memberIds])];
    const memberRows = allMembers.map((userId) => ({
      group_id: group.id,
      user_id: userId,
    }));

    const { error: memberErr } = await sb()
      .from("dm_group_members")
      .insert(memberRows);
    if (memberErr) throw memberErr;

    return group;
  } catch (err) {
    console.error("[groupSync] createGroup:", err);
    return null;
  }
}

// Toggle a reaction emoji on a group message.
export async function toggleGroupReaction(messageId: string, emoji: string): Promise<void> {
  if (!canSync()) return;
  const me = useAuthStore.getState().user!;
  try {
    const { data, error } = await sb()
      .from("dm_group_messages")
      .select("reactions")
      .eq("id", messageId)
      .single();
    if (error) throw error;
    const current: Record<string, string[]> = (data?.reactions as Record<string, string[]>) ?? {};
    const users = current[emoji] ?? [];
    const newUsers = users.includes(me.id)
      ? users.filter((id) => id !== me.id)
      : [...users, me.id];
    const newReactions = { ...current };
    if (newUsers.length === 0) {
      delete newReactions[emoji];
    } else {
      newReactions[emoji] = newUsers;
    }
    await sb()
      .from("dm_group_messages")
      .update({ reactions: newReactions })
      .eq("id", messageId);
  } catch (err) {
    console.error("[groupSync] toggleGroupReaction:", err);
  }
}

// ─── localStorage-based group read tracking ───────────────────────────────────
// Keeps track of the last-read message timestamp per group so we can show
// unread badges without a server round-trip.

export function getGroupLastRead(groupId: string): string {
  return localStorage.getItem(`heed-group-read-${groupId}`) ?? "";
}

export function markGroupRead(groupId: string, latestMsgCreatedAt: string): void {
  localStorage.setItem(`heed-group-read-${groupId}`, latestMsgCreatedAt);
}

export function getGroupUnreadCount(groupId: string, messages: GroupMessage[]): number {
  const lastRead = getGroupLastRead(groupId);
  if (!lastRead) return messages.length > 0 ? messages.length : 0;
  return messages.filter((m) => m.createdAt > lastRead).length;
}

// Realtime subscription for a single group's messages.
const groupChannels = new Map<string, RealtimeChannel>();

export function subscribeGroup(
  groupId: string,
  onMessage: (msg: GroupMessage) => void,
  onUpdate?: (msg: GroupMessage) => void
): () => void {
  if (!canSync()) return () => {};

  const supabase = getSupabase();

  // Clean up any existing channel for this group
  const existing = groupChannels.get(groupId);
  if (existing) {
    try { supabase.removeChannel(existing); } catch { /* ignore */ }
    groupChannels.delete(groupId);
  }

  const channel = supabase
    .channel("group:" + groupId)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "dm_group_messages",
        filter: `group_id=eq.${groupId}`,
      },
      (p: { new: Record<string, unknown> }) => onMessage(rowToGroupMsg(p.new))
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "dm_group_messages",
        filter: `group_id=eq.${groupId}`,
      },
      (p: { new: Record<string, unknown> }) => {
        const msg = rowToGroupMsg(p.new);
        (onUpdate ?? onMessage)(msg);
      }
    )
    .subscribe();

  groupChannels.set(groupId, channel);

  return () => {
    const ch = groupChannels.get(groupId);
    if (ch) {
      try { supabase.removeChannel(ch); } catch { /* ignore */ }
      groupChannels.delete(groupId);
    }
  };
}
