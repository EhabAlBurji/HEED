import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button, Input, Textarea, Label } from "../ui/primitives";
import { useChatStore, type ChatAssistant } from "../../stores/chatStore";

// =========================================================================
// Custom GPT editor — create or edit an assistant (name, avatar emoji,
// description, system instructions, conversation starters).
// =========================================================================

const EMOJI_CHOICES = ["🤖", "✨", "✍️", "💻", "📊", "🎯", "🧠", "📝", "🚀", "🎨", "📚", "⚖️", "🩺", "🍳", "💡", "🗂️"];

export function AssistantEditor({
  assistant,
  onClose,
}: {
  assistant: ChatAssistant | null; // null = create new
  onClose: () => void;
}) {
  const upsert = useChatStore((s) => s.upsertAssistant);
  const remove = useChatStore((s) => s.deleteAssistant);

  const [emoji, setEmoji] = useState(assistant?.emoji ?? "🤖");
  const [name, setName] = useState(assistant?.name ?? "");
  const [description, setDescription] = useState(assistant?.description ?? "");
  const [instructions, setInstructions] = useState(assistant?.instructions ?? "");
  const [startersText, setStartersText] = useState((assistant?.starters ?? []).join("\n"));

  const isBuiltin = !!assistant?.builtin;

  const save = () => {
    if (!name.trim()) return;
    upsert({
      id: assistant?.id,
      emoji,
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      starters: startersText.split("\n").map((s) => s.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <h3 className="font-display text-base font-bold">
            {assistant ? "تعديل المساعد" : "مساعد جديد (Custom GPT)"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 scrollbar-none">
          {isBuiltin && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 font-micro text-[11px] text-muted-foreground">
              ده مساعد جاهز — تقدر تعدّله، وهيتحفظ نسختك.
            </p>
          )}

          <div>
            <Label className="mb-1.5">الأيقونة</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`grid h-9 w-9 place-items-center rounded-lg border text-lg transition ${
                    emoji === e ? "border-primary bg-primary/10" : "border-border/40 hover:bg-secondary"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5">الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: خبير التسويق" />
          </div>

          <div>
            <Label className="mb-1.5">وصف قصير</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="بيظهر تحت الاسم في المعرض"
            />
          </div>

          <div>
            <Label className="mb-1.5">التعليمات (شخصية المساعد)</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              placeholder="إنت مين؟ تتصرف إزاي؟ مثال: إنت خبير تسويق رقمي، ردودك عملية ومختصرة وبتقترح خطوات قابلة للتنفيذ…"
            />
            <p className="mt-1 font-micro text-[10px] text-muted-foreground/60">
              دي الـ system prompt اللي بتتبعت قبل كل محادثة.
            </p>
          </div>

          <div>
            <Label className="mb-1.5">جُمل بداية (اختياري — سطر لكل واحدة)</Label>
            <Textarea
              value={startersText}
              onChange={(e) => setStartersText(e.target.value)}
              rows={3}
              placeholder={"اكتبلي خطة محتوى لأسبوع\nحللي المنافسين في…"}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
          {assistant && !isBuiltin ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { remove(assistant.id); onClose(); }}
            >
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
            <Button size="sm" onClick={save} disabled={!name.trim()}>حفظ</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
