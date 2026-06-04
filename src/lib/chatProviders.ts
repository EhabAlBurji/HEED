// =========================================================================
// HEED CHAT — LLM provider layer
// =========================================================================
// One streaming interface (`streamChat`) over two free backends:
//   • Groq   — online, free API, fast OpenAI-compatible hosted models.
//   • Ollama — offline, runs models locally on the user's machine.
// The rest of the app only ever sees ChatMessage[] in / token deltas out, so
// swapping or adding a provider later is a change isolated to this file.
// =========================================================================

export type ChatRole = "system" | "user" | "assistant";

/** OpenAI-style multimodal content parts (text + images). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[];
}

/** Vision-capable model used automatically when a message includes an image. */
export const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export type ProviderId = "heed" | "groq" | "ollama";

export interface ProviderInfo {
  id: ProviderId;
  /** Short label for the picker. */
  label: string;
  /** Whether it needs the internet (true) or runs locally (false). */
  online: boolean;
  /** Curated model list shown as suggestions (the user can still type any id). */
  models: string[];
  defaultModel: string;
}

// Models the hosted proxy accepts (must match the Edge Function whitelist).
const HOSTED_MODELS = [
  // Groq / Llama
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b",
  "deepseek-r1-distill-llama-70b",
  // Google Gemini
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  heed: {
    id: "heed",
    label: "Heed — جاهز · مجاني",
    online: true,
    models: HOSTED_MODELS,
    defaultModel: "gemini-2.0-flash",
  },
  groq: {
    id: "groq",
    label: "Groq — أونلاين · مجاني",
    online: true,
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3-32b",
      "deepseek-r1-distill-llama-70b",
    ],
    defaultModel: "llama-3.3-70b-versatile",
  },
  ollama: {
    id: "ollama",
    label: "Ollama — أوفلاين · محلي",
    online: false,
    models: ["llama3.2", "llama3.1", "qwen2.5", "mistral", "phi3", "gemma2"],
    defaultModel: "llama3.2",
  },
};

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface StreamOptions {
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  /** Required for Groq. */
  apiKey?: string;
  /** Ollama base url. Defaults to http://localhost:11434. */
  baseUrl?: string;
  temperature?: number;
  signal?: AbortSignal;
  /** Called with each new chunk of text as it streams in. */
  onToken: (delta: string) => void;
}

/** A typed error so the UI can show a helpful hint per provider. */
export class ChatProviderError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "ChatProviderError";
  }
}

// ── Public entry point ─────────────────────────────────────────────────────
export async function streamChat(opts: StreamOptions): Promise<void> {
  if (opts.provider === "heed") return streamHeed(opts);
  if (opts.provider === "groq") return streamGroq(opts);
  return streamOllama(opts);
}

// ── Heed hosted proxy (Supabase Edge Function holds the key) ────────────────
async function streamHeed(opts: StreamOptions): Promise<void> {
  // Lazy import to keep the provider layer free of app-wide deps at module load.
  const { getSupabase, supabaseUrl, supabaseAnonKey } = await import("./supabase");

  // Prefer the signed-in user's token (lets us attribute usage later); fall back
  // to the public anon key, which is itself a valid project JWT — so the proxy
  // works even for guests or when the session isn't ready yet.
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token || supabaseAnonKey;

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
      }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    throw new ChatProviderError(
      "تعذّر الاتصال بخادم Heed",
      "اتأكد من اتصالك بالإنترنت وحاول تاني."
    );
  }

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    throw new ChatProviderError(
      `خادم Heed رجّع خطأ (${res.status})`,
      res.status === 404
        ? "خدمة الشات لسه مش منشورة على السيرفر."
        : detail || undefined
    );
  }

  // Same OpenAI-style SSE the Edge Function forwards from Groq.
  await readSSE(res.body, opts.signal, (json) => {
    const delta = json?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) opts.onToken(delta);
  });
}

