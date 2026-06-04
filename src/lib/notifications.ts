// =========================================================================
// Heed — Browser Notification helpers
// Uses the Web Notifications API. No service worker required.
// Notifications are suppressed when the tab is already visible.
// =========================================================================

/** Returns true when the browser has granted notification permission. */
export function canNotify(): boolean {
  return (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  );
}

/**
 * Ask for notification permission once. Safe to call on every login —
 * the browser no-ops after the first prompt.
 */
export async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

/**
 * Show a browser notification unless the tab is currently focused.
 * Falls back silently when permission is denied or the API is unavailable.
 */
export function showNotification(
  title: string,
  body: string,
  opts?: { icon?: string; tag?: string; onClick?: () => void }
): void {
  if (!canNotify()) return;
  if (document.visibilityState === "visible") return;

  const n = new Notification(title, {
    body,
    icon: opts?.icon ?? "/heed-icon.png",
    tag: opts?.tag,
    silent: false,
  });

  if (opts?.onClick) {
    n.onclick = () => {
      window.focus();
      opts.onClick!();
      n.close();
    };
  } else {
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }
}
