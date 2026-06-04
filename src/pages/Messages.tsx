import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowUp, MessageSquare, Search } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useIsMobile } from "../hooks/useIsMobile";
import { cn } from "../lib/utils";
import {
  fetchDmPartners, fetchThread, fetchLastMessages, fetchUnreadCounts,
  sendDm, markThreadRead, subscribeDms,
  type DmMessage, type DmPartner,
} from "../lib/dmSync";

// =========================================================================
// Heed Messages — WhatsApp-style DM chat between workspace members.
// Two-pane layout: contact list (left) + thread (right).
// =========================================================================

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dayStamp(iso: string, isAr: boolean) {
  const d = new Date(iso);
  const today = new Date(new Date().toDateString());
  const diff = Math.round((new Date(d.toDateString()).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return isAr ? "اليوم" : "Today";
  if (diff === -1) return isAr ? "أمس" : "Yesterday";
  return d.toLocaleDateString(isAr ? "ar" : "en", { day: "numeric", month: "short" });
}
function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

export default function Messages() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const isMobile = useIsMobile();
  const me = useAuthStore((s) => s.user);

  const [partners, setPartners] = useState<DmPartner[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, DmMessage[]>>({});
  const [lastMsgs, setLastMsgs] = useState<Record<string, DmMessage>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [listWidth, setListWidth] = useState(300);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initial load.
  useEffect(() => {
    void (async () => {
      const [p, l, u] = await Promise.all([fetchDmPartners(), fetchLastMessages(), fetchUnreadCounts()]);
      setPartners(p);
      setLastMsgs(l);
      setUnread(u);
    })();
  }, []);

  // Realtime incoming messages.
  useEffect(() => {
    const unsub = subscribeDms((msg) => {
      const partner = msg.senderId === me?.id ? msg.receiverId : msg.senderId;
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
    });
    return unsub;
  }, [me?.id, activeId]);

  // Load thread when switching partners.
  useEffect(() => {
    if (!activeId) return;
    if (!threads[activeId]) {
      void fetchThread(activeId).then((msgs) => setThreads((prev) => ({ ...prev, [activeId]: msgs })));
    }
    setUnread((prev) => ({ ...prev, [activeId]: 0 }));
    void markThreadRead(activeId);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threads, activeId]);

  const handleSend = useCallback(async () => {
    if (!activeId || !text.trim() || sending) return;
    setSending(true);
    const optimistic: DmMessage = {
      id: crypto.randomUUID(),
      senderId: me!.id,
      receiverId: activeId,
      content: text.trim(),
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setThreads((prev) => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), optimistic] }));
    setLastMsgs((prev) => ({ ...prev, [activeId]: optimistic }));
    setText("");
    const sent = await sendDm(activeId, optimistic.content);
    if (sent) {
      setThreads((prev) => ({
        ...prev,
        [activeId]: (prev[activeId] ?? []).map((m) => (m.id === optimistic.id ? sent : m)),
      }));
      setLastMsgs((prev) => ({ ...prev, [activeId]: sent }));
    }
    setSending(false);
    inputRef.current?.focus();
  }, [activeId, text, sending, me]);

  // Resize divider.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = listWidth;
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      setListWidth(Math.max(240, Math.min(420, isAr ? startW - delta : startW + delta)));
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); document.body.style.userSelect = ""; };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const activePartner = partners.find((p) => p.id === activeId) ?? null;
  const activeThread = activeId ? (threads[activeId] ?? []) : [];

  // Sort contacts: those with messages first (by last message time), then the rest.
  const sorted = [...partners]
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const la = lastMsgs[a.id]?.createdAt ?? "";
      const lb = lastMsgs[b.id]?.createdAt ?? "";
      if (la && lb) return lb.localeCompare(la);
      if (la) return -1;
      if (lb) return 1;
      return a.name.localeCompare(b.name);
    });

  const contactList = (
    <div className="flex h-full flex-col border-e border-border/60 bg-card">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-semibold">{isAr ? "الرسائل" : "Messages"}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "ابحث عن شخص…" : "Search…"}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {sorted.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {isAr ? "مفيش أعضاء في مساحات العمل بعد" : "No workspace members yet"}
          </p>
        ) : (
          sorted.map((p) => {
            const last = lastMsgs[p.id];
            const u = unread[p.id] ?? 0;
            const isMe = last?.senderId === me?.id;
            return (
              <button
                key={p.id}
                onClick={() => { setActiveId(p.id); if (isMobile) {} }}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border/20 px-4 py-3 text-start transition",
                  activeId === p.id ? "bg-primary/10" : "hover:bg-secondary/40",
                  u > 0 && activeId !== p.id && "bg-primary/[0.04]"
                )}
              >
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={cn("flex-1 truncate text-sm font-medium", u > 0 && "text-foreground")}>{p.name}</span>
                    {last && <span className="shrink-0 font-micro text-[10px] text-muted-foreground/60">{hhmm(last.createdAt)}</span>}
                  </div>
                  {last ? (
                    <p dir="auto" className={cn("mt-0.5 truncate text-xs", u > 0 ? "font-medium text-foreground/80" : "text-muted-foreground")}>
                      {isMe ? (isAr ? "أنت: " : "You: ") : ""}{last.content}
                    </p>
                  ) : (
                    <p className="mt-0.5 font-micro text-[11px] text-muted-foreground/40" dir="ltr">{p.email}</p>
                  )}
                </div>
                {u > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 font-micro text-[10px] font-bold text-white">
                    {u > 99 ? "99+" : u}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const threadView = activePartner ? (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <Avatar name={activePartner.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{activePartner.name}</p>
          <p className="truncate font-micro text-[11px] text-muted-foreground/60" dir="ltr">{activePartner.email}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none">
        <div className="mx-auto max-w-2xl space-y-1">
          {activeThread.length === 0 && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 text-center text-sm text-muted-foreground"
            >
              {isAr ? `ابدأ محادثة مع ${activePartner.name}` : `Start a conversation with ${activePartner.name}`}
            </motion.p>
          )}

          {activeThread.map((msg, i) => {
            const mine = msg.senderId === me?.id;
            const prev = activeThread[i - 1];
            const showDay = !prev || dayStamp(msg.createdAt, isAr) !== dayStamp(prev.createdAt, isAr);
            return (
              <div key={msg.id}>
                {showDay && (
                  <div className="my-3 flex items-center gap-2">
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="shrink-0 font-micro text-[10px] text-muted-foreground/50">{dayStamp(msg.createdAt, isAr)}</span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                )}
                <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                      mine
                        ? "rounded-ee-md bg-primary text-primary-foreground"
                        : "rounded-es-md bg-secondary text-foreground"
                    )}
                    dir="auto"
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <p className={cn("mt-0.5 text-end font-micro text-[9px]", mine ? "text-primary-foreground/60" : "text-muted-foreground/50")}>
                      {hhmm(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/60 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border/60 bg-card/60 p-2 focus-within:border-primary/40">
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
            placeholder={isAr ? "اكتب رسالة…" : "Type a message…"}
            style={{ maxHeight: 120 }}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!text.trim() || sending}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition",
              text.trim() ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-secondary text-muted-foreground/40"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-primary">
        <MessageSquare className="h-9 w-9" />
      </div>
      <p className="text-sm text-muted-foreground">
        {isAr ? "اختر شخصاً لبدء المحادثة" : "Select someone to start chatting"}
      </p>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {isMobile ? (
        activeId ? threadView : <div className="w-full">{contactList}</div>
      ) : (
        <>
          <div style={{ width: listWidth }} className="shrink-0 overflow-hidden">
            {contactList}
          </div>
          <div
            onPointerDown={startResize}
            title={isAr ? "اسحب لتغيير العرض" : "Drag to resize"}
            className="group relative w-1.5 shrink-0 cursor-col-resize"
          >
            <div className="absolute inset-y-0 start-0 w-px bg-border/60 transition-colors group-hover:bg-primary/50" />
          </div>
          {threadView}
        </>
      )}
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-[12px]";
  return (
    <div className={cn("shrink-0 grid place-items-center rounded-full bg-primary/20 font-bold text-primary", sz)}>
      {initials(name)}
    </div>
  );
}
