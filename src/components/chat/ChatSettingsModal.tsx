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
  const [groqApiKey, setGroqApiKey] = useState(s.groqApiKey);
  const [groqModel, setGroqModel] = useState(s.groqModel);
  const [ollamaUrl, setOllamaUrl] = useState(s.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(s.ollamaModel);

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
    s.setSettings({ provider, groqApiKey: groqApiKey.trim(), groqModel, ollamaUrl: ollamaUrl.trim(), ollamaModel });
    onClose();
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
            <div className="grid grid-cols-2 gap-2">
              {(Object.values(PROVIDERS)).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-start transition",
                    provider === p.id ? "border-primary bg-primary/5" : "border-border/50 hover:bg-secondary"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {p.online ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-amber-500" />}
                    {p.id === "groq" ? "Groq" : "Ollama"}
                  </span>
                  <span className="font-micro text-[10px] text-muted-foreground">
                    {p.online ? "أونلاين · مجاني · سريع" : "أوفلاين · محلي · خصوصية"}
                  </span>
                </button>
              ))}
            </div>
          </div>

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
