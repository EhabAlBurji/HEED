import { useRef, useState, useEffect } from "react";
import { ArrowUp, Square, Plus, Mic, X, FileText, Loader2, Image as ImageIcon, ChevronDown, Check, Settings2, Zap, Brain, Sparkles, Wand2, Camera, Layers, Paintbrush, Cloud, Globe, Bot } from "lucide-react";
import { cn } from "../../lib/utils";
import { useChatStore, type ChatAttachment } from "../../stores/chatStore";
import { transcribeAudio } from "../../lib/chatProviders";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// =========================================================================
// Composer — ChatGPT-style. Auto-growing textarea + a bottom toolbar with a
// "+" attach menu (image / file), a friendly model picker, a voice button,
// and send. Enter sends, Shift+Enter = newline.
// =========================================================================

const TEXT_EXT = /\.(txt|md|markdown|csv|json|js|jsx|ts|tsx|py|rb|go|rs|java|c|cpp|h|css|html|xml|yml|yaml|sh|sql|php|swift|kt)$/i;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Friendly presets → real model ids, grouped by provider.
const MODEL_PRESETS = [
  // ── Heed (Groq / Llama) ───────────────────────────────────────────────────
  { id: "llama-3.3-70b-versatile", icon: Sparkles, group: "heed", label: { ar: "Heed Auto",  en: "Heed Auto"  }, hint: { ar: "متوازن — الافتراضي",        en: "Balanced — default"             } },
  { id: "llama-3.1-8b-instant",    icon: Zap,      group: "heed", label: { ar: "سريع",        en: "Fast"       }, hint: { ar: "أسرع رد",                   en: "Fastest reply"                  } },
  { id: "openai/gpt-oss-120b",     icon: Brain,    group: "heed", label: { ar: "تفكير",       en: "Thinking"   }, hint: { ar: "يفكر أطول لإجابات أعمق",   en: "Thinks longer for deeper answers" } },
  // ── Google Gemini ─────────────────────────────────────────────────────────
  { id: "gemini-2.0-flash",        icon: Bot,      group: "gemini", label: { ar: "Gemini Flash",    en: "Gemini Flash"    }, hint: { ar: "جوجل · جودة عالية · مجاني", en: "Google · high quality · free" } },
  { id: "gemini-2.0-flash-lite",   icon: Bot,      group: "gemini", label: { ar: "Gemini Flash Lite", en: "Gemini Flash Lite" }, hint: { ar: "جوجل · أسرع · مجاني",      en: "Google · fastest · free"     } },
  { id: "gemini-1.5-flash",        icon: Bot,      group: "gemini", label: { ar: "Gemini 1.5 Flash",  en: "Gemini 1.5 Flash"  }, hint: { ar: "جوجل · كلاسيك",           en: "Google · classic"            } },
];

