import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw, LogOut, Sparkles, Clock, Ban } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { HeedLogo } from "../HeedLogo";

// Shown to signed-in users whose `profiles.access_status` is "early_access"
// (an admin hasn't approved them yet) or "rejected" (an admin revoked them).
// They can re-check (we also poll every 20s) or sign out. Approval flips them
// straight into the app — no refresh needed.
export function EarlyAccessGate({ status = "early_access" }: { status?: "early_access" | "rejected" }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const tr = <T,>(ar: T, en: T) => (isAr ? ar : en);
  const rejected = status === "rejected";

  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const fetchAccessStatus = useAuthStore((s) => s.fetchAccessStatus);
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    try {
      await fetchAccessStatus();
    } finally {
      setChecking(false);
    }
  };

  // Poll while the gate is shown so approval unlocks the app automatically,
  // and re-check whenever the window regains focus.
  useEffect(() => {
    const id = setInterval(() => void fetchAccessStatus(), 20_000);
    const onFocus = () => void fetchAccessStatus();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAccessStatus]);

  return (
    <div
      className="relative flex h-screen flex-col items-center justify-center overflow-y-auto bg-background select-none px-6 py-10"
      style={{
        backgroundImage:
          "radial-gradient(circle, hsl(var(--muted-foreground) / 0.18) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(103,53,225,0.12) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center text-center">
        <div className="mb-6 rounded-2xl shadow-[0_8px_32px_rgba(103,53,225,0.18)]">
          <HeedLogo className="h-16 w-16 text-primary" />
        </div>

        <div className="w-full rounded-3xl border border-border bg-card p-7 shadow-xl">
          <div className="mb-4 flex justify-center">
            {rejected ? (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/20">
                <Ban className="h-6 w-6 text-destructive" />
              </span>
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold tracking-tight">
            {rejected
              ? tr("وصولك إلى Heed غير متاح", "Your access to Heed isn't available")
              : tr("أنت ضمن الوصول المبكر 🎉", "You're on the early access list 🎉")}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {rejected
              ? tr(
                  "للأسف حسابك غير مفعّل للوصول إلى Heed حالياً. لو تعتقد أن هذا خطأ، تواصل معنا.",
                  "Your account doesn't have access to Heed right now. If you believe this is a mistake, please contact us.",
                )
              : tr(
                  "شكراً لتسجيلك في Heed! حسابك قيد المراجعة وهنفعّلهولك قريب جداً. هنبعتلك إيميل ترحيب أول ما يتفعّل، وتقدر تبدأ على طول.",
                  "Thanks for signing up to Heed! Your account is under review and we'll activate it very soon. You'll get a welcome email the moment it's ready, and you can start right away.",
                )}
          </p>

          {user?.email && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-medium text-foreground" dir="ltr">{user.email}</span>
            </div>
          )}

          <button
            onClick={() => void recheck()}
            disabled={checking}
            className="btn-cta mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {tr("تحقق من التفعيل", "Check activation")}
              </>
            )}
          </button>

          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            {tr("تسجيل الخروج", "Sign out")}
          </button>
        </div>

        <p className="mt-8 font-micro text-[11px] text-muted-foreground/50">
          {new Date().getFullYear()} © Heed
        </p>
      </div>
    </div>
  );
}
