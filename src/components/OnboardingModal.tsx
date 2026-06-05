import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { HeedLogo } from "./HeedLogo";

const STORAGE_KEY = "heed-onboarded";

export function useOnboarding() {
  const [dismissed, setDismissed] = useState(false);
  const alreadyOnboarded =
    typeof localStorage !== "undefined" && !!localStorage.getItem(STORAGE_KEY);

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return { show: !alreadyOnboarded && !dismissed, complete };
}

// ---------------------------------------------------------------------------
// Step sub-components
// ---------------------------------------------------------------------------

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <HeedLogo className="h-16 w-16 rounded-2xl shadow-lg" />
      <div>
        <h1 className="text-2xl font-bold text-foreground">مرحباً بك في Heed 👋</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          مساعدك الشخصي للإنتاجية، الفريق، والموارد البشرية
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {[
          { icon: "📋", label: "Tasks" },
          { icon: "💬", label: "DMs" },
          { icon: "👥", label: "HR" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-2xl bg-muted/50 border border-border px-3 py-4"
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
      >
        ابدأ →
      </button>
    </div>
  );
}

function StepTasks({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-3xl">
        📋
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">المهام والمشاريع</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          أنشئ مهامك، رتبها بالـ Kanban، وتابع تقدمك
        </p>
      </div>

      {/* CSS Kanban mockup */}
      <div className="w-full rounded-2xl bg-muted/40 border border-border p-3 flex gap-2 overflow-hidden">
        {[
          { title: "قيد الانتظار", color: "bg-slate-500/20 border-slate-500/30", cards: ["تصميم الواجهة", "قاعدة البيانات"] },
          { title: "جارٍ", color: "bg-blue-500/20 border-blue-500/30", cards: ["API المهام"] },
          { title: "مكتمل", color: "bg-emerald-500/20 border-emerald-500/30", cards: ["إعداد المشروع", "الاتصال"] },
        ].map((col) => (
          <div key={col.title} className="flex-1 flex flex-col gap-1.5">
            <div className={`rounded-lg border px-2 py-1 text-[10px] font-semibold text-center ${col.color}`}>
              {col.title}
            </div>
            {col.cards.map((card) => (
              <div
                key={card}
                className="rounded-lg bg-card border border-border px-2 py-1.5 text-[10px] text-muted-foreground text-right leading-snug"
              >
                {card}
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
      >
        التالي →
      </button>
    </div>
  );
}

function StepMessages({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 text-3xl">
        💬
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">تواصل مع فريقك</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          رسائل مباشرة، مجموعات، رسائل صوتية، ومكالمات
        </p>
      </div>

      {/* Feature list */}
      <div className="w-full rounded-2xl bg-muted/40 border border-border p-4 flex flex-col gap-2.5">
        {[
          { icon: "✓", label: "رسائل مباشرة (DMs)" },
          { icon: "✓", label: "مجموعات" },
          { icon: "✓", label: "رسائل صوتية" },
          { icon: "✓", label: "تفاعلات (Reactions)" },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-3 text-right">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400 font-bold">
              {icon}
            </span>
            <span className="text-sm text-foreground flex-1 text-right">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
      >
        التالي →
      </button>
    </div>
  );
}

function StepReady({ onComplete }: { onComplete: (navigate?: boolean) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-5xl"
      >
        ✅
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">أنت جاهز! 🎉</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          ابدأ باستخدام Heed دلوقتي
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <button
          onClick={() => onComplete(true)}
          className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20 active:scale-95 transition-all"
        >
          إنشاء مهمة أولى
        </button>
        <button
          onClick={() => onComplete(false)}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
        >
          ابدأ الرحلة
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

const STEPS = 4;

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const navigate = useNavigate();

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const handleComplete = (goToProjects = false) => {
    onDone();
    if (goToProjects) navigate("/projects");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative w-full max-w-md rounded-3xl bg-card border border-border p-8 shadow-2xl mx-4"
      >
        {/* X / skip button */}
        <button
          onClick={() => handleComplete(false)}
          aria-label="تخطي"
          className="absolute top-4 left-4 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm"
        >
          ✕
        </button>

        {/* Step content */}
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
            >
              {step === 0 && <StepWelcome onNext={() => go(1)} />}
              {step === 1 && <StepTasks onNext={() => go(2)} />}
              {step === 2 && <StepMessages onNext={() => go(3)} />}
              {step === 3 && <StepReady onComplete={handleComplete} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: STEPS }).map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`الخطوة ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
