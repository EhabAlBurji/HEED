import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, Copy, Check } from "lucide-react";
import { getSharedChat, type SharedChat } from "../lib/chatShare";
import { Markdown } from "../components/chat/Markdown";
import { HeedLogo } from "../components/HeedLogo";

// =========================================================================
// Public shareable view of an AI conversation.
// Accessible without login at /share/:id
// =========================================================================

export default function ShareChatPage() {
  const { id } = useParams<{ id: string }>();
  const [chat, setChat] = useState<SharedChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSharedChat(id).then((data) => {
      setChat(data);
      setLoading(false);
    });
  }, [id]);

  const copyLink = () => {
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="animate-pulse text-sm text-muted-foreground">جاري التحميل…</span>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">لم يُعثر على هذه المحادثة أو أنها غير متاحة.</p>
        <p className="font-micro text-xs text-muted-foreground/50">The conversation was not found or is no longer shared.</p>
      </div>
    );
  }

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <HeedLogo className="h-6 w-6 text-primary" />
          <div className="min-w-0 flex-1">
            <p dir="auto" className="truncate font-display text-sm font-semibold">{chat.title}</p>
            <p className="font-micro text-[10px] text-muted-foreground">
              {chat.assistant_name} · {fmtDate(chat.created_at)}
            </p>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 font-micro text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            {copied ? "تم النسخ" : "نسخ الرابط"}
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {chat.messages
          .filter((m) => !m.pending && !m.error && m.content)
          .map((m) => (
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div dir="auto" className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-ee-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div dir="auto" className="min-w-0 flex-1 text-sm">
                  <Markdown text={m.content} />
                </div>
              </div>
            )
          ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center">
        <p className="font-micro text-[11px] text-muted-foreground/50">
          Shared via{" "}
          <a href="https://heedapp.co" className="text-primary hover:underline">
            Heed
          </a>
        </p>
      </footer>
    </div>
  );
}
