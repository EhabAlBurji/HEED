import { useRef, useState, useEffect } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "../../lib/utils";

// =========================================================================
// Composer — auto-growing textarea. Enter sends, Shift+Enter = newline.
// Shows a Stop button while a reply is streaming.
// =========================================================================

export function Composer({
  streaming,
  onSend,
  onStop,
  placeholder,
}: {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to a cap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const submit = () => {
    const v = text.trim();
    if (!v || streaming) return;
    onSend(v);
    setText("");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card/60 p-2 shadow-sm focus-within:border-primary/40">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={placeholder ?? "اكتب رسالتك…"}
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
        />
        {streaming ? (
          <button
            onClick={onStop}
            title="إيقاف"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground transition hover:bg-secondary/70"
          >
            <Square className="h-4 w-4" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!text.trim()}
            title="إرسال"
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition",
              text.trim()
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-secondary text-muted-foreground/40"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-center font-micro text-[10px] text-muted-foreground/50">
        قد يخطئ المساعد — راجع المعلومات المهمة.
      </p>
    </div>
  );
}
