import { useEffect, useRef, useState } from "react";
import { X, Trash2, Sparkles, SlidersHorizontal, ArrowUp, Loader2 } from "lucide-react";
import { Button, Input, Textarea, Label } from "../ui/primitives";
import { cn } from "../../lib/utils";
import { useChatStore, type ChatAssistant } from "../../stores/chatStore";
import { streamAssistant } from "../../lib/chatActions";
import { type ChatMessage } from "../../lib/chatProviders";

// =========================================================================
// HED editor — "Create" (conversational builder) + "Configure" (form), with
// a live preview. Describe the assistant you want and the model fills in the
// name, emoji, instructions and starters; tweak anything by hand in Configure.
// =========================================================================

const EMOJI_CHOICES = ["🤖", "✨", "✍️", "💻", "📊", "🎯", "🧠", "📝", "🚀", "🎨", "📚", "⚖️", "🩺", "🍳", "💡", "🗂️"];

const BUILDER_SYSTEM = `أنت "منشئ HED" — مساعد بيساعد المستخدم يصمّم مساعد ذكي مخصّص (HED) جوه تطبيق Heed.
اتكلم بإيجاز وودّ. افهم غرض المساعد، واسأل سؤال واحد على الأكثر لو في غموض مهم، وإلا ابنيه فوراً.
أول ما يكون عندك تصوّر كافٍ، رُد برسالة قصيرة جداً (سطر-سطرين) وبعدها ضِف بلوك JSON واحد بالظبط بالمفاتيح دي:
\`\`\`json
{"emoji":"🤖","name":"اسم قصير","description":"وصف سطر واحد","instructions":"تعليمات النظام كاملة بصيغة المخاطب: أنت ...","starters":["جملة بداية 1","جملة بداية 2","جملة بداية 3"]}
\`\`\`
قواعد:
- instructions لازم تكون system prompt واضحة وعملية (شخصية المساعد، أسلوبه، اللي يعمله واللي يتجنّبه).
- اكتب بنفس لغة المستخدم.
- emoji واحد مناسب.
- لو المستخدم طلب تعديل، رجّع JSON محدّث كامل تاني.
- ماتشرحش الـ JSON — بس بلوك واحد في آخر ردك.`;

type BuilderMsg = { role: "user" | "assistant"; content: string };

interface Spec {
  emoji?: string;
  name?: string;
  description?: string;
  instructions?: string;
  starters?: string[];
}