// ── Groq (OpenAI-compatible SSE) ───────────────────────────────────────────
async function streamGroq(opts: StreamOptions): Promise<void> {
  const key = opts.apiKey?.trim();
  if (!key) {
    throw new ChatProviderError(
      "مفيش مفتاح Groq",
      "افتح إعدادات الشات وحط مفتاح Groq المجاني من console.groq.com/keys"
    );
  }

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        stream: true,
      }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    throw new ChatProviderError(
      "تعذّر الاتصال بـ Groq",
      "اتأكد من اتصالك بالإنترنت وحاول تاني."
    );
  }

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    throw new ChatProviderError(
      `Groq رجّع خطأ (${res.status})`,
      res.status === 401
        ? "المفتاح غلط أو منتهي — جدّده من console.groq.com/keys"
        : detail || undefined
    );
  }

  // SSE: lines of `data: {json}` terminated by `data: [DONE]`.
  await readSSE(res.body, opts.signal, (json) => {
    const delta = json?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) opts.onToken(delta);
  });
}

// ── Ollama (newline-delimited JSON) ────────────────────────────────────────
async function streamOllama(opts: StreamOptions): Promise<void> {
  const base = (opts.baseUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");

  let res: Response;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages.map(toOllamaMessage),
        stream: true,
        options: { temperature: opts.temperature ?? 0.7 },
      }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    throw new ChatProviderError(
      "تعذّر الاتصال بـ Ollama المحلي",
      "اتأكد إن Ollama شغّال. لو الواجهة بتترفض، شغّله بـ:\nOLLAMA_ORIGINS=* ollama serve"
    );
  }

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    throw new ChatProviderError(
      `Ollama رجّع خطأ (${res.status})`,
      res.status === 404
        ? `الموديل "${opts.model}" مش متحمّل. نزّله بـ: ollama pull ${opts.model}`
        : detail || undefined
    );
  }

  await readJSONLines(res.body, opts.signal, (obj) => {
    const delta = obj?.message?.content;
    if (typeof delta === "string" && delta) opts.onToken(delta);
  });
}

// Ollama uses a different multimodal shape: { content, images: [base64] }.
function toOllamaMessage(m: ChatMessage): Record<string, unknown> {
  if (typeof m.content === "string") return { role: m.role, content: m.content };
  const text = m.content.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
  const images = m.content
    .filter((p) => p.type === "image_url")
    .map((p) => (p as { image_url: { url: string } }).image_url.url.replace(/^data:[^;]+;base64,/, ""));
  return images.length ? { role: m.role, content: text, images } : { role: m.role, content: text };
}

// ── Voice transcription (Groq Whisper, via proxy or direct) ─────────────────
export async function transcribeAudio(
  blob: Blob,
  opts: { provider: ProviderId; apiKey?: string }
): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "voice.webm");

  // BYOK Groq → call Groq directly; otherwise go through the Heed proxy.
  if (opts.provider === "groq" && opts.apiKey?.trim()) {
    form.append("model", "whisper-large-v3-turbo");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey.trim()}` },
      body: form,
    });
    if (!res.ok) throw new ChatProviderError("تعذّر تفريغ الصوت", await safeText(res));
    return (await res.json())?.text ?? "";
  }

  const { getSupabase, supabaseUrl, supabaseAnonKey } = await import("./supabase");
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token || supabaseAnonKey;

  const res = await fetch(`${supabaseUrl}/functions/v1/transcribe`, {
    method: "POST",
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new ChatProviderError("تعذّر تفريغ الصوت", await safeText(res));
  return (await res.json())?.text ?? "";
}

// ── List locally-installed Ollama models (for the model picker) ─────────────
export async function listOllamaModels(baseUrl = DEFAULT_OLLAMA_URL): Promise<string[]> {
  try {
    const base = baseUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.models ?? []).map((m: { name: string }) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Stream parsers ─────────────────────────────────────────────────────────
async function readSSE(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  onJSON: (json: any) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || !line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          onJSON(JSON.parse(payload));
        } catch {
          /* partial line — ignore */
        }
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* noop */ }
  }
}

async function readJSONLines(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  onJSON: (json: any) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        try {
          onJSON(JSON.parse(line));
        } catch {
          /* partial line — ignore */
        }
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* noop */ }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    // Surface the API's own message if it's JSON {error:{message}}.
    try {
      const j = JSON.parse(t);
      return j?.error?.message ?? t.slice(0, 200);
    } catch {
      return t.slice(0, 200);
    }
  } catch {
    return "";
  }
}
