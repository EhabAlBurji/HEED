import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";

// ──────────────────────────────────────────────────────────────────────────────
// Keyboard Shortcuts Panel
// Opens with "?" key (when not inside a text input) or the sidebar ? button.
// ──────────────────────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { keys: ["⌘", "K"], descEn: "Global search",      descAr: "البحث العام" },
  { keys: ["⌘", "N"], descEn: "New task",            descAr: "مهمة جديدة" },
  { keys: ["⌘", "D"], descEn: "Go to DMs",           descAr: "الرسائل المباشرة" },
  { keys: ["⌘", "H"], descEn: "Go to HR",            descAr: "الموارد البشرية" },
  { keys: ["⌘", "B"], descEn: "Go to Boards",        descAr: "اللوحات" },
  { keys: ["Esc"],     descEn: "Close modal",         descAr: "إغلاق النافذة" },
  { keys: ["?"],       descEn: "Open shortcuts",      descAr: "فتح الاختصارات" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  // Listen for the "?" key (not when typing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "?" && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listen for the sidebar button event
  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener("heed:open-shortcuts", handler);
    return () => window.removeEventListener("heed:open-shortcuts", handler);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="shortcuts-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <motion.div
            key="shortcuts-panel"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-md rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Keyboard className="h-[18px] w-[18px]" />
              </div>
              <h2 className="flex-1 font-display text-base font-semibold">
                {isAr ? "اختصارات لوحة المفاتيح" : "Keyboard Shortcuts"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shortcuts grid */}
            <div className="px-5 py-4 space-y-1">
              {SHORTCUTS.map(({ keys, descEn, descAr: descArText }) => (
                <div
                  key={keys.join("+")}
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60",
                  )}
                >
                  <span className="text-sm text-foreground/80">
                    {isAr ? descArText : descEn}
                  </span>
                  <div dir="ltr" className="flex shrink-0 items-center gap-1">
                    {keys.map((key, ki) => (
                      <span key={ki} className="flex items-center gap-1">
                        <kbd className="min-w-[28px] rounded-lg border border-border/60 bg-background/60 px-2 py-1 text-center font-mono text-[12px] font-semibold text-foreground/80 shadow-[0_2px_0_hsl(var(--border)/0.5)]">
                          {key}
                        </kbd>
                        {ki < keys.length - 1 && (
                          <span className="text-[10px] text-muted-foreground/40">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="border-t border-border/30 px-5 py-3">
              <p className="text-center text-[11px] text-muted-foreground/50">
                {isAr ? "اضغط ? أو Esc للإغلاق" : "Press ? to toggle • Esc to close"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
