// =========================================================================
// Heed — Notification preferences (localStorage)
// =========================================================================

const STORAGE_KEY = "heed-notif-prefs";

export type NotifPrefs = {
  dms: boolean;
  hr: boolean;
  tasks: boolean;
  email: boolean;
};

const DEFAULT: NotifPrefs = { dms: true, hr: true, tasks: true, email: true };

export function getNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return { ...DEFAULT };
  }
}

export function setNotifPrefs(p: Partial<NotifPrefs>): void {
  try {
    const current = getNotifPrefs();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...p }));
  } catch { /* best-effort */ }
}
