import { X, Plus, Pencil } from "lucide-react";
import { useChatStore, type ChatAssistant } from "../../stores/chatStore";

// =========================================================================
// Custom GPT gallery — pick an assistant to start chatting with, or create /
// edit one. Mirrors ChatGPT's "Explore GPTs" surface.
// =========================================================================

export function AssistantGallery({
  onPick,
  onCreate,
  onEdit,
  onClose,
}: {
  onPick: (a: ChatAssistant) => void;
  onCreate: () => void;
  onEdit: (a: ChatAssistant) => void;
  onClose: () => void;
}) {
  const assistants = useChatStore((s) => s.assistants);

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <h3 className="font-display text-base font-bold">المساعدين</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-2.5 overflow-y-auto px-5 py-4 scrollbar-none sm:grid-cols-2">
          <button
            onClick={onCreate}
            className="flex items-center gap-3 rounded-xl border border-dashed border-border/60 p-3 text-start transition hover:border-primary/50 hover:bg-secondary"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">إنشاء مساعد</span>
              <span className="block font-micro text-[11px] text-muted-foreground">صمّم Custom GPT خاص بيك</span>
            </span>
          </button>

          {assistants.map((a) => (
            <div
              key={a.id}
              className="group flex items-center gap-3 rounded-xl border border-border/50 p-3 transition hover:border-primary/40 hover:bg-secondary/50"
            >
              <button onClick={() => onPick(a)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-xl">{a.emoji}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{a.name}</span>
                  <span className="block truncate font-micro text-[11px] text-muted-foreground">{a.description || "—"}</span>
                </span>
              </button>
              <button
                onClick={() => onEdit(a)}
                title="تعديل"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/50 opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
