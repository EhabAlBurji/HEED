import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { SquarePen, PanelLeft } from "lucide-react";
import { useChatStore, type ChatAssistant, type ChatAttachment } from "../stores/chatStore";
import { useAuthStore } from "../stores/authStore";
import { useIsMobile } from "../hooks/useIsMobile";
import { sendChat, stopChat, isStreaming, generateImage } from "../lib/chatActions";
import { ConversationSidebar } from "../components/chat/ConversationSidebar";
import { MessageThread } from "../components/chat/MessageThread";
import { Composer } from "../components/chat/Composer";
import { AssistantGallery } from "../components/chat/AssistantGallery";
import { AssistantEditor } from "../components/chat/AssistantEditor";
import { ChatSettingsModal } from "../components/chat/ChatSettingsModal";

// =========================================================================
// HEED CHAT — page. ChatGPT-style: collapsible history rail + thread/welcome
// + composer. Opens on a fresh, plain chat each visit (history in the rail).
// =========================================================================

// Varied greetings for a fresh chat — follow the app language (en / ar-Egyptian).
const GREETINGS_AR: Array<(n: string) => string> = [
  (n) => (n ? `أهلاً ${n}، يلا نبدع النهاردة!` : "يلا نبدع النهاردة!"),
  (n) => (n ? `نورت يا ${n}، نبدأ بإيه؟` : "نبدأ بإيه؟"),
  (n) => (n ? `مستعد يا ${n}؟ يلا نصنع حاجة جامدة!` : "مستعد؟ يلا نصنع حاجة جامدة!"),
  (n) => (n ? `${n}، إيه اللي في دماغك النهاردة؟` : "إيه اللي في دماغك النهاردة؟"),
  (n) => (n ? `أهلاً بيك يا ${n}، الأفكار مستنياك!` : "الأفكار مستنياك!"),
  (n) => (n ? `يلا يا ${n}، نخلي النهاردة يوم مميز!` : "نخلي النهاردة يوم مميز!"),
  (n) => (n ? `${n}، خلينا نحوّل فكرتك لحقيقة!` : "خلينا نحوّل فكرتك لحقيقة!"),
  (n) => (n ? `تمام يا ${n}؟ يلا نشتغل على حاجة حلوة!` : "يلا نشتغل على حاجة حلوة!"),
  (n) => (n ? `أهلاً ${n}، عايز نبدأ منين؟` : "عايز نبدأ منين؟"),
  (n) => (n ? `${n}، جاهز نعمل حاجة تبهر؟` : "جاهز نعمل حاجة تبهر؟"),
  (n) => (n ? `نورت المكان يا ${n}، نبدع سوا؟` : "نبدع سوا؟"),
  (n) => (n ? `يلا يا ${n}، الإبداع مستنيك!` : "الإبداع مستنيك!"),
  (n) => (n ? `${n}، إيه المشروع اللي هنكسّر بيه الدنيا؟` : "إيه المشروع اللي هنكسّر بيه الدنيا؟"),
  (n) => (n ? `أهلاً بيك يا ${n}، يلا نطلّع أحلى حاجة!` : "يلا نطلّع أحلى حاجة!"),
  (n) => (n ? `${n}، خلينا نبدأ مغامرة جديدة!` : "خلينا نبدأ مغامرة جديدة!"),
  (n) => (n ? `مستني أمرك يا ${n}، نعمل إيه؟` : "نعمل إيه؟"),
  (n) => (n ? `${n}، فكرتك الجاية ممكن تكون الأحلى!` : "فكرتك الجاية ممكن تكون الأحلى!"),
  (n) => (n ? `أهلاً ${n}، يلا نشتغل بحماس!` : "يلا نشتغل بحماس!"),
  (n) => (n ? `${n}، النهاردة يومك تعمل فيه حاجة عظيمة!` : "النهاردة يومك تعمل فيه حاجة عظيمة!"),
  (n) => (n ? `نورت يا ${n}، يلا نبني سوا!` : "يلا نبني سوا!"),
  (n) => (n ? `${n}، إيه الحلم اللي هنحققه دلوقتي؟` : "إيه الحلم اللي هنحققه دلوقتي؟"),
  (n) => (n ? `أهلاً بيك يا ${n}، الورقة البيضا مستنياك!` : "الورقة البيضا مستنياك!"),
  (n) => (n ? `يلا يا ${n}، نطلّع الإبداع اللي جواك!` : "نطلّع الإبداع اللي جواك!"),
  (n) => (n ? `${n}، جاهز نبدأ؟ أنا معاك!` : "جاهز نبدأ؟ أنا معاك!"),
  (n) => (n ? `أهلاً ${n}، خلينا نعمل حاجة متتنسيش!` : "خلينا نعمل حاجة متتنسيش!"),
];
const GREETINGS_EN: Array<(n: string) => string> = [
  (n) => (n ? `Hey ${n}, let's create something!` : "Let's create something!"),
  (n) => (n ? `Welcome back, ${n} — what are we building today?` : "What are we building today?"),
  (n) => (n ? `Ready, ${n}? Let's make magic!` : "Ready? Let's make magic!"),
  (n) => (n ? `${n}, what's on your mind today?` : "What's on your mind today?"),
  (n) => (n ? `Let's get started, ${n}!` : "Let's get started!"),
  (n) => (n ? `Hi ${n}, your next big idea starts here!` : "Your next big idea starts here!"),
  (n) => (n ? `${n}, let's turn ideas into reality!` : "Let's turn ideas into reality!"),
  (n) => (n ? `Welcome, ${n} — let's do something amazing!` : "Let's do something amazing!"),
  (n) => (n ? `Hey ${n}, where should we begin?` : "Where should we begin?"),
  (n) => (n ? `${n}, let's build something awesome!` : "Let's build something awesome!"),
  (n) => (n ? `Good to see you, ${n}! Ready to create?` : "Ready to create?"),
  (n) => (n ? `${n}, the blank page is waiting for you!` : "The blank page is waiting for you!"),
  (n) => (n ? `Let's make today count, ${n}!` : "Let's make today count!"),
  (n) => (n ? `Hi ${n}, what are we making?` : "What are we making?"),
  (n) => (n ? `${n}, your imagination starts here!` : "Your imagination starts here!"),
  (n) => (n ? `Welcome, ${n} — let's bring your vision to life!` : "Let's bring your vision to life!"),
  (n) => (n ? `Hey ${n}, let's get those ideas flowing!` : "Let's get those ideas flowing!"),
  (n) => (n ? `${n}, ready to make something great?` : "Ready to make something great?"),
  (n) => (n ? `Let's dive in, ${n}!` : "Let's dive in!"),
  (n) => (n ? `Hi ${n}, adventure awaits — what's first?` : "Adventure awaits — what's first?"),
  (n) => (n ? `${n}, let's create something unforgettable!` : "Let's create something unforgettable!"),
  (n) => (n ? `Welcome back, ${n} — let's pick up where the genius left off!` : "Let's pick up where the genius left off!"),
  (n) => (n ? `Hey ${n}, the possibilities are endless!` : "The possibilities are endless!"),
  (n) => (n ? `${n}, let's make something you'll love!` : "Let's make something you'll love!"),
  (n) => (n ? `Ready when you are, ${n} — let's go!` : "Ready when you are — let's go!"),
];
const pickGreet = () => Math.floor(Math.random() * GREETINGS_AR.length);

