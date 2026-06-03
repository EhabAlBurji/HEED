import { useState } from "react";
import { Plus, MessageSquare, Trash2, Settings, Sparkles, Pencil } from "lucide-react";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chatStore";

// =========================================================================
// Left rail — new chat, the Custom-GPT gallery button, settings, and the
// list of past conversations.
// =========================================================================

export function ConversationSidebar({
  onNewChat,
  onOpenGallery,
  onOpenSettings,
}: {
  onNewChat: () => void;
  onOpenGallery: () => void;
  onOpenSettings: () => void;
}) {
  const conversations = useChatStore((s) => s.conversations);
  const assistants = useChatStore((s) => s.assistants);
  const activeId = useChatStore((s) => s.activeId);
  const setActive = useChatStore((s) => s.setActive);
  const del = useChatStore((s) => s.deleteConversation);
  const rename = useChatStore((s) => s.renameConversation);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const emojiFor = (assistantId: string) =>
    assistants.find((a) => a.id === assistantId)?.emoji ?? "🤖";

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-e border-border/60 bg-card/30">
      <div className="space-y-1.5 p-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> محادثة جديدة
        </button>
        <button
          onClick={onOpenGallery}
          className="flex w-full items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm text-foreground/80 transition hover:bg-secondary"
        >
          <Sparkles className="h-4 w-4 text-primary" /> المساعدين (Custom GPT)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 scrollbar-none">
        <p className="px-2 pb-1 pt-2 font-micro text-[10px] uppercase tracking-widest text-muted-foreground/60">
          المحادثات
        </p>
        {conversations.length === 0 ? (
          <p className="px-2 py-3 font-micro text-[11px] text-muted-foreground/50">
            مفيش محادثات لسه.
          </p>
        ) : (
          conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <div
                key={c.id}
                onClick={() => setActive(c.id)}
                className={cn(
                  "group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
                  active ? "bg-secondary text-foreground" : "text-foreground/70 hover:bg-secondary/60"
                )}
              >
                <span className="text-base leading-none">{emojiFor(c.assistantId)}</span>
                {editingId === c.id ? (
                  <input
                    autoFocus
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
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                )}
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setDraft(c.title); }}
                    className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 hover:text-foreground"
                    title="إعادة تسمية"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); del(c.id); }}
                    className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 hover:text-destructive"
                    title="حذف"
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
          <Settings className="h-4 w-4" /> إعدادات الشات
        </button>
      </div>
    </aside>
  );
}

// Re-export icon so the page can show it in an empty header without another import.
export { MessageSquare };
