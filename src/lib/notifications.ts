// =========================================================================
// Heed — Browser Notification helpers
// Uses the Web Notifications API. No service worker required.
// Notifications are suppressed when the tab is already visible.
// =========================================================================

import { getNotifPrefs } from "./notifPrefs";

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
 *
 * Pass `kind` to respect per-type notification preferences:
 *   "dm"      → checks prefs.dms
 *   "hr"      → checks prefs.hr
 *   "task"    → checks prefs.tasks
 *   "mention" → checks prefs.mentions
 *   "invite"  → checks prefs.invites
 */
export function showNotification(
  title: string,
  body: string,
  opts?: { icon?: string; tag?: string; onClick?: () => void; kind?: "dm" | "hr" | "task" | "mention" | "invite" }
): void {
  if (!canNotify()) return;
  if (document.visibilityState === "visible") return;

  // Respect per-type preference — every kind is gated; unknown kinds are silently shown
  if (opts?.kind) {
    const prefs = getNotifPrefs();
    if (opts.kind === "dm" && !prefs.dms) return;
    if (opts.kind === "hr" && !prefs.hr) return;
    if (opts.kind === "task" && !prefs.tasks) return;
    if (opts.kind === "mention" && !prefs.mentions) return;
    if (opts.kind === "invite" && !prefs.invites) return;
  }

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
