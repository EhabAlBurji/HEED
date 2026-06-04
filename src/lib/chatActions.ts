import i18n from "./i18n";
import { imagePromptUrl, generateImageViaProxy, type ImageModel } from "./imageGen";
import { useChatStore, uidChat, type ChatMsg, type ChatAttachment } from "../stores/chatStore";
import {
  streamChat,
  ChatProviderError,
  PROVIDERS,
  VISION_MODEL,
  type ChatMessage,
  type ContentPart,
} from "./chatProviders";

// Build the API message for one stored chat message, folding in attachments:
// images become image_url parts (vision), text files are prepended to the text.
function toApiMessage(m: ChatMsg): ChatMessage {
  const images = (m.attachments ?? []).filter((a) => a.kind === "image" && a.url);
  const fileText = (m.attachments ?? [])
    .filter((a) => a.kind === "file" && a.text)
    .map((a) => `\n\n--- ملف: ${a.name} ---\n${a.text}`)
    .join("");
  const text = m.content + fileText;

  // Assistant image-generation replies have empty text + an image attachment.
  // APIs reject empty-string content, so send a short placeholder instead.
  if (m.role === "assistant" && !text.trim() && images.length > 0) {
    return { role: m.role, content: "[generated image]" };
  }

  if (images.length === 0) return { role: m.role, content: text };

  // User messages with attached images → multimodal content parts (vision).
  const parts: ContentPart[] = [];
  if (text.trim()) parts.push({ type: "text", text });
  for (const img of images) parts.push({ type: "image_url", image_url: { url: img.url! } });
  return { role: m.role, content: parts };
}

// Only user-attached images trigger vision model — not AI-generated ones.
const hasImage = (m: ChatMsg) =>
  m.role === "user" && (m.attachments ?? []).some((a) => a.kind === "image");

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

export async function sendChat(
  convId: string,
  text: string,
  attachments?: ChatAttachment[]
): Promise<void> {
  const body = text.trim();
  if ((!body && !attachments?.length) || controllers.has(convId)) return;

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
    attachments: attachments?.length ? attachments : undefined,
    createdAt: Date.now(),
  };
  store.addMessage(convId, userMsg);

  // Placeholder title now; an AI-generated descriptive title replaces it once
  // the first reply lands (see generateTitle below).
  const isFirstExchange = conv.messages.length === 0;
  if (isFirstExchange) {
    store.renameConversation(convId, stripEmoji(body || attachments?.[0]?.name || "محادثة").slice(0, 40));
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

  // 3) build the request payload (folds in image/file attachments)
  const sent = [...conv.messages, userMsg].filter((m) => !m.error).slice(-HISTORY_LIMIT);
  const history = sent.map(toApiMessage);

  const messages: ChatMessage[] = [];
  const sys: string[] = [];
  if (assistant?.instructions?.trim()) sys.push(assistant.instructions.trim());
  // The plain "Heed Chat" follows the app language by default, switching to the
  // user's language whenever they write in another one.
  if (assistant?.id === "heed-default") {
    const lang = i18n.language === "en" ? "English" : "Egyptian Arabic (العامية المصرية)";
    sys.push(
      `Reply in ${lang} by default. If the user writes in a different language, reply in that language instead.`
    );
  }
  if (sys.length) messages.push({ role: "system", content: sys.join("\n\n") });
  messages.push(...history);

  // 4) resolve provider + model. Auto-switch to a vision model when an image
  // is present (hosted + Groq); Ollama keeps the user's configured model.
  const provider = store.provider;
  const imagePresent = sent.some(hasImage);
  let model =
    provider === "heed" ? store.heedModel
    : provider === "groq" ? store.groqModel
    : store.ollamaModel;
  if (imagePresent && provider !== "ollama") model = VISION_MODEL;

  const controller = new AbortController();
  controllers.set(convId, controller);

  // Typewriter reveal: network tokens land in `buffer`; a steady timer drips
  // them into the message a few characters at a time, so the reply feels typed
  // and considered rather than dumped at once. A gentle catch-up keeps it from
  // lagging far behind on fast/short replies.
  let buffer = "";
  let streamDone = false;
  let gotAny = false;
  const drainer = new Promise<void>((resolve) => {
    const tick = setInterval(() => {
      if (controller.signal.aborted) { clearInterval(tick); resolve(); return; }
      if (buffer.length) {
        const step = Math.max(2, Math.ceil(buffer.length / 60));
        useChatStore.getState().appendToMessage(convId, replyId, buffer.slice(0, step));
        buffer = buffer.slice(step);
      } else if (streamDone) {
        clearInterval(tick);
        resolve();
      }
    }, 18);
  });

  try {
    await streamChat({
      provider,
      model: model || PROVIDERS[provider].defaultModel,
      messages,
      apiKey: store.groqApiKey,
      baseUrl: store.ollamaUrl,
      signal: controller.signal,
      onToken: (delta) => { gotAny = true; buffer += delta; },
    });
    streamDone = true;
    await drainer;

    // Empty reply (rare) — leave a gentle note rather than a blank bubble.
    if (!gotAny && !controller.signal.aborted) {
      useChatStore.getState().updateMessage(convId, replyId, {
        content: i18n.language === "en" ? "…no reply. Try again." : "…مفيش رد. جرّب تبعت تاني.",
        pending: false,
      });
    } else {
      useChatStore.getState().updateMessage(convId, replyId, { pending: false });
      // Once the first reply lands, let the AI name the conversation.
      if (isFirstExchange && gotAny && !controller.signal.aborted) void generateTitle(convId);
    }
  } catch (e) {
    streamDone = true;
    await drainer;
    const err = e as Error;
    const isAbort = err?.name === "AbortError" || controller.signal.aborted;
    if (isAbort) {
      // Keep whatever streamed so far; just stop the spinner.
      useChatStore.getState().updateMessage(convId, replyId, { pending: false });
    } else {
      const hint = e instanceof ChatProviderError && e.hint ? `\n\n${e.hint}` : "";
      useChatStore.getState().updateMessage(convId, replyId, {
        content: `⚠️ ${err.message || (i18n.language === "en" ? "Something went wrong" : "حصل خطأ")}${hint}`,
        pending: false,
        error: true,
      });
    }
  } finally {
    controllers.delete(convId);
  }
}

