import { useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Markdown } from "./Markdown";
import type { ChatAssistant, ChatMsg, Conversation } from "../../stores/chatStore";
import { regenerate } from "../../lib/chatActions";

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
            assistant={assistant}
            isLast={i === msgs.length - 1}
            convId={conversation.id}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  assistant,
  onStarter,
}: {
  assistant: ChatAssistant;
  onStarter: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-4xl">
        {assistant.emoji}
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

function Bubble({
  msg,
  assistant,
  isLast,
  convId,
}: {
  msg: ChatMsg;
  assistant: ChatAssistant;
  isLast: boolean;
  convId: string;
}) {
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
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-ee-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-lg">
        {assistant.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm",
            msg.error && "rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive"
          )}
        >
          {streaming ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-micro text-xs">بيفكر…</span>
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
                {copied ? "اتنسخ" : "نسخ"}
              </button>
            )}
            {isLast && (
              <button
                onClick={() => void regenerate(convId)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-micro text-[10px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                إعادة
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
