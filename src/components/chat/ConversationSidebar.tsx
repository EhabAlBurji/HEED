import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Trash2, Settings, Sparkles, Pencil, SquarePen, PanelLeft, Share2, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chatStore";
import { shareConversation } from "../../lib/chatShare";
import { toast } from "sonner";

// =========================================================================
// Left rail — new chat, the Custom-GPT gallery button, settings, and the
// list of past conversations.
// =========================================================================

export function ConversationSidebar({
  onNewChat,
  onOpenGallery,
  onOpenSettings,
  onNavigate,
  onCollapse,
}: {
  onNewChat: () => void;
  onOpenGallery: () => void;
  onOpenSettings: () => void;
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const setActive = useChatStore((s) => s.setActive);
  const del = useChatStore((s) => s.deleteConversation);
  const rename = useChatStore((s) => s.renameConversation);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const assistants = useChatStore((s) => s.assistants);

  const handleShare = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const conv = conversations.find((c) => c.id === convId);
    if (!conv || conv.messages.length === 0) {
      toast.error(isAr ? "المحادثة فارغة" : "Conversation is empty");
      return;
    }
    setSharingId(convId);
    try {
      const assistant = assistants.find((a) => a.id === conv.assistantId);
      const id = await shareConversation(conv.title, conv.messages, assistant?.name ?? "Heed Assistant");
      const url = `${window.location.origin}/share/${id}`;
      await navigator.clipboard.writeText(url);
      toast.success(isAr ? "تم نسخ الرابط ✓" : "Link copied ✓");
    } catch {
      toast.error(isAr ? "تعذّرت المشاركة" : "Share failed");
    } finally {
      setSharingId(null);
    }
  };

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-e border-border/60 bg-card/30">
      <div className="space-y-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onNewChat}
            className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground/80 transition hover:bg-secondary"
          >
            <SquarePen className="h-4 w-4" /> {isAr ? "محادثة جديدة" : "New chat"}
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              title={isAr ? "إخفاء المحادثات" : "Hide chats"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => { onOpenGallery(); onNavigate?.(); }}
          className="flex w-full items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm text-foreground/80 transition hover:bg-secondary"
        >
          <Sparkles className="h-4 w-4 text-primary" /> HEDs
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 scrollbar-none">
        <p className="px-2 pb-1 pt-2 font-micro text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {isAr ? "المحادثات" : "Chats"}
        </p>
        {conversations.length === 0 ? (
          <p className="px-2 py-3 font-micro text-[11px] text-muted-foreground/50">
            {isAr ? "مفيش محادثات لسه." : "No chats yet."}
          </p>
        ) : (
          conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <div
                key={c.id}
                onClick={() => { setActive(c.id); onNavigate?.(); }}
                className={cn(
                  "group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
                  active ? "bg-secondary text-foreground" : "text-foreground/70 hover:bg-secondary/60"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                {editingId === c.id ? (
                  <input
                    autoFocus
                    dir="auto"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { rename(c.id, draft); setEditingId(null); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => { rename(c.id, draft); setEditingId(null); }}
                    className="min-w-0 flex-1 rounded border border-primary/40 bg-background px-1 py-0.5 text-xs outline-none"
                  />
                ) : (
                  <span dir="auto" className="min-w-0 flex-1 truncate text-start">{c.title}</span>
                )}
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={(e) => void handleShare(c.id, e)}
                    className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 hover:text-primary"
                    title={isAr ? "مشاركة المحادثة" : "Share chat"}
                  >
                    {sharingId === c.id ? <Check className="h-3 w-3 text-primary" /> : <Share2 className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setDraft(c.title); }}
                    className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 hover:text-foreground"
                    title={isAr ? "إعادة تسمية" : "Rename"}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); del(c.id); }}
                    className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 hover:text-destructive"
                    title={isAr ? "حذف" : "Delete"}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border/40 p-2">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Settings className="h-4 w-4" /> {isAr ? "إعدادات الشات" : "Chat settings"}
        </button>
      </div>
    </aside>
  );
}

// Re-export icon so the page can show it in an empty header without another import.
export { MessageSquare };
