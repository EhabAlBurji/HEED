import { create } from "zustand";
import { persist } from "zustand/middleware";

// Local notification inbox. Cross-user delivery (one user inviting another)
// requires a Supabase realtime/edge-function backend — see NOTES. The store,
// UI, and accept/reject flow are fully built and work locally today.

export type NotificationType = "workspace_invite" | "mention" | "assignment" | "info";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  created_at: string;
  read: boolean;
  // workspace_invite payload
  workspace?: { id: string; name: string; color: string };
  // mention/assignment payload
  taskId?: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();

type NotificationsState = {
  notifications: AppNotification[];
  add: (n: Omit<AppNotification, "id" | "created_at" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  unreadCount: () => number;
};

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      add: (n) =>
        set((s) => ({
          notifications: [{ ...n, id: uid(), created_at: nowIso(), read: false }, ...s.notifications],
        })),
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      remove: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    { name: "heed:notifications" }
  )
);
