import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "../lib/safeStorage";
import { PROVIDERS, DEFAULT_OLLAMA_URL, type ProviderId } from "../lib/chatProviders";

// =========================================================================
// HEED CHAT — local store
// =========================================================================
// Conversations, messages and Custom-GPT-style assistants live here, plus the
// per-user provider settings (which backend, API key, model). Persisted to
// localStorage only — chat history is personal, so it stays on-device (no
// Supabase sync, mirroring how UI prefs are kept local).
// =========================================================================

const uid = () => crypto.randomUUID();

export interface ChatAssistant {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** System prompt — what makes this a "Custom GPT". */
  instructions: string;
  /** Optional conversation starters shown on an empty thread. */
  starters: string[];
  /** Seeded defaults can't be deleted, only duplicated. */
  builtin?: boolean;
  createdAt: number;
}

export interface ChatAttachment {
  id: string;
  kind: "image" | "file";
  name: string;
  mime: string;
  /** Data URL — for images (shown + sent to a vision model). */
  url?: string;
  /** Extracted text — for text files (prepended to the prompt). */
  text?: string;
  size?: number;
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  /** Images / files attached to a user message. */
  attachments?: ChatAttachment[];
  /** True while the assistant reply is still streaming. */
  pending?: boolean;
  /** True if this message is an error notice rather than a real reply. */
  error?: boolean;
  /** True for AI-generated image messages (distinct from chat streaming). */
  imageGen?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  assistantId: string;
  messages: ChatMsg[];
  createdAt: number;
  updatedAt: number;
}

// ── Built-in assistants (the "Custom GPT" gallery starts with these) ────────
const BUILTIN_ASSISTANTS: ChatAssistant[] = [
  {
    id: "heed-default",
    name: "Heed Assistant",
    emoji: "✨",
    description: "مساعد عام ذكي يساعدك في أي حاجة",
    instructions:
      "أنت مساعد Heed الذكي. ساعد المستخدم بإجابات واضحة ومباشرة ومفيدة. لو السؤال بالعربي رد بالعربي، ولو بالإنجليزي رد بالإنجليزي.",
    starters: ["لخّصلي النص ده", "اكتبلي إيميل احترافي", "اشرحلي فكرة بطريقة بسيطة"],
    builtin: true,
    createdAt: 0,
  },
  {
    id: "heed-writer",
    name: "كاتب المحتوى",
    emoji: "✍️",
    description: "يكتب بوستات وإعلانات ومحتوى تسويقي",
    instructions:
      "أنت كاتب محتوى تسويقي محترف. اكتب محتوى جذّاب ومختصر ومناسب للسوشيال ميديا. اقترح دايماً أكثر من نسخة لو ينفع.",
    starters: ["اكتب بوست لينكدإن عن…", "3 أفكار لإعلان عن…", "هاشتاجات لـ…"],
    builtin: true,
    createdAt: 0,
  },
  {
    id: "heed-coder",
    name: "مساعد البرمجة",
    emoji: "💻",
    description: "يشرح ويكتب ويصلّح الكود",
    instructions:
      "أنت مهندس برمجيات خبير. اكتب كوداً نظيفاً مع شرح مختصر. استخدم code blocks دايماً للكود. لو فيه أكثر من حل، وضّح المفاضلة بإيجاز.",
    starters: ["اشرحلي الكود ده", "صلّحلي الباج ده", "اكتبلي function تعمل…"],
    builtin: true,
    createdAt: 0,
  },
];

type ChatSettings = {
  provider: ProviderId;
  /** Model used by the hosted (free, no-key) Heed proxy. */
  heedModel: string;
  groqApiKey: string;
  groqModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  /** Default image generation model shown in Composer when image mode is active. */
  defaultImageModel: string;
};

