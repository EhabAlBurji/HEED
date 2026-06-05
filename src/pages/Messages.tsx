import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Edit3, Phone, Video, MoreVertical,
  Smile, Paperclip, Mic, ArrowUp, Check, CheckCheck,
  MessageSquare, ChevronLeft, Filter, X, FileText,
  Image as ImageIcon, AlertCircle, Users, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import * as Popover from "@radix-ui/react-popover";
import { useAuthStore } from "../stores/authStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useIsMobile } from "../hooks/useIsMobile";
import { cn } from "../lib/utils";
import {
  fetchDmPartners, fetchThread, fetchLastMessages, fetchUnreadCounts,
  sendDm, markThreadRead, subscribeDms, searchProfiles, uploadDmAttachment,
  fetchPartnerProfile, toggleReaction, subscribePresence,
  type DmMessage, type DmPartner,
} from "../lib/dmSync";
import {
  fetchGroups, fetchGroupMembers, fetchGroupThread, sendGroupMessage,
  createGroup, subscribeGroup, toggleGroupReaction,
  getGroupLastRead, markGroupRead,
  type DmGroup, type GroupMessage,
} from "../lib/groupSync";
import { showNotification, canNotify } from "../lib/notifications";

// =========================================================================
// Heed DMs — WhatsApp Web-style DM chat
// =========================================================================

const EMOJI_ROWS = [
  ["😀","😁","😂","🤣","😊","😍","🥰","😎","🤔","😅","😭","😤"],
  ["👍","👎","❤️","🔥","🎉","💯","🙏","👏","✅","❌","🚀","💪"],
  ["😴","🤯","😱","🥳","😏","🤗","😒","😌","😔","🙄","🤫","🤭"],
  ["🌍","⭐","🎵","📸","🎮","🏆","💡","📱","💻","🌙","☀️","⚡"],
  ["🍕","🍔","☕","🍺","🎂","🍰","🍩","🍦","🌮","🥗","🍜","🍣"],
];

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dayStamp(iso: string, isAr = false) {
  const d = new Date(iso);
  const today = new Date(new Date().toDateString());
  const diff = Math.round((new Date(d.toDateString()).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return isAr ? "اليوم" : "Today";
  if (diff === -1) return isAr ? "أمس" : "Yesterday";
  const locale = isAr ? "ar" : "en";
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}
function relativeTime(iso: string, isAr = false) {
  const d = new Date(iso);
  const today = new Date(new Date().toDateString());
  const diff = Math.round((new Date(d.toDateString()).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return hhmm(iso);
  if (diff === -1) return isAr ? "أمس" : "Yesterday";
  const locale = isAr ? "ar" : "en";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}
function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

const AVATAR_COLORS = [
  "bg-violet-500","bg-blue-500","bg-emerald-500",
  "bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-teal-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function isImageType(type: string | null) {
  return Boolean(type && type.startsWith("image/"));
}

// ── Highlight helper ─────────────────────────────────────────────────────────
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-300/60 rounded-sm not-italic">{part}</mark>
      : part
  );
}

// ── Message tick ─────────────────────────────────────────────────────────────
function MsgTick({ msg, isMine }: { msg: DmMessage; isMine: boolean }) {
  if (!isMine) return null;
  return msg.readAt
    ? <CheckCheck className="inline h-3.5 w-3.5 text-sky-300 shrink-0" />
    : <Check className="inline h-3.5 w-3.5 opacity-60 shrink-0" />;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function ContactAvatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string | null; size?: "xs" | "sm" | "md" }) {
  const dims = size === "xs" ? "h-6 w-6 text-[9px]" : size === "sm" ? "h-9 w-9 text-[11px]" : "h-11 w-11 text-[13px]";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", dims)}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={cn("shrink-0 grid place-items-center rounded-full font-bold text-white", dims, avatarColor(name))}>
      {initials(name)}
    </div>
  );
}

