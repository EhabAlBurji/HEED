import { useState, useEffect } from "react";
import { X, Wifi, WifiOff, ExternalLink, Check, Loader2 } from "lucide-react";
import { Button, Input, Label } from "../ui/primitives";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chatStore";
import { PROVIDERS, listOllamaModels, type ProviderId } from "../../lib/chatProviders";

// =========================================================================
// Chat settings — pick the backend (Groq online / Ollama offline), the key,
// and the model. Mirrors the look of the rest of the app's settings.
// =========================================================================

export function ChatSettingsModal({ onClose }: { onClose: () => void }) {
  const s = useChatStore();
  const [provider, setProvider] = useState<ProviderId>(s.provider);
  const [heedModel, setHeedModel] = useState(s.heedModel);
  const [groqApiKey, setGroqApiKey] = useState(s.groqApiKey);
  const [groqModel, setGroqModel] = useState(s.groqModel);
  const [ollamaUrl, setOllamaUrl] = useState(s.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(s.ollamaModel);
  const [defaultImageModel, setDefaultImageModel] = useState(s.defaultImageModel ?? "flux");

  const [localModels, setLocalModels] = useState<string[]>([]);
  const [probing, setProbing] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);

  // When Ollama is selected, probe for installed models.
  useEffect(() => {
    if (provider !== "ollama") return;
    setProbing(true);
    setReachable(null);
    listOllamaModels(ollamaUrl)
      .then((m) => { setLocalModels(m); setReachable(true); })
      .catch(() => setReachable(false))
      .finally(() => setProbing(false));
  }, [provider, ollamaUrl]);

  const save = () => {
    s.setSettings({ provider, heedModel, groqApiKey: groqApiKey.trim(), groqModel, ollamaUrl: ollamaUrl.trim(), ollamaModel, defaultImageModel });
    onClose();
  };

  const meta: Record<ProviderId, { name: string; sub: string }> = {
    heed: { name: "Heed", sub: "جاهز · مجاني · بدون مفتاح" },
    groq: { name: "Groq", sub: "أونلاين · مفتاحك الخاص" },
    ollama: { name: "Ollama", sub: "أوفلاين · محلي · خصوصية" },
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <h3 className="font-display text-base font-bold">إعدادات الشات</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4 scrollbar-none">
          {/* Provider picker */}
          <div>
            <Label className="mb-2">المحرّك</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.values(PROVIDERS)).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-start transition",
                    provider === p.id ? "border-primary bg-primary/5" : "border-border/50 hover:bg-secondary"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {p.online ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-amber-500" />}
                    {meta[p.id].name}
                  </span>
                  <span className="font-micro text-[10px] leading-tight text-muted-foreground">
                    {meta[p.id].sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Hosted (Heed) config — no key, just model */}
          {provider === "heed" && (
            <>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                <p className="font-micro text-[11px] text-muted-foreground">
                  الوضع ده مجاني وجاهز — مش محتاج تحط أي مفتاح. بيشتغل عبر خادم Heed.
                </p>
              </div>
              <ModelPicker value={heedModel} onChange={setHeedModel} suggestions={PROVIDERS.heed.models} />
            </>
          )}

          {/* Groq config */}
          {provider === "groq" && (
            <>
              <div>
                <Label className="mb-1.5">مفتاح Groq API</Label>
                <Input
                  type="password"
                  dir="ltr"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_…"
                />
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 font-micro text-[11px] text-primary hover:opacity-80"
                >
                  <ExternalLink className="h-3 w-3" /> اطلب مفتاح مجاني من console.groq.com/keys
                </a>
              </div>
              <ModelPicker
                value={groqModel}
                onChange={setGroqModel}
                suggestions={PROVIDERS.groq.models}
              />
            </>
          )}

          {/* Ollama config */}
          {provider === "ollama" && (
            <>
              <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                <p className="font-micro text-[11px] text-muted-foreground">
                  محتاج <span dir="ltr" className="font-mono">Ollama</span> متثبّت وشغّال على جهازك.
                  لو الاتصال بيترفض، شغّله بـ:
                </p>
                <code dir="ltr" className="mt-1.5 block rounded-lg bg-secondary px-2 py-1 font-mono text-[11px]">
                  OLLAMA_ORIGINS=* ollama serve
                </code>
                <div className="mt-2 flex items-center gap-1.5 font-micro text-[11px]">
                  {probing ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> بأفحص الاتصال…</>
                  ) : reachable ? (
                    <span className="flex items-center gap-1 text-emerald-500"><Check className="h-3 w-3" /> متصل — {localModels.length} موديل متاح</span>
                  ) : reachable === false ? (
                    <span className="text-amber-500">مش متصل بـ Ollama</span>
                  ) : null}
                </div>
              </div>
              <div>
                <Label className="mb-1.5">عنوان الخادم</Label>
                <Input dir="ltr" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" />
              </div>
              <ModelPicker
                value={ollamaModel}
                onChange={setOllamaModel}
                suggestions={localModels.length ? localModels : PROVIDERS.ollama.models}
              />
            </>
          )}

          {/* Image generation — default model */}
          <div className="border-t border-border/40 pt-4">
            <Label className="mb-2">نموذج توليد الصور الافتراضي</Label>
            <ImageModelPicker value={defaultImageModel} onChange={setDefaultImageModel} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/40 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
          <Button size="sm" onClick={save}>حفظ</Button>
        </div>
      </div>
    </div>
  );
}

function ModelPicker({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  return (
    <div>
      <Label className="mb-1.5">الموديل</Label>
      <Input dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} placeholder="model id" />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {suggestions.map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            dir="ltr"
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[10px] transition",
              value === m
                ? "border-primary/45 bg-primary/15 text-primary"
                : "border-border/40 bg-background/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

const IMAGE_MODEL_OPTIONS = [
  { id: "flux",            label: "FLUX — جودة عالية",   hint: "Pollinations · بدون مفتاح" },
  { id: "flux-realism",    label: "FLUX — واقعي",         hint: "Pollinations · فوتوغرافي" },
  { id: "flux-anime",      label: "FLUX — أنمي",          hint: "Pollinations · أنمي" },
  { id: "flux-3d",         label: "FLUX — ثلاثي الأبعاد", hint: "Pollinations · 3D" },
  { id: "flux-cablyai",    label: "FLUX — فني",           hint: "Pollinations · artistic" },
  { id: "sana",            label: "Sana — NVIDIA",        hint: "Pollinations · سريع" },
  { id: "turbo",           label: "Turbo — سريع",         hint: "Pollinations · SDXL Turbo" },
  { id: "cf:flux-schnell", label: "CF — FLUX Schnell",    hint: "Cloudflare AI" },
  { id: "hf:sd21",          label: "HF — SD 2.1",          hint: "Stable Diffusion 2.1" },
  { id: "hf:sd15",          label: "HF — SD 1.5",          hint: "Stable Diffusion 1.5" },
  { id: "hf:sdxl",          label: "HF — SDXL",            hint: "Stable Diffusion XL" },
];

function ImageModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {IMAGE_MODEL_OPTIONS.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2 text-start text-sm transition",
            value === m.id
              ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
              : "border-border/40 bg-background/40 text-foreground hover:bg-secondary"
          )}
        >
          <span className="font-medium">{m.label}</span>
          <span className="font-micro text-[10px] text-muted-foreground">{m.hint}</span>
        </button>
      ))}
    </div>
  );
}