/** Generate an image from a prompt and add it as an assistant reply.
 *  model can be a Pollinations model id ("flux", "turbo"…),
 *  or a prefixed id for other providers ("cf:flux-schnell", "hf:sdxl"…). */
export async function generateImage(convId: string, prompt: string, model: string = "flux"): Promise<void> {
  const body = prompt.trim();
  if (!body) return;
  const store = useChatStore.getState();
  const conv = store.conversations.find((c) => c.id === convId);
  if (!conv) return;

  const isFirst = conv.messages.length === 0;
  store.addMessage(convId, { id: uidChat(), role: "user", content: body, createdAt: Date.now() });
  if (isFirst) store.renameConversation(convId, stripEmoji(body).slice(0, 40));

  const isCF = model.startsWith("cf:");
  const isHF = model.startsWith("hf:");

  const replyId = uidChat();

  if (!isCF && !isHF) {
    // Pollinations — URL is ready immediately, but the image takes time to render.
    // Show a pending bubble until the browser finishes loading the image.
    const imageUrl = imagePromptUrl(body, undefined, model as ImageModel);
    const attId = uidChat();
    store.addMessage(convId, {
      id: replyId,
      role: "assistant",
      content: "",
      imageGen: true,
      pending: true,
      attachments: [{ id: attId, kind: "image", name: body, mime: "image/png", url: imageUrl }],
      createdAt: Date.now(),
    });
    // Pre-load: clear pending once the browser has the image (or fails).
    const img = new Image();
    img.onload  = () => useChatStore.getState().updateMessage(convId, replyId, { pending: false });
    img.onerror = () => useChatStore.getState().updateMessage(convId, replyId, {
      pending: false,
      error: true,
      content: i18n.language === "en"
        ? "⚠️ Image failed to load — Pollinations may be busy. Try again."
        : "⚠️ تعذّر تحميل الصورة — Pollinations مشغولة. جرّب تاني.",
      attachments: undefined,
    });
    img.src = imageUrl;
    return;
  }

  // CF / HF — async fetch; show a pending bubble while it loads.
  store.addMessage(convId, { id: replyId, role: "assistant", content: "", imageGen: true, pending: true, createdAt: Date.now() });

  try {
    const dataUrl = await generateImageViaProxy(body, model);
    store.updateMessage(convId, replyId, {
      pending: false,
      attachments: [{ id: uidChat(), kind: "image", name: body, mime: "image/png", url: dataUrl }],
    });
  } catch (e) {
    store.updateMessage(convId, replyId, {
      content: `⚠️ ${(e as Error).message || "تعذّر توليد الصورة"}`,
      pending: false,
      error: true,
    });
  }
}

/**
 * Ad-hoc streaming completion using the user's current provider settings.
 * Used by the conversational HED builder (and anything else that needs a
 * one-off stream outside a stored conversation).
 */
export async function streamAssistant(
  messages: ChatMessage[],
  onToken: (delta: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const store = useChatStore.getState();
  const provider = store.provider;
  const model =
    provider === "heed" ? store.heedModel
    : provider === "groq" ? store.groqModel
    : store.ollamaModel;
  await streamChat({
    provider,
    model: model || PROVIDERS[provider].defaultModel,
    messages,
    apiKey: store.groqApiKey,
    baseUrl: store.ollamaUrl,
    signal,
    onToken,
  });
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
  await sendChat(convId, lastUser.content, lastUser.attachments);
}

// ── AI conversation titling ─────────────────────────────────────────────────
// Strip emojis / pictographs (titles should be plain descriptive text).
export function stripEmoji(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanTitle(s: string): string {
  return stripEmoji(s)
    .replace(/^["'«»\s]+|["'«».\s]+$/g, "") // surrounding quotes / trailing dot
    .replace(/^(العنوان|title)\s*[:：]\s*/i, "")
    .slice(0, 48)
    .trim();
}

async function generateTitle(convId: string): Promise<void> {
  const conv = useChatStore.getState().conversations.find((c) => c.id === convId);
  if (!conv) return;
  const u = conv.messages.find((m) => m.role === "user");
  const a = conv.messages.find((m) => m.role === "assistant" && !m.error && m.content);
  if (!u) return;

  const prompt: ChatMessage[] = [
    {
      role: "system",
      content:
        "اكتب عنواناً قصيراً جداً (من كلمتين لخمس كلمات) يلخّص موضوع المحادثة. " +
        "بنفس لغة المحادثة. بدون علامات اقتباس، بدون إيموجي، وبدون نقطة في الآخر. اكتب العنوان فقط.",
    },
    {
      role: "user",
      content: `رسالة المستخدم: ${u.content.slice(0, 400)}\n${a ? `رد المساعد: ${a.content.slice(0, 300)}` : ""}\n\nالعنوان:`,
    },
  ];

  let title = "";
  try {
    await streamAssistant(prompt, (d) => { title += d; });
  } catch {
    return; // keep the placeholder title on failure
  }
  const clean = cleanTitle(title);
  if (clean) useChatStore.getState().renameConversation(convId, clean);
}
