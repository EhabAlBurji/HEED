import { useEffect, useState } from "react";

const DISMISSED_KEY = "heed-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after 3-second delay
      setTimeout(() => setVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  if (!visible || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border bg-card shadow-xl">
      <div className="flex items-center gap-3 p-4">
        <span className="text-xl">📱</span>
        <p className="flex-1 text-sm font-medium">ثبّت Heed على جهازك</p>
        <button
          onClick={handleInstall}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          تثبيت
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
