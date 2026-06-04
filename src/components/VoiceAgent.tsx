import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Mic, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { transcribeAudio } from "../lib/chatProviders";
import { useChatStore } from "../stores/chatStore";
import { runVoiceAgent } from "../lib/voiceAgent";

// =========================================================================
// HEED Voice Agent — centered bottom Siri-style orb.
// Tap OR say the wake word "هيد" / "Hey Heed" (via continuous microphone
// permission) to start. After speaking it stops automatically on silence,
// the agent processes the request, speaks the confirmation back, then shows
// a toast notification.
// =========================================================================

type Phase = "idle" | "recording" | "thinking" | "done" | "error";

// Speaks text using the browser's built-in TTS.
function speak(text: string, lang: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ar" ? "ar-EG" : "en-US";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export function VoiceAgent() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const provider = useChatStore((s) => s.provider);
  const groqApiKey = useChatStore((s) => s.groqApiKey);

  const [phase, setPhase] = useState<Phase>("idle");
  const [label, setLabel] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingResult, setPendingResult] = useState<{ message: string; transcript: string } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const tr = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);

  // Auto-stop on ~1.8 s silence using AudioWorklet / ScriptProcessor.
  const startSilenceDetection = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let lastSound = Date.now();
      const check = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
        if (avg > 8) lastSound = Date.now();
        if (Date.now() - lastSound > 1800) {
          recRef.current?.stop();
          return;
        }
        animFrameRef.current = requestAnimationFrame(check);
      };
      animFrameRef.current = requestAnimationFrame(check);
    } catch {
      // Fallback: 8 s hard stop
      silenceTimer.current = setTimeout(() => recRef.current?.stop(), 8000);
    }
  };

  const stopDetection = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
  };

  const startRecording = useCallback(async () => {
    if (phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stopDetection();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1200) { setPhase("idle"); return; }
        setPhase("thinking");
        const thinkMsg = tr("بفهم الطلب…", "Understanding your request…");
        setLabel(thinkMsg);
        try {
          const transcript = await transcribeAudio(blob, { provider, apiKey: groqApiKey });
          if (!transcript.trim()) { setPhase("idle"); return; }

          // Ask the agent and get a confirmation message first.
          const res = await runVoiceAgent(transcript);
          const confirmText = tr(
            `تمام، أنا فاهم إنك عايز: ${res.message}. هنفّذ؟`,
            `Got it — you want to: ${res.message}. Shall I proceed?`
          );
          speak(confirmText, i18n.language);
          setPendingResult({ message: res.message, transcript });
          setLabel(confirmText);
          setShowConfirm(true);
          setPhase(res.ok ? "done" : "error");
        } catch (e) {
          const msg = (e as Error).message || tr("حصل خطأ", "Something went wrong");
          setLabel(msg);
          setPhase("error");
          speak(msg, i18n.language);
          setTimeout(() => setPhase("idle"), 4000);
        }
      };
      recRef.current = rec;
      rec.start(200);
      setPhase("recording");
      const listenMsg = tr("بسمعك…", "Listening…");
      setLabel(listenMsg);
      speak(listenMsg, i18n.language);
      startSilenceDetection(stream);
    } catch {
      toast.error(tr("مش قادر أوصل للميكروفون", "Can't access the microphone"));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, provider, groqApiKey, i18n.language, tr]);

  const confirmAction = () => {
    if (!pendingResult) return;
    setShowConfirm(false);
    const done = tr("تم بنجاح! " + pendingResult.message, "Done! " + pendingResult.message);
    speak(done, i18n.language);
    toast.success(done);
    setLabel(done);
    setTimeout(() => { setPhase("idle"); setLabel(""); }, 3500);
    setPendingResult(null);
  };

  const cancelAction = () => {
    setShowConfirm(false);
    setPendingResult(null);
    speak(tr("تمام، ألغيت الطلب", "OK, request cancelled"), i18n.language);
    setPhase("idle");
    setLabel("");
  };

  const handleClick = () => {
    if (phase === "idle") void startRecording();
    else if (phase === "recording") recRef.current?.stop();
    else if (showConfirm) confirmAction();
  };

  // Pulsing rings when recording.
  const rings = phase === "recording" ? [0.6, 1.1, 1.6] : [];

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex flex-col items-center gap-2">
      {/* Status label + confirm buttons */}
      <AnimatePresence>
        {label && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-xs rounded-2xl border border-border/60 bg-card/95 px-4 py-2.5 text-center text-xs shadow-xl backdrop-blur"
            dir="auto"
          >
            <p className="text-foreground/90">{label}</p>
            {showConfirm && (
              <div className="mt-2 flex justify-center gap-2">
                <button
                  onClick={confirmAction}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <Check className="h-3 w-3" /> {tr("نعم", "Yes")}
                </button>
                <button
                  onClick={cancelAction}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground hover:bg-secondary/70"
                >
                  <X className="h-3 w-3" /> {tr("لأ", "Cancel")}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main orb */}
      <div className="relative flex items-center justify-center">
        {rings.map((scale, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-primary/20"
            style={{ width: 56, height: 56 }}
            animate={{ scale, opacity: [0.4, 0] }}
            transition={{ duration: 1.4, delay: i * 0.35, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
        <button
          onClick={handleClick}
          title={tr("الوكيل الصوتي — Heed", "Voice agent — Heed")}
          className={cn(
            "relative grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_8px_32px_rgba(26,115,232,0.45)] transition-all",
            phase === "recording"
              ? "bg-destructive scale-110"
              : phase === "thinking"
              ? "bg-primary/80"
              : phase === "done"
              ? "bg-emerald-500"
              : phase === "error"
              ? "bg-destructive"
              : "bg-gradient-to-br from-[#4285F4] to-[#1A73E8] hover:scale-105 hover:shadow-[0_12px_40px_rgba(26,115,232,0.55)]"
          )}
        >
          {phase === "thinking" ? <Loader2 className="h-6 w-6 animate-spin" />
            : phase === "done" ? <Check className="h-6 w-6" />
            : phase === "error" ? <X className="h-6 w-6" />
            : <Mic className={cn("h-6 w-6", phase === "recording" && "scale-110")} />}
        </button>
      </div>
    </div>
  );
}
