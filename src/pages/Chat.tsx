import { useEffect, useState } from "react";
import { Sparkles, ChevronDown, Settings as SettingsIcon, Wifi, WifiOff } from "lucide-react";
import { cn } from "../lib/utils";
import { useChatStore, type ChatAssistant } from "../stores/chatStore";
import { sendChat, stopChat, isStreaming } from "../lib/chatActions";
import { PROVIDERS } from "../lib/chatProviders";
import { ConversationSidebar } from "../components/chat/ConversationSidebar";
import { MessageThread } from "../components/chat/MessageThread";
import { Composer } from "../components/chat/Composer";
import { AssistantGallery } from "../components/chat/AssistantGallery";
import { AssistantEditor } from "../components/chat/AssistantEditor";
import { ChatSettingsModal } from "../components/chat/ChatSettingsModal";

// =========================================================================
// HEED CHAT — page. ChatGPT-style: conversation rail + thread + composer,
// with a Custom-GPT gallery and per-provider settings.
// =========================================================================

export default function Chat() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const assistants = useChatStore((s) => s.assistants);
  const setActive = useChatStore((s) => s.setActive);
  const newConversation = useChatStore((s) => s.newConversation);
  const provider = useChatStore((s) => s.provider);

  const [gallery, setGallery] = useState(false);
  const [settings, setSettings] = useState(false);
  const [editor, setEditor] = useState<{ assistant: ChatAssistant | null } | null>(null);
  const [assistantMenu, setAssistantMenu] = useState(false);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeAssistant =
    assistants.find((a) => a.id === active?.assistantId) ??
    assistants.find((a) => a.id === "heed-default") ??
    assistants[0];

  // Ensure there's always a conversation selected to type into.
  useEffect(() => {
    if (!active && conversations.length > 0) setActive(conversations[0].id);
  }, [active, conversations, setActive]);

  // Re-render while streaming so the Stop button / composer state stays live.
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [active]);

  const startWith = (assistantId: string, firstMessage?: string) => {
    const id = newConversation(assistantId);
    if (firstMessage) void sendChat(id, firstMessage);
  };

  const handleSend = (text: string) => {
    if (active) {
      void sendChat(active.id, text);
    } else {
      const id = newConversation(activeAssistant?.id ?? "heed-default");
      void sendChat(id, text);
    }
  };

  const streaming = active ? isStreaming(active.id) : false;
  const providerInfo = PROVIDERS[provider];

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationSidebar
        onNewChat={() => startWith(activeAssistant?.id ?? "heed-default")}
        onOpenGallery={() => setGallery(true)}
        onOpenSettings={() => setSettings(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header: current assistant + provider badge */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <div className="relative">
            <button
              onClick={() => setAssistantMenu((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-secondary"
            >
              <span className="text-lg">{activeAssistant?.emoji}</span>
              <span className="text-sm font-semibold">{activeAssistant?.name}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition", assistantMenu && "rotate-180")} />
            </button>
            {assistantMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAssistantMenu(false)} />
                <div className="absolute start-0 top-full z-50 mt-1 w-64 rounded-xl border border-border/60 bg-card p-1.5 shadow-2xl">
                  <p className="px-2 py-1 font-micro text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    ابدأ محادثة مع
                  </p>
                  {assistants.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { startWith(a.id); setAssistantMenu(false); }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition hover:bg-secondary"
                    >
                      <span className="text-base">{a.emoji}</span>
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    </button>
                  ))}
                  <div className="my-1 h-px bg-border/40" />
                  <button
                    onClick={() => { setGallery(true); setAssistantMenu(false); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm text-primary transition hover:bg-secondary"
                  >
                    <Sparkles className="h-4 w-4" /> كل المساعدين
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setSettings(true)}
            className="flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 font-micro text-[11px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title="إعدادات الشات"
          >
            {providerInfo.online ? <Wifi className="h-3 w-3 text-emerald-500" /> : <WifiOff className="h-3 w-3 text-amber-500" />}
            <span dir="ltr">{provider === "groq" ? "Groq" : "Ollama"}</span>
            <SettingsIcon className="h-3 w-3" />
          </button>
        </div>

        {/* Thread + composer */}
        {active && activeAssistant ? (
          <>
            <MessageThread
              conversation={active}
              assistant={activeAssistant}
              onStarter={(t) => handleSend(t)}
            />
            <Composer
              streaming={streaming}
              onSend={handleSend}
              onStop={() => active && stopChat(active.id)}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-4xl">
              {activeAssistant?.emoji ?? "✨"}
            </div>
            <h2 className="font-display text-xl font-bold">HEED CHAT</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              ابدأ محادثة جديدة أو اختر مساعد من المعرض.
            </p>
            <Composer streaming={false} onSend={handleSend} onStop={() => {}} />
          </div>
        )}
      </div>

      {/* Overlays */}
      {gallery && (
        <AssistantGallery
          onClose={() => setGallery(false)}
          onPick={(a) => { startWith(a.id); setGallery(false); }}
          onCreate={() => { setGallery(false); setEditor({ assistant: null }); }}
          onEdit={(a) => { setGallery(false); setEditor({ assistant: a }); }}
        />
      )}
      {editor && (
        <AssistantEditor assistant={editor.assistant} onClose={() => setEditor(null)} />
      )}
      {settings && <ChatSettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}
