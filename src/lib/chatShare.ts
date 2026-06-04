import { getSupabase } from "./supabase";
import { useAuthStore } from "../stores/authStore";
import type { ChatMsg } from "../stores/chatStore";

export interface SharedChat {
  id: string;
  title: string;
  messages: ChatMsg[];
  assistant_name: string;
  created_at: string;
}

/** Create a public shareable snapshot of a conversation. Returns the share ID. */
export async function shareConversation(
  title: string,
  messages: ChatMsg[],
  assistantName: string
): Promise<string> {
  const uid = useAuthStore.getState().user?.id;
  if (!uid || uid === "guest") throw new Error("Must be signed in to share");

  const { data, error } = await (getSupabase() as any)
    .from("shared_chats")
    .insert({ owner_id: uid, title, messages, assistant_name: assistantName })
    .select("id")
    .single() as { data: { id: string } | null; error: unknown };

  if (error || !data) throw new Error("Failed to create share link");
  return data.id;
}

/** Update an existing share with the latest messages. */
export async function updateShare(
  shareId: string,
  messages: ChatMsg[]
): Promise<void> {
  await (getSupabase() as any)
    .from("shared_chats")
    .update({ messages, updated_at: new Date().toISOString() })
    .eq("id", shareId);
}

/** Fetch a shared conversation by its public ID (no auth required). */
export async function getSharedChat(id: string): Promise<SharedChat | null> {
  const { data } = await (getSupabase() as any)
    .from("shared_chats")
    .select("id, title, messages, assistant_name, created_at")
    .eq("id", id)
    .single() as { data: SharedChat | null };

  return data ?? null;
}

/** Delete a share the current user owns. */
export async function deleteShare(shareId: string): Promise<void> {
  await (getSupabase() as any)
    .from("shared_chats")
    .delete()
    .eq("id", shareId);
}