type ChatState = ChatSettings & {
  setSettings: (patch: Partial<ChatSettings>) => void;

  assistants: ChatAssistant[];
  upsertAssistant: (a: Partial<ChatAssistant> & { id?: string }) => ChatAssistant;
  deleteAssistant: (id: string) => void;

  conversations: Conversation[];
  activeId: string | null;
  setActive: (id: string | null) => void;
  newConversation: (assistantId: string) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  clearConversation: (id: string) => void;

  addMessage: (convId: string, msg: ChatMsg) => void;
  updateMessage: (convId: string, msgId: string, patch: Partial<ChatMsg>) => void;
  appendToMessage: (convId: string, msgId: string, delta: string) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // ── settings ──────────────────────────────────────────────────────
      // Default to the hosted proxy: zero setup, no key needed by the user.
      provider: "heed",
      heedModel: PROVIDERS.heed.defaultModel,
      groqApiKey: "",
      groqModel: PROVIDERS.groq.defaultModel,
      ollamaUrl: DEFAULT_OLLAMA_URL,
      ollamaModel: PROVIDERS.ollama.defaultModel,
      defaultImageModel: "cf:flux-schnell",
      setSettings: (patch) => set(patch),

      // ── assistants ────────────────────────────────────────────────────
      assistants: BUILTIN_ASSISTANTS,
      upsertAssistant: (a) => {
        const now = Date.now();
        const existing = a.id ? get().assistants.find((x) => x.id === a.id) : undefined;
        const merged: ChatAssistant = {
          id: existing?.id ?? uid(),
          name: a.name ?? existing?.name ?? "مساعد جديد",
          emoji: a.emoji ?? existing?.emoji ?? "🤖",
          description: a.description ?? existing?.description ?? "",
          instructions: a.instructions ?? existing?.instructions ?? "",
          starters: a.starters ?? existing?.starters ?? [],
          builtin: existing?.builtin,
          createdAt: existing?.createdAt ?? now,
        };
        set((s) => ({
          assistants: existing
            ? s.assistants.map((x) => (x.id === merged.id ? merged : x))
            : [...s.assistants, merged],
        }));
        return merged;
      },
      deleteAssistant: (id) =>
        set((s) => ({
          assistants: s.assistants.filter((a) => a.id !== id || !!a.builtin),
          // conversations bound to a deleted assistant fall back to the default
          conversations: s.conversations.map((c) =>
            c.assistantId === id ? { ...c, assistantId: "heed-default" } : c
          ),
        })),

      // ── conversations ─────────────────────────────────────────────────
      conversations: [],
      activeId: null,
      setActive: (id) => set({ activeId: id }),
      newConversation: (assistantId) => {
        const id = uid();
        const now = Date.now();
        const conv: Conversation = {
          id,
          title: "محادثة جديدة",
          assistantId,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ conversations: [conv, ...s.conversations], activeId: id }));
        return id;
      },
      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          return {
            conversations,
            activeId: s.activeId === id ? conversations[0]?.id ?? null : s.activeId,
          };
        }),
      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title: title.trim() || c.title } : c
          ),
        })),
      clearConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, messages: [], updatedAt: Date.now() } : c
          ),
        })),

      // ── messages ──────────────────────────────────────────────────────
      addMessage: (convId, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
              : c
          ),
        })),
      updateMessage: (convId, msgId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),
      appendToMessage: (convId, msgId, delta) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + delta } : m
                  ),
                }
              : c
          ),
        })),
    }),
    {
      name: "heed:chat",
      storage: safeJSONStorage(),
      // Never persist the Groq API key — it lives in memory only (sessionStorage
      // is also unsafe given XSS; the user re-enters it each session from Settings).
      partialize: (s) => {
        const { groqApiKey: _key, ...rest } = s;
        return rest;
      },
      // Re-seed any built-in assistants the user doesn't have yet so updates
      // ship new built-ins without wiping custom ones.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChatState>;
        const saved = p.assistants ?? [];
        const missingBuiltins = BUILTIN_ASSISTANTS.filter(
          (b) => !saved.some((a) => a.id === b.id)
        );
        return {
          ...current,
          ...p,
          groqApiKey: "",  // always start blank — never read from storage
          assistants: [...missingBuiltins, ...saved],
        };
      },
    }
  )
);

export const uidChat = uid;
