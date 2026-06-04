import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, RefreshCw, FileText, Sparkles, Pencil, X, ArrowUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { Markdown } from "./Markdown";
import type { ChatAssistant, ChatMsg, Conversation } from "../../stores/chatStore";
import { useChatStore } from "../../stores/chatStore";
import { regenerate, sendChat } from "../../lib/chatActions";

// =========================================================================
// Message thread — the scrolling list of bubbles. Empty state shows the
// assistant's intro + conversation starters (ChatGPT-style).
// =========================================================================

export function MessageThread({
  conversation,
  assistant,
  onStarter,
}: {
  conversation: Conversation;
  assistant: ChatAssistant;
  onStarter: (text: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgs = conversation.messages;

  // Stick to bottom as new tokens stream in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs.length, msgs[msgs.length - 1]?.content]);

  if (msgs.length === 0) {
    return <EmptyState assistant={assistant} onStarter={onStarter} />;
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        {msgs.map((m, i) => (
          <Bubble
            key={m.id}
            msg={m}
            isLast={i === msgs.length - 1}
            convId={conversation.id}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  assistant,
  onStarter,
}: {
  assistant: ChatAssistant;
  onStarter: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold">{assistant.name}</h2>
      {assistant.description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{assistant.description}</p>
      )}
      {assistant.starters.length > 0 && (
        <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
          {assistant.starters.slice(0, 4).map((s, i) => (
            <button
              key={i}
              dir="auto"
              onClick={() => onStarter(s)}
              className="rounded-xl border border-border/60 bg-card/40 px-3 py-2.5 text-start text-sm text-foreground/80 transition hover:border-primary/40 hover:bg-secondary"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserBubble({ msg, convId, isAr }: { msg: ChatMsg; convId: string; isAr: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const trimMessages = useChatStore((s) => s.conversations.find((c) => c.id === convId)?.messages ?? []);

  const submitEdit = () => {
    const v = draft.trim();
    if (!v || v === msg.content) { setEditing(false); return; }
    // Trim conversation to messages up to (not including) this one, then resend.
    const idx = trimMessages.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
      useChatStore.setState((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId ? { ...c, messages: c.messages.slice(0, idx) } : c
        ),
      }));
      void sendChat(convId, v, msg.attachments);
    } else {
      updateMessage(convId, msg.id, { content: v });
    }
    setEditing(false);
  };

  return (
    <div className="group flex flex-col items-end gap-1.5">
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {msg.attachments.map((a) =>
            a.kind === "image" ? (
              <img key={a.id} src={a.url} alt={a.name} className="h-28 w-28 rounded-xl border border-border/40 object-cover" />
            ) : (
              <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-2.5 py-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[160px] truncate font-micro text-[11px]">{a.name}</span>
              </div>
            )
          )}
        </div>
      )}
      {editing ? (
        <div className="flex w-full max-w-[85%] flex-col gap-1.5">
          <textarea
            autoFocus
            dir="auto"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); } if (e.key === "Escape") setEditing(false); }}
            className="min-h-[60px] w-full resize-none rounded-2xl border border-primary/50 bg-primary/10 px-4 py-2.5 text-sm outline-none focus:border-primary"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-muted-foreground hover:bg-secondary/70">
              <X className="h-3.5 w-3.5" />
            </button>
            <button onClick={submitEdit} className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        msg.content && (
          <div className="flex items-end gap-1.5">
            <button
              onClick={() => { setDraft(msg.content); setEditing(true); }}
              title={isAr ? "تعديل" : "Edit"}
              className="mb-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground/50 opacity-0 transition group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <div dir="auto" className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-ee-md bg-primary px-4 py-2.5 text-start text-sm text-primary-foreground">
              {msg.content}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Bubble({
  msg,
  isLast,
  convId,
}: {
  msg: ChatMsg;
  isLast: boolean;
  convId: string;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  const streaming = msg.pending && msg.content.length === 0;

  const copy = () => {
    void navigator.clipboard?.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <UserBubble msg={msg} convId={convId} isAr={isAr} />
    );
  }

  return (
    <div className="group flex gap-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          dir="auto"
          className={cn(
            "text-start text-sm",
            msg.error && "rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive"
          )}
        >
          {streaming ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-micro text-xs">{isAr ? "بيفكر…" : "Thinking…"}</span>
            </span>
          ) : msg.error ? (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          ) : (
            <>
              <Markdown text={msg.content} />
              {msg.pending && <span className="ms-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />}
            </>
          )}
        </div>

        {/* row actions (copy / regenerate) — hidden until hover, only when settled */}
        {!msg.pending && !streaming && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            {!msg.error && (
              <button
                onClick={copy}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-micro text-[10px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {isAr ? (copied ? "اتنسخ" : "نسخ") : (copied ? "Copied" : "Copy")}
              </button>
            )}
            {isLast && (
              <button
                onClick={() => void regenerate(convId)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-micro text-[10px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                {isAr ? "إعادة" : "Retry"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