export default function Messages() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const isMobile = useIsMobile();
  const me = useAuthStore((s) => s.user);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"dms" | "groups">("dms");

  const [partners, setPartners] = useState<DmPartner[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, DmMessage[]>>({});
  const [lastMsgs, setLastMsgs] = useState<Record<string, DmMessage>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [listWidth, setListWidth] = useState(340);

  // Pagination
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  // Online presence
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  // New DM modal
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [dmSearch, setDmSearch] = useState("");
  const [dmResults, setDmResults] = useState<DmPartner[]>([]);
  const [dmSearching, setDmSearching] = useState(false);
  const dmSearchRef = useRef<HTMLInputElement>(null);
  const dmSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Groups state ──────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<DmGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupThreads, setGroupThreads] = useState<Record<string, GroupMessage[]>>({});
  const [groupMembers, setGroupMembers] = useState<Record<string, DmPartner[]>>({});
  const [groupLastMsgs, setGroupLastMsgs] = useState<Record<string, GroupMessage>>({});
  const [groupUnread, setGroupUnread] = useState<Record<string, number>>({});
  const [groupText, setGroupText] = useState("");
  const [groupSending, setGroupSending] = useState(false);
  const [groupFailedIds, setGroupFailedIds] = useState<Set<string>>(new Set());
  const groupInputRef = useRef<HTMLTextAreaElement>(null);
  const groupBottomRef = useRef<HTMLDivElement>(null);

  // New Group modal
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberSearch, setGroupMemberSearch] = useState("");
  const [groupMemberResults, setGroupMemberResults] = useState<DmPartner[]>([]);
  const [groupMemberSearching, setGroupMemberSearching] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<DmPartner[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const groupMemberSearchRef = useRef<HTMLInputElement>(null);
  const groupMemberSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupUnsubscribeRef = useRef<(() => void) | null>(null);

  // Attachment (DM)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Attachment (Group)
  const groupFileInputRef = useRef<HTMLInputElement>(null);
  const [groupPendingFile, setGroupPendingFile] = useState<File | null>(null);
  const [groupPendingPreview, setGroupPendingPreview] = useState<string | null>(null);
  const [groupUploading, setGroupUploading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Thread search (DM)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const msgRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const threadSearchRef = useRef<HTMLInputElement>(null);

  // Group thread search
  const [groupSearchOpen, setGroupSearchOpen] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupSearchMatchIdx, setGroupSearchMatchIdx] = useState(0);
  const groupMsgRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupThreadSearchRef = useRef<HTMLInputElement>(null);

  // Reactions hover (desktop) / long-press (mobile)
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const [p, l, u] = await Promise.all([fetchDmPartners(), fetchLastMessages(), fetchUnreadCounts()]);
      setPartners(p);
      setLastMsgs(l);
      setUnread(u);
    })();
  }, []);

  // ── Handle heed:open-dm from GlobalSearch ────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { partnerId } = (e as CustomEvent<{ partnerId: string }>).detail;
      setActiveTab("dms");
      setActiveId(partnerId);
      setActiveGroupId(null);
      setPartners((prev) => {
        if (prev.some((p) => p.id === partnerId)) return prev;
        void fetchPartnerProfile(partnerId).then((profile) => {
          if (profile) setPartners((cur) => cur.some((p) => p.id === profile.id) ? cur : [profile, ...cur]);
        });
        return prev;
      });
    };
    window.addEventListener("heed:open-dm", handler);
    return () => window.removeEventListener("heed:open-dm", handler);
  }, []);

  // ── Groups initial load ───────────────────────────────────────────────────
  // We load groups for the current user's workspace. Since workspaceId isn't
  // directly in authStore, we read it from the first workspace_member row
  // (same approach used elsewhere in the app). We use a broad fetch: all groups
  // where I'm a member, then filter by the user's primary workspace client-side.
  useEffect(() => {
    if (!me || me.id === "guest") return;
    // Fetch groups for all workspaces; group by workspace_id in UI later if needed.
    // For now we just fetch all groups where I'm a member across all workspaces.
    void (async () => {
      // We need a workspaceId; fetch from workspace_members
      const { getSupabase, isSupabaseConfigured } = await import("../lib/supabase");
      if (!isSupabaseConfigured()) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb2 = getSupabase() as any;
      const { data: wsData } = await sb2
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", me.id)
        .limit(1)
        .single();
      if (!wsData) return;
      const wsId = (wsData as { workspace_id: string }).workspace_id;
      const g = await fetchGroups(wsId);
      setGroups(g);
      // Fetch last message for each group and compute unread counts
      for (const group of g) {
        const msgs = await fetchGroupThread(group.id, 1);
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          setGroupLastMsgs((prev) => ({ ...prev, [group.id]: lastMsg }));
          // Unread = has there been a message after our last read timestamp?
          const lastRead = getGroupLastRead(group.id);
          const unreadCount = lastRead ? (lastMsg.createdAt > lastRead ? 1 : 0) : 1;
          setGroupUnread((prev) => ({ ...prev, [group.id]: unreadCount }));
        }
      }
    })();
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load group thread + members on group change ───────────────────────────
  useEffect(() => {
    if (!activeGroupId) return;
    void fetchGroupThread(activeGroupId).then((msgs) => {
      setGroupThreads((prev) => ({ ...prev, [activeGroupId]: msgs }));
      // Mark group as read when we open it
      if (msgs.length > 0) {
        const latest = msgs[msgs.length - 1];
        markGroupRead(activeGroupId, latest.createdAt);
        setGroupUnread((prev) => ({ ...prev, [activeGroupId]: 0 }));
      }
    });
    if (!groupMembers[activeGroupId]) {
      void fetchGroupMembers(activeGroupId).then((members) =>
        setGroupMembers((prev) => ({ ...prev, [activeGroupId]: members }))
      );
    }

    // Realtime subscription for the active group
    if (groupUnsubscribeRef.current) {
      groupUnsubscribeRef.current();
      groupUnsubscribeRef.current = null;
    }
    const unsub = subscribeGroup(
      activeGroupId,
      (msg) => {
        if (msg.senderId === me?.id) return; // skip own messages (already added optimistically)
        setGroupThreads((prev) => {
          const existing = prev[msg.groupId] ?? [];
          if (existing.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [msg.groupId]: [...existing, msg] };
        });
        setGroupLastMsgs((prev) => ({ ...prev, [msg.groupId]: msg }));
        // Bump unread count for groups we're not currently viewing
        if (msg.groupId !== activeGroupId) {
          setGroupUnread((prev) => ({ ...prev, [msg.groupId]: (prev[msg.groupId] ?? 0) + 1 }));
        } else {
          // Currently open: mark as read immediately
          markGroupRead(msg.groupId, msg.createdAt);
        }
        // Ensure we have member info for the sender
        if (msg.groupId === activeGroupId) {
          setGroupMembers((prev) => {
            const members = prev[activeGroupId] ?? [];
            if (!members.some((m) => m.id === msg.senderId)) {
              void fetchGroupMembers(activeGroupId).then((updated) =>
                setGroupMembers((cur) => ({ ...cur, [activeGroupId]: updated }))
              );
            }
            return prev;
          });
        }
        // Push notification when tab is in background
        if (canNotify()) {
          setGroups((cur) => {
            const groupName = cur.find((g) => g.id === msg.groupId)?.name ?? "Group";
            setGroupMembers((mems) => {
              const sender = mems[msg.groupId]?.find((m) => m.id === msg.senderId);
              const senderName = sender?.name ?? "Someone";
              showNotification(`${senderName} → ${groupName}`, msg.content || "📎 Attachment", { tag: msg.groupId });
              return mems;
            });
            return cur;
          });
        }
      },
      (updated) => {
        setGroupThreads((prev) => {
          const thread = prev[updated.groupId];
          if (!thread) return prev;
          return {
            ...prev,
            [updated.groupId]: thread.map((m) => m.id === updated.id ? { ...m, reactions: updated.reactions } : m),
          };
        });
      }
    );
    groupUnsubscribeRef.current = unsub;

    return () => {
      if (groupUnsubscribeRef.current) {
        groupUnsubscribeRef.current();
        groupUnsubscribeRef.current = null;
      }
    };
  }, [activeGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll group thread to bottom ────────────────────────────────────────
  const activeGroupThreadLen = activeGroupId ? (groupThreads[activeGroupId]?.length ?? 0) : 0;
  useEffect(() => {
    groupBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeGroupThreadLen, activeGroupId]);

  // ── Group member search modal ─────────────────────────────────────────────
  useEffect(() => {
    if (!newGroupOpen) return;
    if (groupMemberSearchTimer.current) clearTimeout(groupMemberSearchTimer.current);
    if (!groupMemberSearch.trim()) { setGroupMemberResults([]); return; }
    setGroupMemberSearching(true);
    groupMemberSearchTimer.current = setTimeout(async () => {
      const r = await searchProfiles(groupMemberSearch);
      setGroupMemberResults(r);
      setGroupMemberSearching(false);
    }, 300);
    return () => { if (groupMemberSearchTimer.current) clearTimeout(groupMemberSearchTimer.current); };
  }, [groupMemberSearch, newGroupOpen]);

  useEffect(() => {
    if (newGroupOpen) {
      setGroupName("");
      setGroupMemberSearch("");
      setGroupMemberResults([]);
      setSelectedMembers([]);
      setTimeout(() => groupMemberSearchRef.current?.focus(), 60);
    }
  }, [newGroupOpen]);

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      // Need workspaceId
      const { getSupabase, isSupabaseConfigured } = await import("../lib/supabase");
      if (!isSupabaseConfigured()) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb2 = getSupabase() as any;
      const { data: wsData } = await sb2
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", me!.id)
        .limit(1)
        .single();
      if (!wsData) {
        toast.error(isAr ? "تعذّر إنشاء المجموعة" : "Could not determine workspace");
        return;
      }
      const wsId = (wsData as { workspace_id: string }).workspace_id;
      const group = await createGroup(wsId, groupName, selectedMembers.map((m) => m.id));
      if (!group) {
        toast.error(isAr ? "فشل إنشاء المجموعة" : "Failed to create group");
        return;
      }
      setGroups((prev) => [group, ...prev]);
      setNewGroupOpen(false);
      setActiveGroupId(group.id);
      setActiveTab("groups");
    } catch {
      toast.error(isAr ? "فشل إنشاء المجموعة" : "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  // ── Send group message ────────────────────────────────────────────────────
  const handleGroupSend = useCallback(async () => {
    if (!activeGroupId || (!groupText.trim() && !groupPendingFile) || groupSending || groupUploading || !me) return;
    setGroupSending(true);

    // Upload attachment first if any
    let attachment: { url: string; name: string; type: string } | null = null;
    if (groupPendingFile) {
      setGroupUploading(true);
      attachment = await uploadDmAttachment(groupPendingFile, me.id);
      setGroupUploading(false);
      if (!attachment) {
        toast.error(isAr ? "فشل رفع الملف" : "File upload failed");
        setGroupSending(false);
        return;
      }
      clearGroupPendingFile();
    }

    const optimisticId = crypto.randomUUID();
    const optimistic: GroupMessage = {
      id: optimisticId,
      groupId: activeGroupId,
      senderId: me.id,
      content: groupText.trim(),
      createdAt: new Date().toISOString(),
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentType: attachment?.type ?? null,
      reactions: {},
    };
    setGroupThreads((prev) => ({ ...prev, [activeGroupId]: [...(prev[activeGroupId] ?? []), optimistic] }));
    setGroupLastMsgs((prev) => ({ ...prev, [activeGroupId]: optimistic }));
    setGroupText("");
    try {
      const sent = await sendGroupMessage(activeGroupId, optimistic.content, attachment ?? undefined);
      if (sent) {
        setGroupThreads((prev) => ({
          ...prev,
          [activeGroupId]: (prev[activeGroupId] ?? []).map((m) => m.id === optimisticId ? sent : m),
        }));
        setGroupLastMsgs((prev) => ({ ...prev, [activeGroupId]: sent }));
      }
    } catch {
      setGroupFailedIds((prev) => new Set(prev).add(optimisticId));
      toast.error(isAr ? "فشل إرسال الرسالة" : "Message failed to send");
    }
    setGroupSending(false);
    groupInputRef.current?.focus();
  }, [activeGroupId, groupText, groupPendingFile, groupSending, groupUploading, me, isAr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeDms(
      (msg) => {
        // The DM channel only fires for messages where we are the receiver.
        // Guard against our own messages in case the filter is ever widened.
        if (msg.senderId === me?.id) return;
        const partner = msg.senderId;

        // If we don't know this sender yet, fetch their profile and add them to the list.
        setPartners((prev) => {
          if (!prev.some((p) => p.id === partner)) {
            void fetchPartnerProfile(partner).then((profile) => {
              if (profile) {
                setPartners((cur) =>
                  cur.some((p) => p.id === profile.id) ? cur : [profile, ...cur]
                );
              }
            });
          }
          return prev;
        });

        setLastMsgs((prev) => ({ ...prev, [partner]: msg }));
        setThreads((prev) => {
          const existing = prev[partner] ?? [];
          if (existing.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [partner]: [...existing, msg] };
        });
        if (partner !== activeId) {
          setUnread((prev) => ({ ...prev, [partner]: (prev[partner] ?? 0) + 1 }));
        } else {
          void markThreadRead(partner);
        }

        // Browser push notification when tab is in background
        if (canNotify()) {
          setPartners((cur) => {
            const partnerName = cur.find((p) => p.id === partner)?.name ?? "Someone";
            showNotification(partnerName, msg.content || "📎 Attachment", { tag: partner });
            return cur;
          });
        }
      },
      (updated) => {
        // UPDATE: patch the message in threads (reactions changed)
        setThreads((prev) => {
          const partner = updated.senderId === me?.id ? updated.receiverId : updated.senderId;
          const thread = prev[partner];
          if (!thread) return prev;
          return {
            ...prev,
            [partner]: thread.map((m) => m.id === updated.id ? { ...m, reactions: updated.reactions } : m),
          };
        });
      }
    );
    return unsub;
  }, [me?.id, activeId]);

  // ── Load thread on partner change ─────────────────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    // Always fetch fresh on switch (catches messages missed by realtime).
    void fetchThread(activeId).then((msgs) => {
      setThreads((prev) => ({ ...prev, [activeId]: msgs }));
      setHasMore((prev) => ({ ...prev, [activeId]: msgs.length === 80 }));
    });
    setUnread((prev) => ({ ...prev, [activeId]: 0 }));
    void markThreadRead(activeId);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling fallback (every 15s) for missed realtime events ──────────────
  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(async () => {
      const msgs = await fetchThread(activeId);
      setThreads((prev) => {
        const cur = prev[activeId] ?? [];
        if (msgs.length === cur.length && msgs.every((m, i) => m.id === cur[i]?.id)) return prev;
        return { ...prev, [activeId]: msgs };
      });
    }, 15_000);
    return () => clearInterval(id);
  }, [activeId]);

  // ── Presence subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!me || me.id === "guest" || !activeWorkspaceId) return;
    const unsub = subscribePresence(activeWorkspaceId, me.id, setOnlineIds);
    return unsub;
  }, [me?.id, activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom only when the active thread gets new messages (not when background threads update).
  const activeThreadLen = activeId ? (threads[activeId]?.length ?? 0) : 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThreadLen, activeId]);

  // ── New DM search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!newDmOpen) return;
    if (dmSearchTimer.current) clearTimeout(dmSearchTimer.current);
    if (!dmSearch.trim()) { setDmResults([]); return; }
    setDmSearching(true);
    dmSearchTimer.current = setTimeout(async () => {
      const r = await searchProfiles(dmSearch);
      setDmResults(r);
      setDmSearching(false);
    }, 300);
    return () => { if (dmSearchTimer.current) clearTimeout(dmSearchTimer.current); };
  }, [dmSearch, newDmOpen]);

  useEffect(() => {
    if (newDmOpen) {
      setDmSearch(""); setDmResults([]);
      setTimeout(() => dmSearchRef.current?.focus(), 60);
    }
  }, [newDmOpen]);

  const openDmWith = (partner: DmPartner) => {
    setNewDmOpen(false);
    setPartners((prev) => prev.some((p) => p.id === partner.id) ? prev : [partner, ...prev]);
    setActiveId(partner.id);
  };

  // ── File picker ───────────────────────────────────────────────────────────
  const ALLOWED_MIME = new Set([
    "image/jpeg","image/png","image/gif","image/webp","image/svg+xml",
    "video/mp4","video/webm","audio/mpeg","audio/ogg","audio/wav","audio/webm",
    "application/pdf","text/plain",
    "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  const MAX_FILE_MB = 10;
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`الحد الأقصى للملف ${MAX_FILE_MB} MB`);
      e.target.value = "";
      return;
    }
    if (!ALLOWED_MIME.has(f.type)) {
      toast.error("نوع الملف غير مدعوم");
      e.target.value = "";
      return;
    }
    setPendingFile(f);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPendingPreview(url);
    } else {
      setPendingPreview(null);
    }
    e.target.value = "";
  };

  const clearPendingFile = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
  };

  const handleGroupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`الحد الأقصى للملف ${MAX_FILE_MB} MB`);
      e.target.value = "";
      return;
    }
    if (!ALLOWED_MIME.has(f.type)) {
      toast.error("نوع الملف غير مدعوم");
      e.target.value = "";
      return;
    }
    setGroupPendingFile(f);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setGroupPendingPreview(url);
    } else {
      setGroupPendingPreview(null);
    }
    e.target.value = "";
  };

  const clearGroupPendingFile = () => {
    if (groupPendingPreview) URL.revokeObjectURL(groupPendingPreview);
    setGroupPendingFile(null);
    setGroupPendingPreview(null);
  };

  // ── Voice recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      toast.error(isAr ? "تعذّر الوصول للميكروفون" : "Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setRecSeconds(0);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    stopRecording();
    recChunksRef.current = [];
  };

  const sendVoiceMessage = async () => {
    if (!mediaRecorderRef.current || !activeId || !me) return;
    const mr = mediaRecorderRef.current;
    mr.onstop = async () => {
      const mimeType = mr.mimeType || "audio/webm";
      const blob = new Blob(recChunksRef.current, { type: mimeType });
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
      const voiceFile = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
      stopRecording();
      setUploading(true);
      const attachment = await uploadDmAttachment(voiceFile, me.id);
      setUploading(false);
      if (!attachment) {
        toast.error(isAr ? "فشل رفع التسجيل" : "Voice upload failed");
        return;
      }
      const optimisticId = crypto.randomUUID();
      const optimistic: DmMessage = {
        id: optimisticId,
        senderId: me.id,
        receiverId: activeId,
        content: "",
        createdAt: new Date().toISOString(),
        readAt: null,
        attachmentUrl: attachment.url,
        attachmentName: attachment.name,
        attachmentType: attachment.type,
        reactions: {},
      };
      setThreads((prev) => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), optimistic] }));
      setLastMsgs((prev) => ({ ...prev, [activeId]: optimistic }));
      try {
        const sent = await sendDm(activeId, "", attachment);
        if (sent) {
          setThreads((prev) => ({
            ...prev,
            [activeId]: (prev[activeId] ?? []).map((m) => (m.id === optimisticId ? sent : m)),
          }));
          setLastMsgs((prev) => ({ ...prev, [activeId]: sent }));
        }
      } catch {
        setFailedIds((prev) => new Set(prev).add(optimisticId));
        toast.error(isAr ? "فشل إرسال الرسالة" : "Message failed to send");
      }
    };
    mr.stop();
  };

  const sendGroupVoiceMessage = async () => {
    if (!mediaRecorderRef.current || !activeGroupId || !me) return;
    const mr = mediaRecorderRef.current;
    mr.onstop = async () => {
      const mimeType = mr.mimeType || "audio/webm";
      const blob = new Blob(recChunksRef.current, { type: mimeType });
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
      const voiceFile = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
      stopRecording();
      setGroupUploading(true);
      const attachment = await uploadDmAttachment(voiceFile, me.id);
      setGroupUploading(false);
      if (!attachment) {
        toast.error(isAr ? "فشل رفع التسجيل" : "Voice upload failed");
        return;
      }
      const optimisticId = crypto.randomUUID();
      const optimistic: GroupMessage = {
        id: optimisticId,
        groupId: activeGroupId,
        senderId: me.id,
        content: "",
        createdAt: new Date().toISOString(),
        attachmentUrl: attachment.url,
        attachmentName: attachment.name,
        attachmentType: attachment.type,
        reactions: {},
      };
      setGroupThreads((prev) => ({ ...prev, [activeGroupId]: [...(prev[activeGroupId] ?? []), optimistic] }));
      setGroupLastMsgs((prev) => ({ ...prev, [activeGroupId]: optimistic }));
      try {
        const sent = await sendGroupMessage(activeGroupId, "", attachment);
        if (sent) {
          setGroupThreads((prev) => ({
            ...prev,
            [activeGroupId]: (prev[activeGroupId] ?? []).map((m) => (m.id === optimisticId ? sent : m)),
          }));
          setGroupLastMsgs((prev) => ({ ...prev, [activeGroupId]: sent }));
        }
      } catch {
        setGroupFailedIds((prev) => new Set(prev).add(optimisticId));
        toast.error(isAr ? "فشل إرسال الرسالة" : "Message failed to send");
      }
    };
    mr.stop();
  };

  const recMmss = `${String(Math.floor(recSeconds / 60)).padStart(2, "0")}:${String(recSeconds % 60).padStart(2, "0")}`;

  // Derived — declared here so search/Jitsi helpers can use them
  const activePartner = partners.find((p) => p.id === activeId) ?? null;
  const activeThread = activeId ? (threads[activeId] ?? []) : [];

  // ── Thread search helpers ─────────────────────────────────────────────────
  const searchMatches = activeThread.reduce<number[]>((acc, msg, i) => {
    if (searchQuery.trim() && msg.content.toLowerCase().includes(searchQuery.toLowerCase())) acc.push(i);
    return acc;
  }, []);

  const scrollToMatch = (idx: number) => {
    const msgIdx = searchMatches[idx];
    if (msgIdx === undefined) return;
    const msg = activeThread[msgIdx];
    if (!msg) return;
    const el = msgRefsMap.current.get(msg.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const navigateSearch = (dir: 1 | -1) => {
    if (!searchMatches.length) return;
    const next = (searchMatchIdx + dir + searchMatches.length) % searchMatches.length;
    setSearchMatchIdx(next);
    scrollToMatch(next);
  };

  // Keep current match in view when query changes
  useEffect(() => {
    setSearchMatchIdx(0);
    if (searchMatches.length > 0) scrollToMatch(0);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => threadSearchRef.current?.focus(), 60);
    else setSearchQuery("");
  }, [searchOpen]);

  // Reset search state when thread changes
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, [activeId]);

  // Group thread search effects (helpers are defined after activeGroupThread is derived)
  useEffect(() => {
    if (groupSearchOpen) setTimeout(() => groupThreadSearchRef.current?.focus(), 60);
    else setGroupSearchQuery("");
  }, [groupSearchOpen]);

  useEffect(() => {
    setGroupSearchOpen(false);
    setGroupSearchQuery("");
  }, [activeGroupId]);

  // ── Jitsi helpers ─────────────────────────────────────────────────────────
  const jitsiRoom = activePartner && me
    ? `heed-${[me.id, activePartner.id].sort().join("-").slice(0, 32)}`
    : null;

  const openVoiceCall = () => {
    if (!jitsiRoom) return;
    window.open(`https://meet.jit.si/${jitsiRoom}`, "_blank", "noopener,noreferrer");
  };

  const openVideoCall = () => {
    if (!jitsiRoom) return;
    window.open(`https://meet.jit.si/${jitsiRoom}#config.startWithVideoMuted=false`, "_blank", "noopener,noreferrer");
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!activeId || (!text.trim() && !pendingFile) || sending || uploading || !me) return;
    setSending(true);

    // Upload attachment first if any
    let attachment: { url: string; name: string; type: string } | null = null;
    if (pendingFile) {
      setUploading(true);
      attachment = await uploadDmAttachment(pendingFile, me!.id);
      setUploading(false);
      if (!attachment) {
        toast.error(isAr ? "فشل رفع الملف" : "File upload failed");
        setSending(false);
        return;
      }
      clearPendingFile();
    }

    const optimisticId = crypto.randomUUID();
    const optimistic: DmMessage = {
      id: optimisticId,
      senderId: me!.id,
      receiverId: activeId,
      content: text.trim(),
      createdAt: new Date().toISOString(),
      readAt: null,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentType: attachment?.type ?? null,
      reactions: {},
    };
    setThreads((prev) => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), optimistic] }));
    setLastMsgs((prev) => ({ ...prev, [activeId]: optimistic }));
    setText("");

    try {
      const sent = await sendDm(activeId, optimistic.content, attachment);
      if (sent) {
        setThreads((prev) => ({
          ...prev,
          [activeId]: (prev[activeId] ?? []).map((m) => (m.id === optimisticId ? sent : m)),
        }));
        setLastMsgs((prev) => ({ ...prev, [activeId]: sent }));
      }
    } catch {
      setFailedIds((prev) => new Set(prev).add(optimisticId));
      toast.error(isAr ? "فشل إرسال الرسالة" : "Message failed to send");
    }
    setSending(false);
    inputRef.current?.focus();
  }, [activeId, text, pendingFile, sending, uploading, me, isAr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load more (pagination) ────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!activeId || loadingMore || !hasMore[activeId]) return;
    const currentThread = threads[activeId] ?? [];
    if (currentThread.length === 0) return;
    const oldest = currentThread[0].createdAt;
    setLoadingMore(true);
    try {
      const older = await fetchThread(activeId, 80, oldest);
      setThreads((prev) => {
        const existing = prev[activeId] ?? [];
        // Deduplicate by id
        const existingIds = new Set(existing.map((m) => m.id));
        const newMsgs = older.filter((m) => !existingIds.has(m.id));
        return { ...prev, [activeId]: [...newMsgs, ...existing] };
      });
      setHasMore((prev) => ({ ...prev, [activeId]: older.length === 80 }));
    } catch {
      toast.error(isAr ? "تعذّر تحميل المزيد" : "Failed to load more messages");
    } finally {
      setLoadingMore(false);
    }
  }, [activeId, loadingMore, hasMore, threads, isAr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize divider ────────────────────────────────────────────────────────
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = listWidth;
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      setListWidth(Math.max(260, Math.min(480, isAr ? startW - delta : startW + delta)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const sorted = [...partners]
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const la = lastMsgs[a.id]?.createdAt ?? "";
      const lb = lastMsgs[b.id]?.createdAt ?? "";
      if (la && lb) return lb.localeCompare(la);
      if (la) return -1; if (lb) return 1;
      return a.name.localeCompare(b.name);
    });

  // ── Contact list ──────────────────────────────────────────────────────────
  const contactList = (
    <div className="flex h-full flex-col bg-card border-e border-border/50">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-border/40">
        <h1 className="font-display text-xl font-bold tracking-tight">
          {isAr ? "الرسائل" : "Messages"}
        </h1>
        <div className="flex items-center gap-1">
          <button title={isAr ? "تصفية" : "Filter"} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground/70 transition hover:bg-secondary hover:text-foreground">
            <Filter className="h-[17px] w-[17px]" />
          </button>
          {activeTab === "dms" && (
            <button
              title={isAr ? "رسالة جديدة" : "New Message"}
              onClick={() => setNewDmOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground/70 transition hover:bg-secondary hover:text-foreground"
            >
              <Edit3 className="h-[17px] w-[17px]" />
            </button>
          )}
          {activeTab === "groups" && (
            <button
              title={isAr ? "مجموعة جديدة" : "New Group"}
              onClick={() => setNewGroupOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground/70 transition hover:bg-secondary hover:text-foreground"
            >
              <Users className="h-[17px] w-[17px]" />
            </button>
          )}
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <button
          onClick={() => setActiveTab("dms")}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
            activeTab === "dms"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/70 text-muted-foreground hover:bg-secondary"
          )}
        >
          {isAr ? "المحادثات" : "DMs"}
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
            activeTab === "groups"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/70 text-muted-foreground hover:bg-secondary"
          )}
        >
          {isAr ? "المجموعات" : "Groups"}
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-full bg-secondary/70 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "ابحث…" : "Search…"}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* DMs list */}
      {activeTab === "dms" && (
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isAr ? "اضغط ✏️ لبدء محادثة جديدة" : "Tap ✏️ to start a new chat"}
              </p>
            </div>
          ) : (
            sorted.map((p) => {
              const last = lastMsgs[p.id];
              const u = unread[p.id] ?? 0;
              const isMe = last?.senderId === me?.id;
              const isActive = activeId === p.id;
              const snippet = last?.attachmentName ? `📎 ${last.attachmentName}` : last?.content;
              return (
                <button
                  key={p.id}
                  onClick={() => { setActiveId(p.id); setActiveGroupId(null); }}
                  className={cn(
                    "relative flex w-full items-center gap-3 px-4 text-start transition-colors touch-manipulation",
                    "min-h-[64px] py-3",
                    isActive ? "bg-primary/[0.12]" : "hover:bg-secondary/50"
                  )}
                >
                  {isActive && <span className="absolute start-0 top-2 bottom-2 w-[3px] rounded-e-full bg-primary" />}
                  <div className="relative shrink-0">
                    <ContactAvatar name={p.name} avatarUrl={p.avatarUrl} />
                    {u > 0 && <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card bg-primary" />}
                    {u === 0 && onlineIds.has(p.id) && (
                      <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className={cn("flex-1 truncate text-sm", u > 0 ? "font-semibold" : "font-medium")}>{p.name}</span>
                      {last && <span className={cn("shrink-0 text-[11px] tabular-nums", u > 0 ? "font-medium text-primary" : "text-muted-foreground/50")}>{relativeTime(last.createdAt, isAr)}</span>}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      {snippet ? (
                        <p dir="auto" className={cn("flex-1 truncate text-[13px] leading-snug", u > 0 ? "font-medium text-foreground/80" : "text-muted-foreground/60")}>
                          {isMe && (last?.readAt
                            ? <CheckCheck className="inline h-3 w-3 text-primary me-0.5" />
                            : <Check className="inline h-3 w-3 text-muted-foreground/50 me-0.5" />)}
                          {snippet}
                        </p>
                      ) : (
                        <p className="flex-1 text-[12px] text-muted-foreground/40">{isAr ? "ابدأ المحادثة" : "Start chatting"}</p>
                      )}
                      {u > 0 && (
                        <span className="shrink-0 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
                          {u > 99 ? "99+" : u}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Groups list */}
      {activeTab === "groups" && (
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {groups.filter((g) =>
            g.name.toLowerCase().includes(search.toLowerCase())
          ).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isAr ? "اضغط 👥 لإنشاء مجموعة جديدة" : "Tap 👥 to create a new group"}
              </p>
            </div>
          ) : (
            groups
              .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
              .map((g) => {
                const last = groupLastMsgs[g.id];
                const isActive = activeGroupId === g.id;
                const members = groupMembers[g.id] ?? [];
                const memberCount = members.length;
                const u = groupUnread[g.id] ?? 0;
                return (
                  <button
                    key={g.id}
                    onClick={() => { setActiveGroupId(g.id); setActiveId(null); }}
                    className={cn(
                      "relative flex w-full items-center gap-3 px-4 text-start transition-colors touch-manipulation",
                      "min-h-[64px] py-3",
                      isActive ? "bg-primary/[0.12]" : "hover:bg-secondary/50"
                    )}
                  >
                    {isActive && <span className="absolute start-0 top-2 bottom-2 w-[3px] rounded-e-full bg-primary" />}
                    {/* Group avatar */}
                    <div className="relative shrink-0">
                      <div className={cn("grid h-11 w-11 place-items-center rounded-full font-bold text-white text-[13px]", avatarColor(g.name))}>
                        {initials(g.name)}
                      </div>
                      {u > 0 && <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card bg-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className={cn("flex-1 truncate text-sm", u > 0 ? "font-semibold" : "font-medium")}>{g.name}</span>
                        {last && <span className={cn("shrink-0 text-[11px] tabular-nums", u > 0 ? "font-medium text-primary" : "text-muted-foreground/50")}>{relativeTime(last.createdAt, isAr)}</span>}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-1">
                        {last ? (
                          <p dir="auto" className={cn("flex-1 truncate text-[13px] leading-snug", u > 0 ? "font-medium text-foreground/80" : "text-muted-foreground/60")}>
                            {last.content || (last.attachmentName ? `📎 ${last.attachmentName}` : "")}
                          </p>
                        ) : (
                          <p className="flex-1 text-[12px] text-muted-foreground/40">
                            {memberCount > 0
                              ? (isAr ? `${memberCount} أعضاء` : `${memberCount} members`)
                              : (isAr ? "مجموعة جديدة" : "New group")}
                          </p>
                        )}
                        {u > 0 && (
                          <span className="shrink-0 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
                            {u > 99 ? "99+" : u}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
          )}
        </div>
      )}
    </div>
  );

  // ── Thread view ───────────────────────────────────────────────────────────
  const threadView = activePartner ? (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 bg-card/80 px-4 py-3 backdrop-blur-sm">
        {isMobile && (
          <button onClick={() => setActiveId(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="relative shrink-0">
          <ContactAvatar name={activePartner.name} avatarUrl={activePartner.avatarUrl} size="sm" />
          {onlineIds.has(activePartner.id) && (
            <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight">{activePartner.name}</p>
          <p className="truncate text-[11px] text-muted-foreground/50" dir="ltr">
            {onlineIds.has(activePartner.id)
              ? (isAr ? "متصل الآن" : "online")
              : (activePartner.email || "")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* Desktop: show all 4 buttons; Mobile: show only MoreVertical */}
          {[
            { icon: Phone, label: isAr ? "مكالمة صوتية" : "Voice call", onClick: openVoiceCall, mobileHide: true },
            { icon: Video, label: isAr ? "مكالمة فيديو" : "Video call", onClick: openVideoCall, mobileHide: true },
            { icon: Search, label: isAr ? "بحث" : "Search in chat", onClick: () => setSearchOpen((o) => !o), mobileHide: true },
            { icon: MoreVertical, label: isAr ? "المزيد" : "More options", onClick: undefined, mobileHide: false },
          ].map(({ icon: Icon, label, onClick, mobileHide }) => (
            <button
              key={label}
              title={label}
              onClick={onClick}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full text-muted-foreground/70 transition hover:bg-secondary hover:text-foreground touch-manipulation",
                label === (isAr ? "بحث" : "Search in chat") && searchOpen && "bg-primary/10 text-primary",
                mobileHide && isMobile && "hidden"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>
      </div>

      {/* Thread search bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border/40 bg-card/60"
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <input
                ref={threadSearchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigateSearch(e.shiftKey ? -1 : 1);
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                placeholder={isAr ? "بحث في المحادثة…" : "Search in conversation…"}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
              />
              {searchQuery.trim() && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                  {searchMatches.length > 0 ? `${searchMatchIdx + 1} / ${searchMatches.length}` : "0 / 0"}
                </span>
              )}
              <button
                onClick={() => navigateSearch(-1)}
                disabled={!searchMatches.length}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary disabled:opacity-30"
                title="Previous"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10l4-4 4 4"/></svg>
              </button>
              <button
                onClick={() => navigateSearch(1)}
                disabled={!searchMatches.length}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary disabled:opacity-30"
                title="Next"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6l4 4 4-4"/></svg>
              </button>
              <button
                onClick={() => setSearchOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none"
        style={{ background: "repeating-linear-gradient(transparent,transparent 19px,hsl(var(--border)/0.04) 20px)" }}
      >
        <div className="mx-auto max-w-3xl space-y-0.5">
          {/* Load more button — top of thread */}
          {activeId && hasMore[activeId] && (
            <div className="flex justify-center pb-3">
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="mx-auto flex items-center gap-1 rounded-full bg-secondary px-4 py-1.5 text-xs text-muted-foreground hover:bg-secondary/80 disabled:opacity-60"
              >
                {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {isAr ? "تحميل المزيد" : "Load more"}
              </button>
            </div>
          )}

          {activeThread.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-9 w-9" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/80">
                  {isAr ? `ابدأ محادثة مع ${activePartner.name}` : `Chat with ${activePartner.name}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/50">
                  {isAr ? "رسائلك مشفرة" : "Messages are end-to-end encrypted"}
                </p>
              </div>
            </motion.div>
          )}

          {activeThread.map((msg, i) => {
            const mine = msg.senderId === me?.id;
            const prev = activeThread[i - 1];
            const next = activeThread[i + 1];
            const showDay = !prev || dayStamp(msg.createdAt, isAr) !== dayStamp(prev.createdAt, isAr);
            const isFirst = !prev || prev.senderId !== msg.senderId || showDay;
            const isLast = !next || next.senderId !== msg.senderId;
            const failed = failedIds.has(msg.id);
            const isSearchMatch = searchMatches.includes(i);
            const isCurrentSearchMatch = searchMatches[searchMatchIdx] === i;
            const reactionEntries = Object.entries(msg.reactions ?? {}).filter(([, users]) => users.length > 0);
            const isPickerOpen = hoveredMsgId === msg.id;
            return (
              <div key={msg.id} ref={(el) => { if (el) msgRefsMap.current.set(msg.id, el); else msgRefsMap.current.delete(msg.id); }}>
                {showDay && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-muted-foreground/70 shadow-sm">
                      {dayStamp(msg.createdAt, isAr)}
                    </span>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.14 }}
                  className={cn("group/msg flex", mine ? "justify-end" : "justify-start", isLast ? "mb-2" : "mb-0.5")}
                  onMouseEnter={() => !isMobile && setHoveredMsgId(msg.id)}
                  onMouseLeave={() => !isMobile && setHoveredMsgId(null)}
                >
                  {!mine && (
                    <div className={cn("me-2 mt-auto shrink-0", isLast ? "opacity-100" : "opacity-0 pointer-events-none")}>
                      <ContactAvatar name={activePartner.name} avatarUrl={activePartner.avatarUrl} size="xs" />
                    </div>
                  )}
                  <div className="relative flex flex-col">
                    <div
                      className={cn(
                        "relative max-w-[65%] px-3.5 py-2.5 text-sm shadow-sm",
                        mine
                          ? failed ? "bg-destructive/80 text-white" : "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border/40",
                        mine && isFirst ? "rounded-2xl rounded-ee-sm"
                          : mine ? "rounded-2xl rounded-e-sm"
                          : !mine && isFirst ? "rounded-2xl rounded-ss-sm"
                          : "rounded-2xl rounded-s-sm",
                        isSearchMatch && !isCurrentSearchMatch && "ring-1 ring-yellow-400/60",
                        isCurrentSearchMatch && "ring-2 ring-yellow-400"
                      )}
                      dir="auto"
                      onTouchStart={() => {
                        longPressTimer.current = setTimeout(() => setHoveredMsgId(msg.id), 500);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimer.current) clearTimeout(longPressTimer.current);
                      }}
                      onTouchMove={() => {
                        if (longPressTimer.current) clearTimeout(longPressTimer.current);
                      }}
                    >
                      {/* Reaction quick-pick */}
                      <AnimatePresence>
                        {isPickerOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.85, y: 4 }}
                            transition={{ duration: 0.12 }}
                            className={cn(
                              "absolute -top-10 z-20 flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-1 shadow-xl",
                              mine ? "end-0" : "start-0"
                            )}
                          >
                            {["❤️","😂","👍","😮","😢","🙏"].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  setHoveredMsgId(null);
                                  // Optimistic local toggle
                                  setThreads((prev) => {
                                    const thread = prev[activeId!] ?? [];
                                    return {
                                      ...prev,
                                      [activeId!]: thread.map((m) => {
                                        if (m.id !== msg.id) return m;
                                        const current = m.reactions ?? {};
                                        const users = current[emoji] ?? [];
                                        const newUsers = users.includes(me!.id)
                                          ? users.filter((id) => id !== me!.id)
                                          : [...users, me!.id];
                                        const newReactions = { ...current };
                                        if (newUsers.length === 0) delete newReactions[emoji];
                                        else newReactions[emoji] = newUsers;
                                        return { ...m, reactions: newReactions };
                                      }),
                                    };
                                  });
                                  void toggleReaction(msg.id, emoji);
                                }}
                                className="text-lg transition hover:scale-125 active:scale-90 touch-manipulation"
                              >
                                {emoji}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Attachment */}
                      {msg.attachmentUrl && (
                        msg.attachmentType?.startsWith("audio/") ? (
                          <audio controls src={msg.attachmentUrl} className="w-full max-w-xs mt-1 mb-1" />
                        ) : isImageType(msg.attachmentType) ? (
                          <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="block mb-2">
                            <img
                              src={msg.attachmentUrl}
                              alt={msg.attachmentName ?? "image"}
                              className="max-h-56 w-full rounded-lg object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:opacity-80",
                              mine ? "bg-white/20" : "bg-secondary"
                            )}
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">{msg.attachmentName ?? "file"}</span>
                          </a>
                        )
                      )}

                      {/* Text */}
                      {msg.content && (
                        <p className="whitespace-pre-wrap leading-[1.45]">
                          {searchQuery.trim() ? highlightText(msg.content, searchQuery) : msg.content}
                        </p>
                      )}

                      {/* Time + tick */}
                      <div className={cn("mt-1 flex items-center justify-end gap-1", mine ? "text-primary-foreground/60" : "text-muted-foreground/50")}>
                        {failed && <AlertCircle className="h-3 w-3 text-white" />}
                        <span className="text-[10px] tabular-nums">{hhmm(msg.createdAt)}</span>
                        <MsgTick msg={msg} isMine={mine} />
                      </div>
                    </div>

                    {/* Reaction pills */}
                    {reactionEntries.length > 0 && (
                      <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
                        {reactionEntries.map(([emoji, users]) => {
                          const iReacted = users.includes(me?.id ?? "");
                          return (
                            <button
                              key={emoji}
                              onClick={() => {
                                setThreads((prev) => {
                                  const thread = prev[activeId!] ?? [];
                                  return {
                                    ...prev,
                                    [activeId!]: thread.map((m) => {
                                      if (m.id !== msg.id) return m;
                                      const current = m.reactions ?? {};
                                      const currentUsers = current[emoji] ?? [];
                                      const newUsers = currentUsers.includes(me!.id)
                                        ? currentUsers.filter((id) => id !== me!.id)
                                        : [...currentUsers, me!.id];
                                      const newReactions = { ...current };
                                      if (newUsers.length === 0) delete newReactions[emoji];
                                      else newReactions[emoji] = newUsers;
                                      return { ...m, reactions: newReactions };
                                    }),
                                  };
                                });
                                void toggleReaction(msg.id, emoji);
                              }}
                              className={cn(
                                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition touch-manipulation",
                                iReacted
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border/50 bg-card text-foreground/70 hover:border-primary/30"
                              )}
                            >
                              <span>{emoji}</span>
                              <span className="tabular-nums">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Pending file preview */}
      <AnimatePresence>
        {pendingFile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/40 bg-card/60 px-4 py-2 overflow-hidden"
          >
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              {pendingPreview ? (
                <img src={pendingPreview} alt="preview" className="h-12 w-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pendingFile.name}</p>
                <p className="text-xs text-muted-foreground/60">{(pendingFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={clearPendingFile} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="border-t border-border/40 bg-card/80 px-3 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          {/* Recording UI */}
          <AnimatePresence mode="wait">
            {recording ? (
              <motion.div
                key="recording"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-1 items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5"
              >
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                </span>
                <span className="flex-1 text-sm font-medium text-rose-500">{recMmss}</span>
                <button
                  onClick={cancelRecording}
                  className="text-xs text-muted-foreground/70 transition hover:text-foreground"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={() => void sendVoiceMessage()}
                  disabled={uploading}
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90",
                    uploading && "opacity-50"
                  )}
                >
                  {uploading
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <ArrowUp className="h-5 w-5" />}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="composer"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-1 items-end gap-2"
              >
                {/* Emoji picker */}
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button title={isAr ? "إيموجي" : "Emoji"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground">
                      <Smile className="h-5 w-5" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      side="top" align="center" sideOffset={8}
                      avoidCollisions
                      className="z-50 rounded-2xl border border-border/60 bg-card p-2 shadow-2xl"
                    >
                      {EMOJI_ROWS.map((row, ri) => (
                        <div key={ri} className="flex">
                          {row.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setText((t) => t + emoji)}
                              className="h-9 w-9 rounded-lg text-xl transition hover:bg-secondary active:scale-90"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>

                {/* File attach */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,text/plain,application/zip,video/mp4"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  title={isAr ? "إرفاق ملف" : "Attach file"}
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground"
                >
                  {pendingFile
                    ? <ImageIcon className="h-5 w-5 text-primary" />
                    : <Paperclip className="h-5 w-5" />}
                </button>

                {/* Text input */}
                <div className="flex-1 min-w-0 rounded-2xl border border-border/50 bg-secondary/40 px-4 py-2.5 focus-within:border-primary/40 transition-colors">
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    rows={1}
                    dir="auto"
                    placeholder={isAr ? "اكتب رسالة" : "Type a message"}
                    style={{ maxHeight: 140, fontSize: "16px" }}
                    className="w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/40 leading-relaxed"
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                    }}
                  />
                </div>

                {/* Send / Mic */}
                <button
                  onClick={() => {
                    if (text.trim() || pendingFile) {
                      void handleSend();
                    } else {
                      void startRecording();
                    }
                  }}
                  disabled={sending || uploading}
                  title={text.trim() || pendingFile ? (isAr ? "إرسال" : "Send") : (isAr ? "رسالة صوتية" : "Voice message")}
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-150",
                    text.trim() || pendingFile
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90"
                      : "bg-secondary text-muted-foreground/70 hover:bg-secondary/80",
                    (sending || uploading) && "opacity-50"
                  )}
                >
                  {uploading
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : text.trim() || pendingFile
                      ? <ArrowUp className="h-5 w-5" />
                      : <Mic className="h-5 w-5" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-5 bg-background/30 text-center px-8">
      <div className="grid h-28 w-28 place-items-center rounded-full border-[3px] border-primary/20 bg-primary/10 text-primary">
        <MessageSquare className="h-12 w-12" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold">Heed DMs</h2>
        <p className="mt-2 text-sm text-muted-foreground/60 max-w-xs leading-relaxed">
          {isAr ? "اختر محادثة أو اضغط ✏️ لبدء واحدة جديدة" : "Select a conversation or tap ✏️ to start a new one"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground/40">
        {isAr ? "رسائلك مشفرة" : "End-to-end encrypted"}
      </p>
    </div>
  );

  // ── New DM Modal ──────────────────────────────────────────────────────────
  const newDmModal = (
    <AnimatePresence>
      {newDmOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh] backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setNewDmOpen(false); }}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                <Edit3 className="h-4 w-4" />
              </div>
              <h2 className="flex-1 font-display text-[15px] font-semibold">
                {isAr ? "رسالة جديدة" : "New Message"}
              </h2>
              <button onClick={() => setNewDmOpen(false)} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-border/40 px-4 py-3">
              <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                <input
                  ref={dmSearchRef}
                  value={dmSearch}
                  onChange={(e) => setDmSearch(e.target.value)}
                  placeholder={isAr ? "ابحث بالاسم أو الإيميل…" : "Search by name or email…"}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                />
                {dmSearching && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto scrollbar-none">
              {!dmSearch.trim() ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground/50">
                  {isAr ? "اكتب اسم أو إيميل للبحث" : "Type a name or email to search"}
                </p>
              ) : dmResults.length === 0 && !dmSearching ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground/50">
                  {isAr ? "مفيش نتايج" : "No results found"}
                </p>
              ) : (
                dmResults.map((p) => (
                  <button key={p.id} onClick={() => openDmWith(p)} className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-secondary/60">
                    <ContactAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      {p.email && <p className="truncate text-xs text-muted-foreground/60" dir="ltr">{p.email}</p>}
                    </div>
                    <MessageSquare className="h-4 w-4 shrink-0 text-primary/50" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Group thread view ─────────────────────────────────────────────────────
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const activeGroupThread = activeGroupId ? (groupThreads[activeGroupId] ?? []) : [];
  const activeGroupMemberList = activeGroupId ? (groupMembers[activeGroupId] ?? []) : [];

  // ── Group search computed values (needs activeGroupThread) ────────────────
  const groupSearchMatches = activeGroupThread.reduce<number[]>((acc, msg, i) => {
    if (groupSearchQuery.trim() && msg.content.toLowerCase().includes(groupSearchQuery.toLowerCase())) acc.push(i);
    return acc;
  }, []);

  const scrollToGroupMatch = (idx: number) => {
    const msgIdx = groupSearchMatches[idx];
    if (msgIdx === undefined) return;
    const msg = activeGroupThread[msgIdx];
    if (!msg) return;
    const el = groupMsgRefsMap.current.get(msg.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const navigateGroupSearch = (dir: 1 | -1) => {
    if (!groupSearchMatches.length) return;
    const next = (groupSearchMatchIdx + dir + groupSearchMatches.length) % groupSearchMatches.length;
    setGroupSearchMatchIdx(next);
    scrollToGroupMatch(next);
  };

  // Keep first group search match in view when query changes
  // NOTE: this effect is declared after groupSearchMatches/scrollToGroupMatch
  // which is fine since hooks must not be called conditionally but CAN be called
  // after non-hook code in the same render scope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    setGroupSearchMatchIdx(0);
    if (groupSearchMatches.length > 0) scrollToGroupMatch(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSearchQuery]);

  const groupThreadView = activeGroup ? (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 bg-card/80 px-4 py-3 backdrop-blur-sm">
        {isMobile && (
          <button
            onClick={() => setActiveGroupId(null)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className={cn("shrink-0 grid h-9 w-9 place-items-center rounded-full font-bold text-white text-[11px]", avatarColor(activeGroup.name))}>
          {initials(activeGroup.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight">{activeGroup.name}</p>
          <p className="truncate text-[11px] text-muted-foreground/50">
            {activeGroupMemberList.length > 0
              ? activeGroupMemberList.map((m) => m.name).join(", ")
              : (isAr ? "جاري تحميل الأعضاء…" : "Loading members…")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            title={isAr ? "بحث" : "Search in group"}
            onClick={() => setGroupSearchOpen((o) => !o)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full text-muted-foreground/70 transition hover:bg-secondary hover:text-foreground touch-manipulation",
              groupSearchOpen && "bg-primary/10 text-primary"
            )}
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <button
            title={isAr ? "المزيد" : "More options"}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground/70 transition hover:bg-secondary hover:text-foreground touch-manipulation"
          >
            <MoreVertical className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Group thread search bar */}
      <AnimatePresence>
        {groupSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border/40 bg-card/60"
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <input
                ref={groupThreadSearchRef}
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigateGroupSearch(e.shiftKey ? -1 : 1);
                  if (e.key === "Escape") setGroupSearchOpen(false);
                }}
                placeholder={isAr ? "بحث في المجموعة…" : "Search in group…"}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
              />
              {groupSearchQuery.trim() && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                  {groupSearchMatches.length > 0 ? `${groupSearchMatchIdx + 1} / ${groupSearchMatches.length}` : "0 / 0"}
                </span>
              )}
              <button
                onClick={() => navigateGroupSearch(-1)}
                disabled={!groupSearchMatches.length}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary disabled:opacity-30"
                title="Previous"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10l4-4 4 4"/></svg>
              </button>
              <button
                onClick={() => navigateGroupSearch(1)}
                disabled={!groupSearchMatches.length}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary disabled:opacity-30"
                title="Next"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6l4 4 4-4"/></svg>
              </button>
              <button
                onClick={() => setGroupSearchOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none"
        style={{ background: "repeating-linear-gradient(transparent,transparent 19px,hsl(var(--border)/0.04) 20px)" }}
      >
        <div className="mx-auto max-w-3xl space-y-0.5">
          {activeGroupThread.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="h-9 w-9" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/80">
                  {isAr ? `مرحباً في ${activeGroup.name}` : `Welcome to ${activeGroup.name}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/50">
                  {isAr ? "ابدأ المحادثة الجماعية" : "Start the group conversation"}
                </p>
              </div>
            </motion.div>
          )}

          {activeGroupThread.map((msg, i) => {
            const mine = msg.senderId === me?.id;
            const prev = activeGroupThread[i - 1];
            const showDay = !prev || dayStamp(msg.createdAt, isAr) !== dayStamp(prev.createdAt, isAr);
            const isFirst = !prev || prev.senderId !== msg.senderId || showDay;
            const isLast = !activeGroupThread[i + 1] || activeGroupThread[i + 1].senderId !== msg.senderId;
            const failed = groupFailedIds.has(msg.id);
            const reactionEntries = Object.entries(msg.reactions ?? {}).filter(([, users]) => users.length > 0);
            const senderProfile = activeGroupMemberList.find((m) => m.id === msg.senderId);
            const senderName = senderProfile?.name ?? msg.senderId.slice(0, 8);
            const isGroupSearchMatch = groupSearchMatches.includes(i);
            const isCurrentGroupSearchMatch = groupSearchMatches[groupSearchMatchIdx] === i;

            return (
              <div key={msg.id} ref={(el) => { if (el) groupMsgRefsMap.current.set(msg.id, el); else groupMsgRefsMap.current.delete(msg.id); }}>
                {showDay && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-muted-foreground/70 shadow-sm">
                      {dayStamp(msg.createdAt, isAr)}
                    </span>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.14 }}
                  className={cn("group/msg flex", mine ? "justify-end" : "justify-start", isLast ? "mb-2" : "mb-0.5")}
                >
                  {!mine && (
                    <div className={cn("me-2 mt-auto shrink-0", isLast ? "opacity-100" : "opacity-0 pointer-events-none")}>
                      <ContactAvatar name={senderName} avatarUrl={senderProfile?.avatarUrl} size="xs" />
                    </div>
                  )}
                  <div className="relative flex flex-col">
                    {/* Sender name (only for incoming, first bubble in a run) */}
                    {!mine && isFirst && (
                      <p className="mb-0.5 ms-1 text-[11px] font-medium text-primary/80">{senderName}</p>
                    )}
                    <div
                      className={cn(
                        "relative max-w-[65%] px-3.5 py-2.5 text-sm shadow-sm",
                        mine
                          ? failed ? "bg-destructive/80 text-white" : "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border/40",
                        mine && isFirst ? "rounded-2xl rounded-ee-sm"
                          : mine ? "rounded-2xl rounded-e-sm"
                          : !mine && isFirst ? "rounded-2xl rounded-ss-sm"
                          : "rounded-2xl rounded-s-sm",
                        isGroupSearchMatch && !isCurrentGroupSearchMatch && "ring-1 ring-yellow-400/60",
                        isCurrentGroupSearchMatch && "ring-2 ring-yellow-400"
                      )}
                      dir="auto"
                    >
                      {/* Attachment */}
                      {msg.attachmentUrl && (
                        msg.attachmentType?.startsWith("audio/") ? (
                          <audio controls src={msg.attachmentUrl} className="w-full max-w-xs mt-1 mb-1" />
                        ) : msg.attachmentType && msg.attachmentType.startsWith("image/") ? (
                          <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="block mb-2">
                            <img
                              src={msg.attachmentUrl}
                              alt={msg.attachmentName ?? "image"}
                              className="max-h-56 w-full rounded-lg object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:opacity-80",
                              mine ? "bg-white/20" : "bg-secondary"
                            )}
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">{msg.attachmentName ?? "file"}</span>
                          </a>
                        )
                      )}

                      {/* Text */}
                      {msg.content && (
                        <p className="whitespace-pre-wrap leading-[1.45]">
                          {groupSearchQuery.trim() ? highlightText(msg.content, groupSearchQuery) : msg.content}
                        </p>
                      )}

                      {/* Time */}
                      <div className={cn("mt-1 flex items-center justify-end gap-1", mine ? "text-primary-foreground/60" : "text-muted-foreground/50")}>
                        {failed && <AlertCircle className="h-3 w-3 text-white" />}
                        <span className="text-[10px] tabular-nums">{hhmm(msg.createdAt)}</span>
                      </div>
                    </div>

                    {/* Reaction pills */}
                    {reactionEntries.length > 0 && (
                      <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
                        {reactionEntries.map(([emoji, users]) => {
                          const iReacted = users.includes(me?.id ?? "");
                          return (
                            <button
                              key={emoji}
                              onClick={() => {
                                // Optimistic update
                                setGroupThreads((prev) => {
                                  const thread = prev[activeGroupId!] ?? [];
                                  return {
                                    ...prev,
                                    [activeGroupId!]: thread.map((m) => {
                                      if (m.id !== msg.id) return m;
                                      const current = m.reactions ?? {};
                                      const currentUsers = current[emoji] ?? [];
                                      const newUsers = currentUsers.includes(me!.id)
                                        ? currentUsers.filter((id) => id !== me!.id)
                                        : [...currentUsers, me!.id];
                                      const newReactions = { ...current };
                                      if (newUsers.length === 0) delete newReactions[emoji];
                                      else newReactions[emoji] = newUsers;
                                      return { ...m, reactions: newReactions };
                                    }),
                                  };
                                });
                                void toggleGroupReaction(msg.id, emoji);
                              }}
                              className={cn(
                                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition touch-manipulation",
                                iReacted
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border/50 bg-card text-foreground/70 hover:border-primary/30"
                              )}
                            >
                              <span>{emoji}</span>
                              <span className="tabular-nums">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })}
          <div ref={groupBottomRef} />
        </div>
      </div>

      {/* Group pending file preview */}
      <AnimatePresence>
        {groupPendingFile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/40 bg-card/60 px-4 py-2 overflow-hidden"
          >
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              {groupPendingPreview ? (
                <img src={groupPendingPreview} alt="preview" className="h-12 w-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{groupPendingFile.name}</p>
                <p className="text-xs text-muted-foreground/60">{(groupPendingFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={clearGroupPendingFile} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Composer */}
      <div className="border-t border-border/40 bg-card/80 px-3 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <AnimatePresence mode="wait">
            {recording ? (
              <motion.div
                key="group-recording"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-1 items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5"
              >
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                </span>
                <span className="flex-1 text-sm font-medium text-rose-500">{recMmss}</span>
                <button
                  onClick={cancelRecording}
                  className="text-xs text-muted-foreground/70 transition hover:text-foreground"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={() => void sendGroupVoiceMessage()}
                  disabled={groupUploading}
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90",
                    groupUploading && "opacity-50"
                  )}
                >
                  {groupUploading
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <ArrowUp className="h-5 w-5" />}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="group-composer"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-1 items-end gap-2"
              >
                {/* Emoji picker */}
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button title={isAr ? "إيموجي" : "Emoji"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground">
                      <Smile className="h-5 w-5" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content side="top" align="center" sideOffset={8} avoidCollisions className="z-50 rounded-2xl border border-border/60 bg-card p-2 shadow-2xl">
                      {EMOJI_ROWS.map((row, ri) => (
                        <div key={ri} className="flex">
                          {row.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setGroupText((t) => t + emoji)}
                              className="h-9 w-9 rounded-lg text-xl transition hover:bg-secondary active:scale-90"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>

                {/* File attach */}
                <input
                  ref={groupFileInputRef}
                  type="file"
                  accept="image/*,application/pdf,text/plain,application/zip,video/mp4"
                  className="hidden"
                  onChange={handleGroupFileChange}
                />
                <button
                  title={isAr ? "إرفاق ملف" : "Attach file"}
                  onClick={() => groupFileInputRef.current?.click()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground"
                >
                  {groupPendingFile
                    ? <ImageIcon className="h-5 w-5 text-primary" />
                    : <Paperclip className="h-5 w-5" />}
                </button>

                <div className="flex-1 min-w-0 rounded-2xl border border-border/50 bg-secondary/40 px-4 py-2.5 focus-within:border-primary/40 transition-colors">
                  <textarea
                    ref={groupInputRef}
                    value={groupText}
                    onChange={(e) => setGroupText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void handleGroupSend();
                      }
                    }}
                    rows={1}
                    dir="auto"
                    placeholder={isAr ? "اكتب رسالة للمجموعة" : "Message the group"}
                    style={{ maxHeight: 140, fontSize: "16px" }}
                    className="w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/40 leading-relaxed"
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                    }}
                  />
                </div>

                {/* Send / Mic */}
                <button
                  onClick={() => {
                    if (groupText.trim() || groupPendingFile) {
                      void handleGroupSend();
                    } else {
                      void startRecording();
                    }
                  }}
                  disabled={groupSending || groupUploading}
                  title={groupText.trim() || groupPendingFile ? (isAr ? "إرسال" : "Send") : (isAr ? "رسالة صوتية" : "Voice message")}
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-150",
                    groupText.trim() || groupPendingFile
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90"
                      : "bg-secondary text-muted-foreground/70 hover:bg-secondary/80",
                    (groupSending || groupUploading) && "opacity-50"
                  )}
                >
                  {groupUploading
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : groupText.trim() || groupPendingFile
                      ? <ArrowUp className="h-5 w-5" />
                      : <Mic className="h-5 w-5" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-5 bg-background/30 text-center px-8">
      <div className="grid h-28 w-28 place-items-center rounded-full border-[3px] border-primary/20 bg-primary/10 text-primary">
        <Users className="h-12 w-12" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold">{isAr ? "المجموعات" : "Group Chats"}</h2>
        <p className="mt-2 text-sm text-muted-foreground/60 max-w-xs leading-relaxed">
          {isAr ? "اختر مجموعة أو اضغط 👥 لإنشاء واحدة جديدة" : "Select a group or tap 👥 to create a new one"}
        </p>
      </div>
    </div>
  );

  // ── New Group Modal ───────────────────────────────────────────────────────
  const newGroupModal = (
    <AnimatePresence>
      {newGroupOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh] backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setNewGroupOpen(false); }}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <h2 className="flex-1 font-display text-[15px] font-semibold">
                {isAr ? "مجموعة جديدة" : "New Group"}
              </h2>
              <button onClick={() => setNewGroupOpen(false)} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Group name input */}
            <div className="border-b border-border/40 px-4 py-3">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={isAr ? "اسم المجموعة…" : "Group name…"}
                className="w-full rounded-xl bg-secondary/60 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/40"
              />
            </div>

            {/* Member search */}
            <div className="border-b border-border/40 px-4 py-3">
              <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                <input
                  ref={groupMemberSearchRef}
                  value={groupMemberSearch}
                  onChange={(e) => setGroupMemberSearch(e.target.value)}
                  placeholder={isAr ? "ابحث لإضافة أعضاء…" : "Search to add members…"}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                />
                {groupMemberSearching && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />}
              </div>
            </div>

            {/* Selected members chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-border/40">
                {selectedMembers.map((m) => (
                  <span key={m.id} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {m.name}
                    <button
                      onClick={() => setSelectedMembers((prev) => prev.filter((x) => x.id !== m.id))}
                      className="ml-0.5 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search results */}
            <div className="max-h-48 overflow-y-auto scrollbar-none">
              {!groupMemberSearch.trim() ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground/50">
                  {isAr ? "اكتب اسم أو إيميل للبحث" : "Type a name or email to search"}
                </p>
              ) : groupMemberResults.length === 0 && !groupMemberSearching ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground/50">
                  {isAr ? "مفيش نتايج" : "No results found"}
                </p>
              ) : (
                groupMemberResults.map((p) => {
                  const alreadySelected = selectedMembers.some((m) => m.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (!alreadySelected) setSelectedMembers((prev) => [...prev, p]);
                        setGroupMemberSearch("");
                        setGroupMemberResults([]);
                      }}
                      disabled={alreadySelected}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-secondary/60",
                        alreadySelected && "opacity-50"
                      )}
                    >
                      <ContactAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        {p.email && <p className="truncate text-xs text-muted-foreground/60" dir="ltr">{p.email}</p>}
                      </div>
                      {alreadySelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Create button */}
            <div className="border-t border-border/40 px-4 py-3">
              <button
                onClick={() => void handleCreateGroup()}
                disabled={!groupName.trim() || selectedMembers.length === 0 || creatingGroup}
                className={cn(
                  "w-full rounded-xl py-2.5 text-sm font-semibold transition",
                  groupName.trim() && selectedMembers.length > 0
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-secondary text-muted-foreground/50 cursor-not-allowed"
                )}
              >
                {creatingGroup
                  ? (isAr ? "جاري الإنشاء…" : "Creating…")
                  : (isAr ? "إنشاء المجموعة" : "Create Group")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {newDmModal}
      {newGroupModal}
      <div className="flex h-full overflow-hidden">
        {isMobile ? (
          activeGroupId
            ? <>{groupThreadView}</>
            : activeId
              ? threadView
              : <div className="w-full">{contactList}</div>
        ) : (
          <>
            <div style={{ width: listWidth }} className="shrink-0 overflow-hidden">{contactList}</div>
            <div
              onPointerDown={startResize}
              title={isAr ? "اسحب لتغيير العرض" : "Drag to resize"}
              className="group relative w-1.5 shrink-0 cursor-col-resize select-none"
            >
              <div className="absolute inset-y-0 start-0 w-px bg-border/50 transition-colors group-hover:bg-primary/50" />
            </div>
            {activeTab === "groups" ? groupThreadView : threadView}
          </>
        )}
      </div>
    </>
  );
}