export default function Chat() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const isMobile = useIsMobile();

  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const assistants = useChatStore((s) => s.assistants);
  const setActive = useChatStore((s) => s.setActive);
  const newConversation = useChatStore((s) => s.newConversation);
  const user = useAuthStore((s) => s.user);

  const [gallery, setGallery] = useState(false);
  const [settings, setSettings] = useState(false);
  const [editor, setEditor] = useState<{ assistant: ChatAssistant | null } | null>(null);
  const [histOpen, setHistOpen] = useState(!isMobile);
  const [histWidth, setHistWidth] = useState(288);
  const [draftAssistantId, setDraftAssistantId] = useState("heed-default");
  const [greetIdx, setGreetIdx] = useState(pickGreet);

  // Drag the divider to resize the conversation rail (RTL-aware).
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = histWidth;
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const w = isAr ? startW - delta : startW + delta;
      setHistWidth(Math.max(220, Math.min(440, w)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // History rail is open on desktop, collapsed (overlay) on phones.
  useEffect(() => setHistOpen(!isMobile), [isMobile]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const isDefault = (active ? active.assistantId : draftAssistantId) === "heed-default";
  const activeAssistant =
    assistants.find((a) => a.id === (active ? active.assistantId : draftAssistantId)) ??
    assistants.find((a) => a.id === "heed-default") ??
    assistants[0];

  // Fresh, empty chat every time the page is opened (history stays in the rail).
  useEffect(() => { setActive(null); }, [setActive]);

  // Re-render while streaming so the Stop button / composer state stays live.
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [active]);

  const newChat = (assistantId?: string) => {
    if (assistantId) setDraftAssistantId(assistantId);
    setGreetIdx(pickGreet());
    setActive(null);
    if (isMobile) setHistOpen(false);
  };

  const handleSend = (text: string, attachments?: ChatAttachment[]) => {
    if (active) {
      void sendChat(active.id, text, attachments);
    } else {
      const id = newConversation(draftAssistantId);
      void sendChat(id, text, attachments);
    }
  };

  const handleImage = (prompt: string, model?: string) => {
    const imgModel = model ?? "flux";
    if (active) {
      void generateImage(active.id, prompt, imgModel);
    } else {
      const id = newConversation(draftAssistantId);
      void generateImage(id, prompt, imgModel);
    }
  };

  const streaming = active ? isStreaming(active.id) : false;
  const hasThread = !!active && active.messages.length > 0;
  const firstName = (user?.name || user?.email?.split("@")[0] || "").split(" ")[0].trim();
  const greet = (isAr ? GREETINGS_AR : GREETINGS_EN)[greetIdx % GREETINGS_AR.length](firstName);

  // Starter chips: bilingual defaults for the plain chat, the HED's own otherwise.
  const defaultStarters = isAr
    ? ["لخّصلي النص ده", "اكتبلي إيميل احترافي", "اشرحلي فكرة بطريقة بسيطة", "ساعدني أعمل خطة"]
    : ["Summarize this text", "Write a professional email", "Explain an idea simply", "Help me draft a plan"];
  const chips = isDefault ? defaultStarters : activeAssistant?.starters ?? [];

  const sidebar = (
    <ConversationSidebar
      onNewChat={() => newChat(activeAssistant?.id ?? "heed-default")}
      onOpenGallery={() => setGallery(true)}
      onOpenSettings={() => setSettings(true)}
      onNavigate={isMobile ? () => setHistOpen(false) : undefined}
      onCollapse={() => setHistOpen(false)}
    />
  );

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* History rail — resizable on desktop, overlay drawer on mobile */}
      {isMobile ? (
        histOpen && (
          <>
            <button aria-label="close" onClick={() => setHistOpen(false)} className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ x: isAr ? 40 : -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-y-0 start-0 z-50 w-72"
            >
              {sidebar}
            </motion.div>
          </>
        )
      ) : (
        <>
          <div
            style={{ width: histOpen ? histWidth : 0 }}
            className="shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
          >
            {sidebar}
          </div>
          {histOpen && (
            <div
              onPointerDown={startResize}
              title={isAr ? "اسحب لتغيير العرض" : "Drag to resize"}
              className="group relative w-1.5 shrink-0 cursor-col-resize"
            >
              <div className="absolute inset-y-0 start-0 w-px bg-border/60 transition-colors group-hover:bg-primary/50" />
            </div>
          )}
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header: minimal — expand button (only when the rail is hidden) + new chat */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {!histOpen && (
              <button
                onClick={() => setHistOpen(true)}
                title={isAr ? "إظهار المحادثات" : "Show chats"}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => newChat()}
            title={isAr ? "محادثة جديدة" : "New chat"}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        </div>

        {/* Thread, or centered welcome on a fresh chat */}
        {hasThread ? (
          <>
            <MessageThread conversation={active!} assistant={activeAssistant} onStarter={(t) => handleSend(t)} />
            <Composer streaming={streaming} onSend={handleSend} onStop={() => active && stopChat(active.id)} onOpenSettings={() => setSettings(true)} onImage={handleImage} />
          </>
        ) : (
          <div className="relative flex flex-1 flex-col items-center justify-center px-4">
            {/* Gemini-style ambient blue glow rising from the bottom */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[55%]"
              style={{ background: "radial-gradient(ellipse 55% 70% at 50% 115%, rgba(66,133,244,0.18) 0%, transparent 70%)" }}
            />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="relative z-10 w-full max-w-3xl"
            >
              <div className="mb-6 text-center">
                {isDefault ? (
                  <h1 dir="auto" className="font-display text-3xl font-medium tracking-tight text-foreground/95 sm:text-4xl">{greet}</h1>
                ) : (
                  <>
                    <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{activeAssistant?.name}</h1>
                    {activeAssistant?.description && (
                      <p dir="auto" className="mt-2 text-sm text-muted-foreground">{activeAssistant.description}</p>
                    )}
                  </>
                )}
              </div>

              <Composer streaming={false} onSend={handleSend} onStop={() => {}} onOpenSettings={() => setSettings(true)} onImage={handleImage} />

              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {chips.slice(0, 4).map((s, i) => (
                    <button
                      key={i}
                      dir="auto"
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-foreground/70 transition hover:border-primary/40 hover:bg-secondary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

            </motion.div>
          </div>
        )}
      </div>

      {/* Overlays */}
      {gallery && (
        <AssistantGallery
          onClose={() => setGallery(false)}
          onPick={(a) => { newChat(a.id); setGallery(false); }}
          onCreate={() => { setGallery(false); setEditor({ assistant: null }); }}
          onEdit={(a) => { setGallery(false); setEditor({ assistant: a }); }}
        />
      )}
      {editor && <AssistantEditor assistant={editor.assistant} onClose={() => setEditor(null)} />}
      {settings && <ChatSettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}
