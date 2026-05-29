import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mail, ArrowLeft, Loader2, Sparkles, ArrowRight, ShieldCheck, User, RefreshCw } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { isSupabaseConfigured } from "../lib/supabase";
import { cn } from "../lib/utils";

type Step = "email" | "otp" | "name";

// Supabase Auth → "Email OTP Length" — must match the value in the dashboard.
// Default is 6؛ غيّرها هنا لو غيّرت في Supabase.
const OTP_LENGTH = 8;
const EMPTY_OTP = Array<string>(OTP_LENGTH).fill("");

// Tiny i18n helper local to this file — picks the right string by current language.
const useI = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  return <T,>(ar: T, en: T) => (isAr ? ar : en);
};

// Google logo SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const tr = useI();
  const [step, setStep]         = useState<Step>("email");
  const [email, setEmail]       = useState("");
  const [otp, setOtp]           = useState<string[]>(EMPTY_OTP);
  const [nameInput, setNameInput] = useState("");
  const [googleWaiting, setGoogleWaiting] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    signInWithGoogle, sendOtp, verifyOtp, updateProfile,
    continueAsGuest, checkSession,
    isLoading, error, clearError,
  } = useAuthStore();

  const hasSupabase = isSupabaseConfigured();
  const otpValue    = otp.join("");

  // Auto-submit OTP when all boxes filled
  useEffect(() => {
    if (otpValue.length === OTP_LENGTH && step === "otp" && !isLoading) {
      void handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpValue]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    clearError();
    try {
      await sendOtp(email.trim());
      setStep("otp");
    } catch {}
  };

  const handleVerify = async () => {
    const token = otpValue;
    if (token.length < OTP_LENGTH) return;
    try {
      await verifyOtp(email, token);
      // After OTP, move to name step if user has no name
      const { user } = useAuthStore.getState();
      if (!user?.name) setStep("name");
    } catch {}
  };

  const handleSaveName = async () => {
    if (nameInput.trim()) {
      await updateProfile({ name: nameInput.trim() });
    }
    // Proceed to app (user is already set after verifyOtp)
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setGoogleWaiting(true);
    try {
      await signInWithGoogle();
    } catch {
      setGoogleWaiting(false);
    }
  };

  const handleGoogleReturn = async () => {
    await checkSession();
    setGoogleWaiting(false);
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next  = [...otp];
    next[i]     = digit;
    setOtp(next);
    if (digit && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft"  && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
    if (e.key === "ArrowRight" && i > 0)              otpRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    const next = [...EMPTY_OTP];
    digits.split("").forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const goBack = () => {
    setStep("email");
    setOtp(EMPTY_OTP);
    setGoogleWaiting(false);
    clearError();
  };

  return (
    <div
      className="relative flex h-screen flex-col items-center justify-center overflow-y-auto bg-background select-none px-6 py-10"
      style={{
        // Subtle dotted pattern background — quso.ai style
        backgroundImage:
          "radial-gradient(circle, hsl(var(--muted-foreground) / 0.18) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* Soft ambient gradient wash over the dots */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(103,53,225,0.10) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(139,92,246,0.10) 0%, transparent 70%)",
        }}
      />

      {/* ── Floating decorative cards in the 4 corners ── */}
      <FloatingMockups />

      {/* ── Centered hero ── */}
      <div className="relative z-10 flex w-full max-w-[640px] flex-col items-center text-center">
        {/* Logo tile */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-[0_8px_32px_rgba(103,53,225,0.18)] ring-1 ring-border">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>

        {/* Big title */}
        <h1 className="font-display text-5xl font-bold tracking-tight leading-[1.05]">
          {tr("مساعدك الشخصي", "Your Personal")}
          <br />
          <span className="bg-gradient-to-l from-brand-violet-light via-primary to-brand-violet-light bg-clip-text text-transparent">
            {tr("للإنتاجية بالذكاء الاصطناعي", "AI Productivity Co-Pilot")}
          </span>
        </h1>

        <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
          {tr(
            "نظّم يومك، تابع مهامك، خطّط نشرك — كله في مكان واحد.",
            "Organize your day, track tasks, plan your content — all in one place.",
          )}
          <br />
          <span className="font-medium text-foreground/80">
            {tr("إنتاجية أعلى 10×. تلقائية.", "10× more productive. Automated.")}
          </span>
        </p>

        {/* ── Auth card / CTA ── */}
        <div className="mt-8 w-full max-w-[420px]">
          {!hasSupabase ? (
            /* ── No Supabase: local-only mode ─────────────── */
            <div className="space-y-3 text-center">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm">
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  {tr("وضع محلي", "Local mode")}
                </p>
                <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70">
                  {tr(
                    "Supabase غير مُهيأ — بياناتك تُحفظ على جهازك فقط",
                    "Supabase isn't configured — your data is stored locally",
                  )}
                </p>
              </div>
              <button
                onClick={continueAsGuest}
                className="btn-cta flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold"
              >
                {tr("ابدأ مجاناً", "Start free")}
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          ) : step === "name" ? (
            /* ── Step 3: name after OTP ─────────────────── */
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xl space-y-4">
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20 text-xl font-bold text-primary">
                    {nameInput ? nameInput.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "؟"}
                  </div>
                </div>
                <h2 className="text-lg font-semibold">{tr("ما اسمك؟", "What's your name?")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tr("سيظهر في التحية وملفك الشخصي", "Shown in greetings and your profile")}
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSaveName()}
                  placeholder={tr("مثلاً: أحمد محمد", "e.g., Alex Johnson")}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              <button
                onClick={() => void handleSaveName()}
                disabled={isLoading}
                className="btn-cta flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-semibold"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                  <span>{tr("ابدأ استخدام Heed", "Start using Heed")}</span>
                  <ArrowLeft className="h-4 w-4" />
                </>}
              </button>

              <button
                onClick={() => void handleSaveName()}
                className="w-full text-center font-micro text-xs text-muted-foreground hover:text-foreground"
              >
                {tr("تخطي", "Skip")}
              </button>
            </div>
          ) : step === "otp" ? (
            /* ── Step 2: OTP ────────────────────────────── */
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xl space-y-5">
              <div>
                <button type="button" onClick={goBack} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowRight className="h-3.5 w-3.5" />{tr("رجوع", "Back")}
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">{tr("أدخل الكود", "Enter the code")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {tr("أرسلنا كود إلى ", "We sent a code to ")}
                  <span className="font-medium text-foreground" dir="ltr">{email}</span>
                </p>
              </div>

              {/* OTP boxes — tighter gap + smaller width when length > 6 to fit the card */}
              <div className={cn("flex justify-center", OTP_LENGTH > 6 ? "gap-1.5" : "gap-2")} dir="ltr" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    autoFocus={i === 0}
                    className={cn(
                      "h-12 rounded-xl border text-center text-lg font-semibold tabular-nums outline-none transition-all",
                      OTP_LENGTH > 6 ? "w-9" : "w-10",
                      digit ? "border-primary bg-primary/8 text-primary" : "border-border bg-background",
                      "focus:border-primary focus:ring-2 focus:ring-primary/20"
                    )}
                  />
                ))}
              </div>

              {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</div>}

              {isLoading && (
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}

              <button type="button" onClick={() => { clearError(); void sendOtp(email); }} className="w-full text-center font-micro text-xs text-muted-foreground hover:text-foreground transition-colors">
                {tr("ما وصلكش الكود؟ أعد الإرسال", "Didn't get the code? Resend")}
              </button>
            </div>
          ) : (
            /* ── Step 1: Email + Google (CTA-style) ──────── */
            <div className="space-y-4">
              {/* Primary gradient CTA — opens an inline form below */}
              {!googleWaiting ? (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="btn-cta flex w-full items-center justify-center gap-3 rounded-2xl py-3.5 text-sm font-semibold"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span className="rounded-md bg-white/15 p-1">
                          <GoogleIcon />
                        </span>
                        <span>{tr("ابدأ بـ Google مجاناً", "Continue with Google")}</span>
                      </>
                    )}
                  </button>
                  <p className="text-center font-micro text-[11px] text-muted-foreground">
                    {tr("لا تحتاج بطاقة ائتمان", "No credit card required")}
                  </p>

                  {/* Divider */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="font-micro text-xs text-muted-foreground">
                      {tr("أو بالبريد", "or with email")}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Email form */}
                  <form onSubmit={handleSendOtp}>
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        autoComplete="email"
                        dir="ltr"
                        className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                      />
                    </div>

                    {error && <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</div>}

                    <button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/8 py-2.5 font-medium text-primary transition-all hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                        <span>{tr("إرسال كود التحقق", "Send verification code")}</span>
                        <ArrowLeft className="h-4 w-4" />
                      </>}
                    </button>
                  </form>

                  {/* Guest option */}
                  <button
                    type="button"
                    onClick={continueAsGuest}
                    className="w-full rounded-2xl border border-border bg-transparent py-2.5 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                  >
                    {tr("تابع بدون حساب", "Continue without an account")}
                  </button>
                </>
              ) : (
                <div className="rounded-3xl border border-primary/30 bg-primary/8 p-5 text-center space-y-3">
                  <p className="text-sm text-primary font-medium">
                    {tr("فُتح المتصفح — أكمل تسجيل الدخول بـ Google", "Browser opened — finish sign-in with Google")}
                  </p>
                  <p className="font-micro text-xs text-muted-foreground">
                    {tr("بعد الموافقة في المتصفح، اضغط الزرار أدناه", "After approving in the browser, click below")}
                  </p>
                  <button
                    onClick={() => void handleGoogleReturn()}
                    className="btn-cta flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {tr("رجعت — أكمل الدخول", "I'm back — finish sign-in")}
                  </button>
                  <button onClick={goBack} className="font-micro text-xs text-muted-foreground hover:text-foreground">
                    {tr("إلغاء", "Cancel")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-8 font-micro text-[11px] text-muted-foreground/50">
          {new Date().getFullYear()} © Heed
        </p>
      </div>
    </div>
  );
}

// ── Floating decorative mockup cards in the 4 corners ────────────────────────
function FloatingMockups() {
  const tr = useI();
  return (
    <>
      {/* Top-left: small task list card */}
      <div
        className="pointer-events-none absolute left-[3%] top-[10%] z-0 hidden md:block"
        style={{ animation: "floatA 7s ease-in-out infinite" }}
      >
        <div className="w-[170px] rounded-2xl border border-border bg-card p-3 shadow-xl rotate-[-6deg]">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-micro text-[10px] font-semibold uppercase tracking-wider">
              {tr("مهام", "Tasks")}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 w-3/4 rounded-full bg-muted" />
            <div className="h-1.5 w-1/2 rounded-full bg-muted" />
            <div className="h-1.5 w-5/6 rounded-full bg-muted" />
          </div>
        </div>
      </div>

      {/* Top-right: avatar mini-card */}
      <div
        className="pointer-events-none absolute right-[4%] top-[8%] z-0 hidden md:block"
        style={{ animation: "floatB 8s ease-in-out infinite" }}
      >
        <div className="w-[130px] rounded-2xl border border-border bg-card p-2.5 shadow-xl rotate-[4deg]">
          <div className="mb-1.5 h-16 w-full rounded-xl bg-gradient-to-br from-brand-violet-light to-primary" />
          <div className="h-1.5 w-2/3 rounded-full bg-muted" />
        </div>
      </div>

      {/* Bottom-left: chart card */}
      <div
        className="pointer-events-none absolute left-[5%] bottom-[12%] z-0 hidden md:block"
        style={{ animation: "floatC 9s ease-in-out infinite" }}
      >
        <div className="w-[180px] rounded-2xl border border-border bg-card p-3 shadow-xl rotate-[5deg]">
          <div className="mb-2 flex items-end gap-1 h-12">
            {[40, 65, 30, 85, 55, 70].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-primary to-brand-violet-light"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="h-1.5 w-1/2 rounded-full bg-muted" />
        </div>
      </div>

      {/* Bottom-right: schedule card */}
      <div
        className="pointer-events-none absolute right-[3%] bottom-[10%] z-0 hidden md:block"
        style={{ animation: "floatD 7.5s ease-in-out infinite" }}
      >
        <div className="w-[160px] rounded-2xl border border-border bg-card p-3 shadow-xl rotate-[-4deg]">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-micro text-[10px] font-semibold">
              {tr("جدول", "Schedule")}
            </span>
            <span className="font-micro text-[9px] text-muted-foreground">
              {tr("يوليو", "Jul")}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-[3px]"
                style={{
                  background: [4, 8, 12, 15].includes(i)
                    ? "var(--tw-prose-bullets, #6735E1)"
                    : "hsl(var(--muted))",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatA { 0%,100% { transform: translateY(0) rotate(-6deg) } 50% { transform: translateY(-10px) rotate(-6deg) } }
        @keyframes floatB { 0%,100% { transform: translateY(0) rotate(4deg) }  50% { transform: translateY(-8px)  rotate(4deg)  } }
        @keyframes floatC { 0%,100% { transform: translateY(0) rotate(5deg) }  50% { transform: translateY(-12px) rotate(5deg)  } }
        @keyframes floatD { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-9px)  rotate(-4deg) } }
      `}</style>
    </>
  );
}