// Image generation presets — grouped by provider.
// needsKey: false = no key (Pollinations), "cf" = Cloudflare key, "hf" = HF token.
const IMAGE_PRESETS = [
  // ── Pollinations — keyless ──────────────────────────────────────────────
  { id: "flux",           icon: Wand2,      needsKey: false as const, label: { ar: "FLUX — جودة عالية",   en: "FLUX — Quality"      }, hint: { ar: "Pollinations · أعلى جودة",      en: "Pollinations · best quality"   } },
  { id: "flux-realism",   icon: Camera,     needsKey: false as const, label: { ar: "FLUX — واقعي",         en: "FLUX — Realistic"    }, hint: { ar: "Pollinations · فوتوغرافي",      en: "Pollinations · photorealistic" } },
  { id: "flux-anime",     icon: Sparkles,   needsKey: false as const, label: { ar: "FLUX — أنمي",          en: "FLUX — Anime"        }, hint: { ar: "Pollinations · أنمي وكرتون",   en: "Pollinations · anime style"    } },
  { id: "flux-3d",        icon: Layers,     needsKey: false as const, label: { ar: "FLUX — ثلاثي الأبعاد", en: "FLUX — 3D"           }, hint: { ar: "Pollinations · رندر 3D",        en: "Pollinations · 3D renders"     } },
  { id: "flux-cablyai",   icon: Paintbrush, needsKey: false as const, label: { ar: "FLUX — فني",           en: "FLUX — Artistic"     }, hint: { ar: "Pollinations · فن إبداعي",     en: "Pollinations · artistic"       } },
  { id: "sana",           icon: Brain,      needsKey: false as const, label: { ar: "Sana — NVIDIA",        en: "Sana — NVIDIA"       }, hint: { ar: "Pollinations · معمارية مختلفة", en: "Pollinations · different arch" } },
  { id: "turbo",          icon: Zap,        needsKey: false as const, label: { ar: "Turbo — سريع",         en: "Turbo — Fast"        }, hint: { ar: "Pollinations · SDXL Turbo",     en: "Pollinations · SDXL Turbo"     } },
  // ── Cloudflare Workers AI — free with CF account ────────────────────────
  { id: "cf:flux-schnell", icon: Cloud,     needsKey: "cf" as const,  label: { ar: "CF — FLUX Schnell",   en: "CF — FLUX Schnell"   }, hint: { ar: "Cloudflare AI · مفتاح مجاني",  en: "Cloudflare AI · free key"      } },
  // ── Hugging Face — free token ────────────────────────────────────────────
  { id: "hf:sd21",  icon: Globe, needsKey: "hf" as const, label: { ar: "HF — SD 2.1",  en: "HF — SD 2.1"  }, hint: { ar: "Stable Diffusion 2.1",  en: "Stable Diffusion 2.1"  } },
  { id: "hf:sd15",  icon: Globe, needsKey: "hf" as const, label: { ar: "HF — SD 1.5",  en: "HF — SD 1.5"  }, hint: { ar: "Stable Diffusion 1.5",  en: "Stable Diffusion 1.5"  } },
  { id: "hf:sdxl",  icon: Globe, needsKey: "hf" as const, label: { ar: "HF — SDXL",    en: "HF — SDXL"    }, hint: { ar: "Stable Diffusion XL",   en: "Stable Diffusion XL"   } },
];