export function AssistantEditor({
  assistant,
  onClose,
}: {
  assistant: ChatAssistant | null;
  onClose: () => void;
}) {
  const upsert = useChatStore((s) => s.upsertAssistant);
  const remove = useChatStore((s) => s.deleteAssistant);

  const [tab, setTab] = useState<"create" | "configure">(assistant ? "configure" : "create");

  const [emoji, setEmoji] = useState(assistant?.emoji ?? "🤖");
  const [name, setName] = useState(assistant?.name ?? "");
  const [description, setDescription] = useState(assistant?.description ?? "");
  const [instructions, setInstructions] = useState(assistant?.instructions ?? "");
  const [startersText, setStartersText] = useState((assistant?.starters ?? []).join("\n"));

  const isBuiltin = !!assistant?.builtin;
  const starters = startersText.split("\n").map((s) => s.trim()).filter(Boolean);

  const applySpec = (s: Spec) => {
    if (s.emoji) setEmoji(s.emoji);
    if (s.name) setName(s.name);
    if (typeof s.description === "string") setDescription(s.description);
    if (s.instructions) setInstructions(s.instructions);
    if (Array.isArray(s.starters)) setStartersText(s.starters.join("\n"));
  };

  const save = () => {
    if (!name.trim()) { setTab("configure"); return; }
    upsert({
      id: assistant?.id,
      emoji,
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      starters,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + tabs */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <div className="flex items-center gap-1 rounded-xl bg-secondary/60 p-0.5">
            <TabBtn active={tab === "create"} onClick={() => setTab("create")} icon={<Sparkles className="h-3.5 w-3.5" />}>
              Create
            </TabBtn>
            <TabBtn active={tab === "configure"} onClick={() => setTab("configure")} icon={<SlidersHorizontal className="h-3.5 w-3.5" />}>
              Configure
            </TabBtn>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: panel (left) + live preview (right) */}
        <div className="grid min-h-0 flex-1 md:grid-cols-2">
          <div className="min-h-0 border-e border-border/40">
            {tab === "create" ? (
              <CreatePanel applySpec={applySpec} />
            ) : (
              <ConfigurePanel
                {...{ emoji, setEmoji, name, setName, description, setDescription, instructions, setInstructions, startersText, setStartersText, isBuiltin }}
              />
            )}
          </div>
          <Preview emoji={emoji} name={name} description={description} starters={starters} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
          {assistant && !isBuiltin ? (
            <Button variant="destructive" size="sm" onClick={() => { remove(assistant.id); onClose(); }}>
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
            <Button size="sm" onClick={save} disabled={!name.trim()}>حفظ الـ HED</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create: conversational builder ──────────────────────────────────────────
function CreatePanel({ applySpec }: { applySpec: (s: Spec) => void }) {
  const [msgs, setMsgs] = useState<BuilderMsg[]>([
    { role: "assistant", content: "قوللي عايز مساعد يعمل إيه، وأنا أبنيهولك 👇\nمثلاً: «مساعد يكتب كابشنات إنستجرام بالعامية» أو «خبير يراجع أكوادي»." },
  ]);
  const [input, setInput] = useState("");
  const [building, setBuilding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || building) return;
    const base = [...msgs, { role: "user", content: text } as BuilderMsg];
    setMsgs([...base, { role: "assistant", content: "" }]);
    setInput("");
    setBuilding(true);

    const api: ChatMessage[] = [
      { role: "system", content: BUILDER_SYSTEM },
      ...base.map((m) => ({ role: m.role, content: m.content })),
    ];

    let acc = "";
    try {
      await streamAssistant(api, (d) => {
        acc += d;
        setMsgs((prev) => {
          const c = [...prev];
          c[c.length - 1] = { role: "assistant", content: stripJson(acc) || "…" };
          return c;
        });
      });
      const spec = extractSpec(acc);
      if (spec) applySpec(spec);
      setMsgs((prev) => {
        const c = [...prev];
        c[c.length - 1] = {
          role: "assistant",
          content: stripJson(acc) || (spec ? "جهّزت المساعد ✓ شوف الـ Preview، وعدّل أي حاجة من Configure." : acc),
        };
        return c;
      });
    } catch (e) {
      setMsgs((prev) => {
        const c = [...prev];
        c[c.length - 1] = { role: "assistant", content: `⚠️ ${(e as Error).message || "حصل خطأ"}` };
        return c;
      });
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scrollbar-none">
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-ee-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-foreground/90">
                {m.content || (building && i === msgs.length - 1 ? "…" : "")}
              </div>
            </div>
          )
        )}
      </div>
      <div className="border-t border-border/40 p-3">
        <div className="flex items-end gap-1.5 rounded-xl border border-border/60 bg-background/60 p-1.5 focus-within:border-primary/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
            }}
            rows={1}
            placeholder="اوصف المساعد اللي عايزه…"
            className="max-h-[120px] flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || building}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition",
              input.trim() && !building ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-secondary text-muted-foreground/40"
            )}
          >
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Configure: the manual form ──────────────────────────────────────────────
function ConfigurePanel(p: {
  emoji: string; setEmoji: (v: string) => void;
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  instructions: string; setInstructions: (v: string) => void;
  startersText: string; setStartersText: (v: string) => void;
  isBuiltin: boolean;
}) {
  return (
    <div className="h-full space-y-4 overflow-y-auto p-5 scrollbar-none">
      {p.isBuiltin && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 font-micro text-[11px] text-muted-foreground">
          ده HED جاهز — تقدر تعدّله، وهتتحفظ نسختك.
        </p>
      )}
      <div>
        <Label className="mb-1.5">الأيقونة</Label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              onClick={() => p.setEmoji(e)}
              className={cn("grid h-9 w-9 place-items-center rounded-lg border text-lg transition",
                p.emoji === e ? "border-primary bg-primary/10" : "border-border/40 hover:bg-secondary")}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-1.5">الاسم</Label>
        <Input value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="مثلاً: خبير التسويق" />
      </div>
      <div>
        <Label className="mb-1.5">وصف قصير</Label>
        <Input value={p.description} onChange={(e) => p.setDescription(e.target.value)} placeholder="بيظهر تحت الاسم" />
      </div>
      <div>
        <Label className="mb-1.5">التعليمات (شخصية المساعد)</Label>
        <Textarea value={p.instructions} onChange={(e) => p.setInstructions(e.target.value)} rows={6}
          placeholder="إنت مين؟ تتصرف إزاي؟ مثال: إنت خبير تسويق رقمي، ردودك عملية ومختصرة…" />
      </div>
      <div>
        <Label className="mb-1.5">جُمل بداية (سطر لكل واحدة)</Label>
        <Textarea value={p.startersText} onChange={(e) => p.setStartersText(e.target.value)} rows={3}
          placeholder={"اكتبلي خطة محتوى لأسبوع\nحللي المنافسين في…"} />
      </div>
    </div>
  );
}

// ── Live preview (right column) ─────────────────────────────────────────────
function Preview({ emoji, name, description, starters }: { emoji: string; name: string; description: string; starters: string[] }) {
  return (
    <div className="hidden flex-col items-center justify-center gap-1 bg-background/40 p-6 text-center md:flex">
      <span className="mb-1 font-micro text-[10px] uppercase tracking-widest text-muted-foreground/50">Preview</span>
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-4xl">{emoji}</div>
      <h3 className="mt-3 font-display text-lg font-bold">{name || "اسم المساعد"}</h3>
      {description && <p className="max-w-xs text-sm text-muted-foreground">{description}</p>}
      {starters.length > 0 && (
        <div className="mt-4 grid w-full max-w-xs gap-1.5">
          {starters.slice(0, 4).map((s, i) => (
            <div key={i} className="truncate rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-start text-xs text-foreground/70">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Spec parsing ────────────────────────────────────────────────────────────
function extractSpec(text: string): Spec | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : (text.match(/\{[\s\S]*"instructions"[\s\S]*\}/)?.[0] ?? "");
  if (!candidate.trim()) return null;
  try {
    const obj = JSON.parse(candidate.trim());
    if (obj && (obj.name || obj.instructions)) return obj as Spec;
  } catch {
    /* not valid JSON yet (still streaming) */
  }
  return null;
}

function stripJson(text: string): string {
  return text
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]*"instructions"[\s\S]*\}/g, "")
    // also hide an UNclosed fence/brace while it's still streaming in
    .replace(/```[\s\S]*$/g, "")
    .replace(/\{[\s\S]*"(emoji|name|instructions)"[\s\S]*$/g, "")
    .trim();
}
