import { useChatStore, uidChat, type ChatMsg } from "../stores/chatStore";
import {
  streamChat,
  ChatProviderError,
  PROVIDERS,
  type ChatMessage,
} from "./chatProviders";

// =========================================================================
// HEED CHAT — send / stop orchestration
// =========================================================================
// Glues the store to the provider layer: builds the message array (system
// prompt from the active assistant + history), streams the reply token-by-
// token into the store, auto-titles the first exchange, and exposes a stop().
// =========================================================================

// One in-flight request per conversation so Stop can abort it.
const controllers = new Map<string, AbortController>();

export function isStreaming(convId: string): boolean {
  return controllers.has(convId);
}

export function stopChat(convId: string): void {
  controllers.get(convId)?.abort();
  controllers.delete(convId);
}

/** How many past messages to send as context (keeps requests cheap/fast). */
const HISTORY_LIMIT = 20;

export async function sendChat(convId: string, text: string): Promise<void> {
  const body = text.trim();
  if (!body || controllers.has(convId)) return;

  const store = useChatStore.getState();
  const conv = store.conversations.find((c) => c.id === convId);
  if (!conv) return;

  const assistant =
    store.assistants.find((a) => a.id === conv.assistantId) ??
    store.assistants.find((a) => a.id === "heed-default");

  // 1) push the user's message
  const userMsg: ChatMsg = {
    id: uidChat(),
    role: "user",
    content: body,
    createdAt: Date.now(),
  };
  store.addMessage(convId, userMsg);

  // Auto-title from the first user message.
  if (conv.messages.length === 0) {
    store.renameConversation(convId, body.slice(0, 40));
  }

  // 2) push an empty assistant message we'll stream into
  const replyId = uidChat();
  store.addMessage(convId, {
    id: replyId,
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    pending: true,
  });

  // 3) build the request payload
  const history = [...conv.messages, userMsg]
    .filter((m) => !m.error)
    .slice(-HISTORY_LIMIT)
    .map<ChatMessage>((m) => ({ role: m.role, content: m.content }));

  const messages: ChatMessage[] = [];
  if (assistant?.instructions?.trim()) {
    messages.push({ role: "system", content: assistant.instructions.trim() });
  }
  messages.push(...history);

  // 4) resolve provider settings
  const provider = store.provider;
  const model = provider === "groq" ? store.groqModel : store.ollamaModel;

  const controller = new AbortController();
  controllers.set(convId, controller);

  try {
    let gotAny = false;
    await streamChat({
      provider,
      model: model || PROVIDERS[provider].defaultModel,
      messages,
      apiKey: store.groqApiKey,
      baseUrl: store.ollamaUrl,
      signal: controller.signal,
      onToken: (delta) => {
        gotAny = true;
        useChatStore.getState().appendToMessage(convId, replyId, delta);
      },
    });

    // Empty reply (rare) — leave a gentle note rather than a blank bubble.
    if (!gotAny && !controller.signal.aborted) {
      useChatStore.getState().updateMessage(convId, replyId, {
        content: "…مفيش رد. جرّب تبعت تاني.",
        pending: false,
      });
    } else {
      useChatStore.getState().updateMessage(convId, replyId, { pending: false });
    }
  } catch (e) {
    const err = e as Error;
    const isAbort = err?.name === "AbortError" || controller.signal.aborted;
    if (isAbort) {
      // Keep whatever streamed so far; just stop the spinner.
      useChatStore.getState().updateMessage(convId, replyId, { pending: false });
    } else {
      const hint = e instanceof ChatProviderError && e.hint ? `\n\n${e.hint}` : "";
      useChatStore.getState().updateMessage(convId, replyId, {
        content: `⚠️ ${err.message || "حصل خطأ"}${hint}`,
        pending: false,
        error: true,
      });
    }
  } finally {
    controllers.delete(convId);
  }
}

/** Re-run the last user message (e.g. after an error). Drops the last reply. */
export async function regenerate(convId: string): Promise<void> {
  const store = useChatStore.getState();
  const conv = store.conversations.find((c) => c.id === convId);
  if (!conv || controllers.has(convId)) return;

  // find the last user message and trim everything after it
  let lastUserIdx = -1;
  for (let i = conv.messages.length - 1; i >= 0; i--) {
    if (conv.messages[i].role === "user") { lastUserIdx = i; break; }
  }
  if (lastUserIdx === -1) return;

  const lastUser = conv.messages[lastUserIdx];
  const kept = conv.messages.slice(0, lastUserIdx);
  useChatStore.setState((s) => ({
    conversations: s.conversations.map((c) =>
      c.id === convId ? { ...c, messages: kept } : c
    ),
  }));
  await sendChat(convId, lastUser.content);
}