export function Composer({
  streaming,
  onSend,
  onStop,
  onOpenSettings,
  onImage,
  placeholder,
}: {
  streaming: boolean;
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  onStop: () => void;
  onOpenSettings: () => void;
  onImage?: (prompt: string, model?: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [atts, setAtts] = useState<ChatAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [attMenu, setAttMenu] = useState(false);
  const [modelMenu, setModelMenu] = useState(false);
  // null = chat mode; string = image mode with that model id.
  const [imageModel, setImageModel] = useState<string | null>(null);
  // Keep in sync when default changes in settings.
  const activateImageMode = (id?: string) => {
    const m = id ?? defaultImageModel;
    setImageModel(m);
    setSettings({ defaultImageModel: m });
  };
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const ref = useRef<HTMLTextAreaElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const provider = useChatStore((s) => s.provider);
  const groqApiKey = useChatStore((s) => s.groqApiKey);
  const heedModel = useChatStore((s) => s.heedModel);
  const groqModel = useChatStore((s) => s.groqModel);
  const ollamaModel = useChatStore((s) => s.ollamaModel);
  const defaultImageModel = useChatStore((s) => s.defaultImageModel ?? "flux");
  const setSettings = useChatStore((s) => s.setSettings);

  const lang = isAr ? "ar" : "en";
  const currentModel = provider === "heed" ? heedModel : provider === "groq" ? groqModel : ollamaModel;
  const activePreset = MODEL_PRESETS.find((m) => m.id === currentModel);
  const isGeminiActive = activePreset?.group === "gemini";
  const activeImagePreset = imageModel ? IMAGE_PRESETS.find((m) => m.id === imageModel) ?? IMAGE_PRESETS[0] : null;
  const setModel = (id: string) => {
    if (provider === "heed") setSettings({ heedModel: id });
    else if (provider === "groq") setSettings({ groqModel: id });
    else setSettings({ ollamaModel: id });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const submit = () => {
    const v = text.trim();
    if ((!v && atts.length === 0) || streaming) return;
    if (imageModel && v) {
      onImage?.(v, imageModel);
      setText("");
    } else if (!imageModel) {
      onSend(v, atts.length ? atts : undefined);
      setText("");
      setAtts([]);
    }
  };

  // ── Attachments ──────────────────────────────────────────────────────────
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: ChatAttachment[] = [];
    for (const f of Array.from(files)) {
      if (f.type.startsWith("image/")) {
        if (f.size > MAX_IMAGE_BYTES) { toast.error(isAr ? `الصورة كبيرة: ${f.name}` : `Image too large: ${f.name}`); continue; }
        const url = await readAsDataURL(f);
        next.push({ id: crypto.randomUUID(), kind: "image", name: f.name, mime: f.type, url, size: f.size });
      } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        const tid = toast.loading(isAr ? `بقرأ ${f.name}…` : `Reading ${f.name}…`);
        try {
          const t = await pdfToText(f);
          if (!t.trim()) { toast.error(isAr ? `مفيش نص أقدر أقراه في ${f.name}` : `No readable text in ${f.name}`); continue; }
          next.push({ id: crypto.randomUUID(), kind: "file", name: f.name, mime: "application/pdf", text: t.slice(0, 60_000), size: f.size });
        } catch {
          toast.error(isAr ? `تعذّر قراءة ${f.name}` : `Couldn't read ${f.name}`);
        } finally {
          toast.dismiss(tid);
        }
      } else if (TEXT_EXT.test(f.name) || f.type.startsWith("text/")) {
        const textContent = await f.text();
        next.push({ id: crypto.randomUUID(), kind: "file", name: f.name, mime: f.type || "text/plain", text: textContent.slice(0, 60_000), size: f.size });
      } else {
        toast.error(isAr ? `نوع غير مدعوم: ${f.name} (صور · PDF · ملفات نصية)` : `Unsupported file: ${f.name} (images · PDF · text)`);
      }
    }
    if (next.length) setAtts((a) => [...a, ...next]);
    if (imgRef.current) imgRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAtt = (id: string) => setAtts((a) => a.filter((x) => x.id !== id));

  // ── Voice ──────────────────────────────────────────────────────────────────
  const toggleRecord = async () => {
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) return;
        setTranscribing(true);
        try {
          const out = await transcribeAudio(blob, { provider, apiKey: groqApiKey });
          if (out.trim()) setText((t) => (t ? `${t} ${out}` : out));
        } catch (e) {
          toast.error((e as Error).message || (isAr ? "تعذّر تفريغ الصوت" : "Transcription failed"));
        } finally {
          setTranscribing(false);
          ref.current?.focus();
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error(isAr ? "مش قادر أوصل للميكروفون" : "Can't access the microphone");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.css,.html,.xml,.yml,.yaml,.sh,.sql,.php" className="hidden" onChange={(e) => void onFiles(e.target.files)} />

      {/* Attachment previews */}
      {atts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {atts.map((a) =>
            a.kind === "image" ? (
              <div key={a.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border/60">
                <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                <button onClick={() => removeAtt(a.id)} className="absolute end-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <div key={a.id} className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5">
                <FileText className="h-4 w-4 text-primary" />
                <span className="max-w-[140px] truncate font-micro text-[11px]">{a.name}</span>
                <button onClick={() => removeAtt(a.id)} className="text-muted-foreground/60 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          )}
        </div>
      )}

      <div className={cn(
        "rounded-2xl border bg-card/60 p-2 shadow-sm",
        imageModel
          ? "border-violet-500/50 focus-within:border-violet-500/70"
          : "border-border/60 focus-within:border-primary/40"
      )}>
        {/* Text row */}
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
            if (imgs.length) { e.preventDefault(); void onFiles(e.clipboardData.files); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
          rows={1}
          dir="auto"
          placeholder={
            transcribing ? (isAr ? "بفرّغ الصوت…" : "Transcribing…")
            : recording ? (isAr ? "بسجّل… دوس الميكروفون تاني للإيقاف" : "Recording… tap the mic again to stop")
            : imageModel ? (isAr ? "صف الصورة اللي عايزها… مثلاً: غروب شمس على البحر" : "Describe the image you want… e.g. sunset over the ocean")
            : placeholder ?? (isAr ? "اكتب رسالتك…" : "Ask anything…")
          }
          className="max-h-[200px] w-full resize-none bg-transparent px-2 py-1.5 text-start text-sm outline-none placeholder:text-muted-foreground/50"
        />

        {/* Toolbar row */}
        <div className="mt-1 flex items-center gap-1.5">
          {/* + attach menu */}
          <div className="relative">
            <button
              onClick={() => setAttMenu((v) => !v)}
              title="إرفاق"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-5 w-5" />
            </button>
            {attMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAttMenu(false)} />
                <div className="absolute bottom-full z-50 mb-1.5 w-48 rounded-xl border border-border/60 bg-card p-1.5 shadow-2xl">
                  <MenuItem icon={<ImageIcon className="h-4 w-4" />} onClick={() => { imgRef.current?.click(); setAttMenu(false); }}>
                    {isAr ? "إضافة صورة" : "Add image"}
                  </MenuItem>
                  <MenuItem icon={<FileText className="h-4 w-4" />} onClick={() => { fileRef.current?.click(); setAttMenu(false); }}>
                    {isAr ? "إضافة ملف" : "Add file"}
                  </MenuItem>
                  {onImage && (
                    <MenuItem
                      icon={<Wand2 className="h-4 w-4" />}
                      onClick={() => {
                        activateImageMode();
                        setAttMenu(false);
                        setTimeout(() => ref.current?.focus(), 50);
                      }}
                    >
                      {isAr ? "توليد صورة" : "Generate image"}
                    </MenuItem>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Model picker */}
          <div className="relative">
            <button
              onClick={() => setModelMenu((v) => !v)}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition hover:bg-secondary",
                activeImagePreset ? "text-violet-400 hover:text-violet-300" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {activeImagePreset
                ? <activeImagePreset.icon className="h-3.5 w-3.5" />
                : activePreset
                  ? <activePreset.icon className={cn("h-3.5 w-3.5", isGeminiActive && "text-blue-400")} />
                  : <Sparkles className="h-3.5 w-3.5" />}
              <span>{activeImagePreset ? activeImagePreset.label[lang] : activePreset ? activePreset.label[lang] : isAr ? "مخصّص" : "Custom"}</span>
              <ChevronDown className={cn("h-3 w-3 transition", modelMenu && "rotate-180")} />
            </button>
            {modelMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelMenu(false)} />
                <div className="absolute bottom-full z-50 mb-1.5 w-64 rounded-xl border border-border/60 bg-card p-1.5 shadow-2xl">
                  {imageModel ? (
                    // ── IMAGE MODE: show only image models ─────────────────
                    <>
                      <button
                        onClick={() => { setImageModel(null); setModelMenu(false); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      >
                        <span className="text-sm leading-none">←</span>
                        {isAr ? "الرجوع للشات" : "Back to chat"}
                      </button>
                      <div className="my-1 h-px bg-border/40" />
                      <p className="px-2.5 py-1 font-micro text-[9px] uppercase tracking-wider text-muted-foreground/60">Pollinations</p>
                      {IMAGE_PRESETS.filter((m) => !m.needsKey).map((m) => (
                        <ImagePresetBtn key={m.id} m={m} lang={lang} active={imageModel === m.id} onSelect={() => { activateImageMode(m.id); setModelMenu(false); }} />
                      ))}
                      <div className="my-1 h-px bg-border/40" />
                      <p className="px-2.5 py-1 font-micro text-[9px] uppercase tracking-wider text-muted-foreground/60">Cloudflare AI</p>
                      {IMAGE_PRESETS.filter((m) => m.needsKey === "cf").map((m) => (
                        <ImagePresetBtn key={m.id} m={m} lang={lang} active={imageModel === m.id} onSelect={() => { activateImageMode(m.id); setModelMenu(false); }} />
                      ))}
                      <div className="my-1 h-px bg-border/40" />
                      <p className="px-2.5 py-1 font-micro text-[9px] uppercase tracking-wider text-muted-foreground/60">Hugging Face</p>
                      {IMAGE_PRESETS.filter((m) => m.needsKey === "hf").map((m) => (
                        <ImagePresetBtn key={m.id} m={m} lang={lang} active={imageModel === m.id} onSelect={() => { activateImageMode(m.id); setModelMenu(false); }} />
                      ))}
                    </>
                  ) : (
                    // ── CHAT MODE: show only chat models ───────────────────
                    <>
                      <p className="px-2.5 py-1 font-micro text-[9px] uppercase tracking-wider text-muted-foreground/60">Heed</p>
                      {MODEL_PRESETS.filter((m) => m.group === "heed").map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.id); setModelMenu(false); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition hover:bg-secondary"
                        >
                          <m.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-tight">{m.label[lang]}</span>
                            <span className="block font-micro text-[10px] text-muted-foreground">{m.hint[lang]}</span>
                          </span>
                          {currentModel === m.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        </button>
                      ))}
                      <div className="my-1 h-px bg-border/40" />
                      <p className="px-2.5 py-1 font-micro text-[9px] uppercase tracking-wider text-muted-foreground/60">Google Gemini</p>
                      {MODEL_PRESETS.filter((m) => m.group === "gemini").map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.id); setModelMenu(false); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition hover:bg-secondary"
                        >
                          <m.icon className="h-4 w-4 shrink-0 text-blue-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-tight">{m.label[lang]}</span>
                            <span className="block font-micro text-[10px] text-muted-foreground">{m.hint[lang]}</span>
                          </span>
                          {currentModel === m.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        </button>
                      ))}
                      <div className="my-1 h-px bg-border/40" />
                      <button
                        onClick={() => { activateImageMode(); setModelMenu(false); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition hover:bg-secondary"
                      >
                        <Wand2 className="h-4 w-4 shrink-0 text-violet-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-tight text-violet-300">{isAr ? "توليد الصور" : "Image Generation"}</span>
                          <span className="block font-micro text-[10px] text-muted-foreground">{isAr ? "11 نموذج · مجاني" : "11 models · free"}</span>
                        </span>
                      </button>
                    </>
                  )}
                  <div className="my-1 h-px bg-border/40" />
                  <button
                    onClick={() => { setModelMenu(false); onOpenSettings(); }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <Settings2 className="h-4 w-4" /> {isAr ? "إعدادات متقدّمة" : "Advanced settings"}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Voice */}
          <button
            onClick={() => void toggleRecord()}
            disabled={transcribing}
            title={recording ? "إيقاف التسجيل" : "تسجيل صوتي"}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-40",
              recording ? "bg-destructive text-white animate-pulse" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Send / Stop */}
          {streaming ? (
            <button onClick={onStop} title="إيقاف" className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-foreground transition hover:bg-secondary/70">
              <Square className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim() && atts.length === 0}
              title="إرسال"
              className={cn("grid h-8 w-8 place-items-center rounded-lg transition",
                text.trim() || atts.length ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-secondary text-muted-foreground/40")}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-center font-micro text-[10px] text-muted-foreground/50">
        {isAr ? "قد يخطئ المساعد — راجع المعلومات المهمة." : "The assistant can make mistakes — check important info."}
      </p>
    </div>
  );
}

function ImagePresetBtn({
  m, lang, active, onSelect,
}: {
  m: { id: string; icon: React.ElementType; label: { ar: string; en: string }; hint: { ar: string; en: string } };
  lang: "ar" | "en";
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition hover:bg-secondary"
    >
      <m.icon className={cn("h-4 w-4 shrink-0", active ? "text-violet-400" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium leading-tight", active && "text-violet-300")}>{m.label[lang]}</span>
        <span className="block font-micro text-[10px] text-muted-foreground">{m.hint[lang]}</span>
      </span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-violet-400" />}
    </button>
  );
}

function MenuItem({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition hover:bg-secondary">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </button>
  );
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Extract text from a PDF in the browser. pdfjs is loaded lazily (only when a
// PDF is actually attached) so it stays out of the main chat bundle.
async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
    if (text.length > 60_000) break;
  }
  return text;
}
